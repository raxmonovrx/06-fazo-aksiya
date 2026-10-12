import { PrismaClient } from '@prisma/client';

import { callback, contactMessage, createTestApp, textMessage } from './helpers.js';

// Test foydalanuvchilari shu oraliqda — boshqa ma'lumotga tegmaymiz
const BASE = 9_100_000_000;
const prisma = new PrismaClient();

async function cleanup() {
  const ids = { gte: BigInt(BASE), lt: BigInt(BASE + 1000) };
  const ps = await prisma.participant.findMany({ where: { tgId: ids }, select: { id: true } });
  const pid = { in: ps.map((p) => p.id) };
  await prisma.coupon.deleteMany({ where: { participantId: pid } });
  await prisma.scanLog.deleteMany({ where: { participantId: pid } });
  await prisma.receipt.deleteMany({ where: { participantId: pid } });
  await prisma.participant.updateMany({ where: { tgId: ids }, data: { referredById: null } });
  await prisma.participant.deleteMany({ where: { tgId: ids } });
  await prisma.staffPhone.deleteMany({ where: { phone: { startsWith: '+99899000' } } });
}

describe('Bot: ro\'yxatdan o\'tish', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    await cleanup();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.app.close();
    await cleanup();
    await prisma.$disconnect();
  });
  beforeEach(() => {
    t.calls.length = 0;
  });

  const lastText = () => [...t.calls].reverse().find((c) => c.method === 'sendMessage')?.payload;

  it('to\'liq oqim: /start src_ → kontakt → roziman → menyu', async () => {
    const uid = BASE + 1;
    await t.send(textMessage(uid, '/start src_stol12'));
    expect(lastText()?.text).toContain('telefon raqamingizni');
    expect(lastText()?.reply_markup.keyboard[0][0].request_contact).toBe(true);

    await t.send(contactMessage(uid, '998990000001'));
    expect(lastText()?.reply_markup.inline_keyboard[0][0].callback_data).toBe('rules:accept');

    await t.send(callback(uid, 'rules:accept'));
    expect(lastText()?.text).toContain("Fazo Club'ga xush kelibsiz");
    // Doimiy klaviatura yo'q — faqat inline tugmalar; eski klaviatura olib tashlanadi
    const buttons = lastText()?.reply_markup.inline_keyboard.flat();
    expect(buttons.map((b: any) => b.text)).toEqual(["👥 Do'stni taklif qilish", '☎️ Aloqa']);
    expect(t.calls.some((c) => c.method === 'sendMessage' && c.payload.reply_markup?.remove_keyboard)).toBe(true);
    expect(t.calls.some((c) => c.method === 'deleteMessage')).toBe(true);

    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(uid) } });
    expect(p.phone).toBe('+998990000001');
    expect(p.source).toBe('stol12');
    expect(p.startPayload).toBe('src_stol12');
    expect(p.rulesAcceptedAt).not.toBeNull();
    expect(p.isStaff).toBe(false);
    expect(p.refCode).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('boshqa odamning kontakti rad etiladi', async () => {
    const uid = BASE + 2;
    await t.send(textMessage(uid, '/start'));
    await t.send(contactMessage(uid, '998990000002', 777));
    expect(lastText()?.text).toContain("o'zingizning raqamingizni");
    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(uid) } });
    expect(p.phone).toBeNull();
  });

  it('band raqam boshqa akkauntga berilmaydi', async () => {
    const uid = BASE + 3;
    await t.send(textMessage(uid, '/start'));
    await t.send(contactMessage(uid, '+998990000001'));
    expect(lastText()?.text).toContain("boshqa Telegram akkauntga");
  });

  it('chet el raqami qabul qilinmaydi', async () => {
    const uid = BASE + 4;
    await t.send(textMessage(uid, '/start'));
    await t.send(contactMessage(uid, '+79161234567'));
    expect(lastText()?.text).toContain("O'zbekiston raqami");
  });

  it('xodim raqami isStaff=true bo\'ladi', async () => {
    await prisma.staffPhone.create({ data: { phone: '+998990000005', name: 'Test xodim' } });
    const uid = BASE + 5;
    await t.send(textMessage(uid, '/start'));
    await t.send(contactMessage(uid, '+998 99 000 00 05'));
    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(uid) } });
    expect(p.isStaff).toBe(true);
  });

  it('referal kodi saqlanadi, takroriy /start manbani o\'zgartirmaydi', async () => {
    const inviter = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(BASE + 1) } });
    const uid = BASE + 6;
    await t.send(textMessage(uid, `/start ref_${inviter.refCode}`));
    await t.send(textMessage(uid, '/start src_boshqa'));
    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(uid) } });
    expect(p.referredById).toBe(inviter.id);
    expect(p.source).toBe('referral');
  });

  it('ro\'yxatdan o\'tmagan foydalanuvchi menyudan foydalana olmaydi', async () => {
    const uid = BASE + 7;
    await t.send(textMessage(uid, '🎟 Kuponlarim'));
    expect(lastText()?.text).toContain('/start');
  });

  it('eski klaviatura tugmasi yoki matn → bosh xabar; taklif havolasi va aloqa', async () => {
    const uid = BASE + 1;
    await t.send(textMessage(uid, '🎟 Kuponlarim'));
    const home = lastText();
    expect(home?.text).toContain("xush kelibsiz");
    const invite = home?.reply_markup.inline_keyboard.flat().find((b: any) => b.url);
    expect(decodeURIComponent(invite.url)).toMatch(/t\.me\/FazoClub_bot\?start=ref_[A-Z2-9]{6}/);
    await t.send(callback(uid, 'contact'));
    expect(lastText()?.text).toContain('☎️');
  });
});
