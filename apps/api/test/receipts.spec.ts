import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import sharp from 'sharp';

import { signInitData } from '../src/core/init-data.js';
import { ReceiptsBotHandlers } from '../src/receipts/receipts.bot.js';
import { ReceiptsService } from '../src/receipts/receipts.service.js';
import { createTestApp, photoMessage } from './helpers.js';

const BASE = 9_200_000_000;
const TOKEN = process.env.BOT_TOKEN!;
const prisma = new PrismaClient();
// Har ishga tushishda boshqa chek raqamlari — eski test ma'lumoti bilan to'qnashmasin
const RUN = Math.floor(Math.random() * 1e6) * 100;
const FM = 'LG420230613349';

// "Hozir" = 16.10.2026 12:00 Toshkent (aksiya 15.10 dan)
const NOW = new Date('2026-10-16T07:00:00Z');
const qr = (r: number, opts: { fm?: string; c?: string } = {}) =>
  `https://ofd.soliq.uz/check?t=${opts.fm ?? FM}&r=${RUN + r}&c=${opts.c ?? '20261016100000'}&s=047808378930`;

async function cleanup() {
  const ids = { gte: BigInt(BASE), lt: BigInt(BASE + 1000) };
  const ps = await prisma.participant.findMany({ where: { tgId: ids }, select: { id: true } });
  const pid = { in: ps.map((p) => p.id) };
  await prisma.coupon.deleteMany({ where: { participantId: pid } });
  await prisma.scanLog.deleteMany({ where: { participantId: pid } });
  await prisma.receipt.deleteMany({ where: { participantId: pid } });
  await prisma.participant.deleteMany({ where: { tgId: ids } });
  await prisma.unknownFm.deleteMany({ where: { fm: { startsWith: 'ZZTEST' } } });
}

async function registered(n: number) {
  return prisma.participant.create({
    data: {
      tgId: BigInt(BASE + n),
      phone: `+99899100${String(n).padStart(4, '0')}`,
      refCode: `T${RUN}${n}`.slice(0, 12),
      rulesAcceptedAt: new Date(),
      firstName: `Test${n}`,
    },
  });
}

function initData(n: number) {
  return signInitData(
    { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: BASE + n, first_name: 'T' }) },
    TOKEN,
  );
}

describe('Chek qo\'shish', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  let receipts: ReceiptsService;

  const post = (n: number, text: string, auth = `tma ${initData(n)}`) =>
    fetch(`${t.baseUrl}/miniapp/receipts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: auth },
      body: JSON.stringify({ text }),
    });

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    await cleanup();
    for (const n of [1, 2, 3, 4, 5]) await registered(n);
    t = await createTestApp();
    receipts = t.app.get(ReceiptsService);
  });
  afterAll(async () => {
    vi.useRealTimers();
    await t.app.close();
    await cleanup();
    await prisma.$disconnect();
  });
  beforeEach(() => {
    t.calls.length = 0;
    receipts.perMinute.reset();
    receipts.perDay.reset();
  });

  it('mini app: real formatdagi QR → PENDING, Fazo filiali', async () => {
    const res = await post(1, qr(1));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('ACCEPTED');
    expect(body.message).toContain('Fazo Restaurant');
    const r = await prisma.receipt.findUniqueOrThrow({ where: { id: body.receipt.id } });
    expect(r).toMatchObject({ status: 'PENDING', fm: FM, receiptNumber: String(RUN + 1), source: 'QR' });
    expect(r.fiscalAt?.toISOString()).toBe('2026-10-16T05:00:00.000Z');
  });

  it('takror: o\'zi → ALREADY_YOURS, boshqasi → DUPLICATE', async () => {
    const mine = await (await post(1, qr(1))).json();
    expect(mine.code).toBe('ALREADY_YOURS');
    expect(mine.receipt).toMatchObject({ branchName: 'Fazo Restaurant', status: 'PENDING' });
    const other = await (await post(2, qr(1))).json();
    expect(other.code).toBe('DUPLICATE');
    expect(other.receipt).toBeUndefined();
    expect(other.message).toContain('allaqachon qo\'shilgan');
  });

  it('noma\'lum FM → NEEDS_REVIEW, ro\'yxatga tushadi, admin ogohlantiriladi', async () => {
    const body = await (await post(1, qr(2, { fm: 'ZZTEST00000001' }))).json();
    expect(body.code).toBe('REVIEW');
    const r = await prisma.receipt.findUniqueOrThrow({ where: { id: body.receipt.id } });
    expect(r).toMatchObject({ status: 'NEEDS_REVIEW', rejectCode: 'UNKNOWN_FM', branchId: null });
    expect(await prisma.unknownFm.findUnique({ where: { fm: 'ZZTEST00000001' } })).not.toBeNull();
    const alert = t.calls.find((c) => c.method === 'sendMessage' && String(c.payload.chat_id) === process.env.ADMIN_ALERT_CHAT_ID);
    expect(alert?.payload.text).toContain('ZZTEST00000001');
  });

  it('aksiyadan oldingi chek → REJECTED saqlanadi', async () => {
    const body = await (await post(1, qr(3, { c: '20261014230000' }))).json();
    expect(body.code).toBe('BEFORE_CAMPAIGN');
    expect(body.message).toContain('15.10.2026');
    const r = await prisma.receipt.findUniqueOrThrow({ where: { id: body.receipt.id } });
    expect(r.status).toBe('REJECTED');
  });

  it('muddati o\'tgan chek (72 soat) → WINDOW_EXPIRED', async () => {
    vi.setSystemTime(new Date('2026-10-19T07:00:01Z'));
    const body = await (await post(1, qr(4, { c: '20261016120000' }))).json();
    vi.setSystemTime(NOW);
    expect(body.code).toBe('WINDOW_EXPIRED');
  });

  it('QR emas → INVALID_QR, chek yaratilmaydi', async () => {
    const before = await prisma.receipt.count();
    const body = await (await post(1, 'https://instagram.com/fazo')).json();
    expect(body.code).toBe('INVALID_QR');
    expect(await prisma.receipt.count()).toBe(before);
  });

  it('auth: noto\'g\'ri imzo 401, ro\'yxatdan o\'tmagan 403', async () => {
    expect((await post(1, qr(5), 'tma auth_date=1&hash=abc')).status).toBe(401);
    expect((await post(1, qr(5), '')).status).toBe(401);
    expect((await post(99, qr(5))).status).toBe(403);
  });

  it('rate limit: daqiqasiga 5 tadan ortiq → RATE_LIMIT', async () => {
    const codes: string[] = [];
    for (let i = 0; i < 6; i++) codes.push((await (await post(3, `nonsense-${i}`)).json()).code);
    expect(codes.slice(0, 5).every((c) => c === 'INVALID_QR')).toBe(true);
    expect(codes[5]).toBe('RATE_LIMIT');
  });

  it('GET /me: kuponlar va cheklar ro\'yxati', async () => {
    const res = await fetch(`${t.baseUrl}/miniapp/me`, { headers: { authorization: `tma ${initData(1)}` } });
    const body = await res.json();
    expect(body.coupons).toBe(0);
    expect(body.receipts.length).toBeGreaterThanOrEqual(3);
    expect(body.receipts[0].branch === null || typeof body.receipts[0].branch.name === 'string').toBe(true);
    expect(body.campaign.name).toBe('Omad Fazosi');
  });

  it('bot: chek rasmi → QR dekodlanadi → PENDING (PHOTO)', async () => {
    const png = await QRCode.toBuffer(qr(10), { width: 300 });
    const photo = await sharp({ create: { width: 900, height: 1400, channels: 3, background: '#fff' } })
      .composite([{ input: png, top: 800, left: 300 }])
      .jpeg()
      .toBuffer();
    vi.spyOn(t.app.get(ReceiptsBotHandlers) as any, 'download').mockResolvedValueOnce(photo);
    await t.send(photoMessage(BASE + 4, 'BIG_PHOTO'));
    const reply = t.calls.filter((c) => c.method === 'sendMessage').pop();
    expect(reply?.payload.text).toContain('Chek qabul qilindi');
    const r = await prisma.receipt.findFirstOrThrow({ where: { receiptNumber: String(RUN + 10) } });
    expect(r).toMatchObject({ source: 'PHOTO', status: 'PENDING', photoFileId: 'BIG_PHOTO' });
  });

  it('bot: o\'qilmaydigan rasm → NEEDS_REVIEW (QR_UNREADABLE)', async () => {
    const blank = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#ddd' } }).jpeg().toBuffer();
    vi.spyOn(t.app.get(ReceiptsBotHandlers) as any, 'download').mockResolvedValueOnce(blank);
    await t.send(photoMessage(BASE + 5, 'BLANK'));
    const reply = t.calls.filter((c) => c.method === 'sendMessage').pop();
    expect(reply?.payload.text).toContain("o'qib bo'lmadi");
    const r = await prisma.receipt.findFirstOrThrow({ where: { photoFileId: 'BLANK', participant: { tgId: BigInt(BASE + 5) } } });
    expect(r).toMatchObject({ status: 'NEEDS_REVIEW', rejectCode: 'QR_UNREADABLE', fm: null });
  });

  it('photo-hint: bot chatga yo\'riqnoma yuboradi', async () => {
    const res = await fetch(`${t.baseUrl}/miniapp/photo-hint`, { method: 'POST', headers: { authorization: `tma ${initData(1)}` } });
    expect(res.status).toBe(200);
    const msg = t.calls.find((c) => c.method === 'sendMessage' && c.payload.chat_id === BASE + 1);
    expect(msg?.payload.text).toContain('rasmini shu yerga yuboring');
  });
});
