import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { ROLE_TEMPLATES } from '../src/admin/permissions.js';
import { VouchersService } from '../src/vouchers/vouchers.service.js';
import { contactMessage, createTestApp, textMessage } from './helpers.js';

const BASE = 9_600_000_000;
const prisma = new PrismaClient();
const RUN = Math.floor(Math.random() * 1e6);
// 16.10.2026 12:00 Toshkent — aksiya davomida
const NOW = new Date('2026-10-16T07:00:00Z');
const PW = 'parol12345';
const tg = (n: number) => BASE + n;
const phone = (n: number) => `99896${String(n).padStart(7, '0')}`;

async function cleanup() {
  const ids = { gte: BigInt(BASE), lt: BigInt(BASE + 1000) };
  const ps = await prisma.participant.findMany({ where: { tgId: ids }, select: { id: true } });
  const pid = { in: ps.map((p) => p.id) };
  const admins = await prisma.adminUser.findMany({ where: { login: { startsWith: 'tr_' } }, select: { id: true } });
  const aid = { in: admins.map((a) => a.id) };
  await prisma.voucher.deleteMany({ where: { issuedById: aid } });
  await prisma.coupon.deleteMany({ where: { participantId: pid } });
  await prisma.receipt.deleteMany({ where: { participantId: pid } });
  await prisma.participant.updateMany({ where: { tgId: ids }, data: { referredById: null } });
  await prisma.participant.deleteMany({ where: { tgId: ids } });
  await prisma.staffPhone.deleteMany({ where: { phone: { startsWith: '+99896' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: aid } });
  await prisma.adminUser.deleteMany({ where: { id: aid } });
}

describe('Taklif bonusi', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  const cookies: Record<string, string> = {};
  let savedSetting: unknown;

  const api = (who: string, path: string, init: { method?: string; json?: unknown } = {}) =>
    fetch(`${t.baseUrl}/admin${path}`, {
      method: init.method ?? 'GET',
      headers: { cookie: cookies[who] ?? '', ...(init.json !== undefined && { 'content-type': 'application/json' }) },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
  const texts = (chatId: number) =>
    t.calls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === chatId).map((c) => c.payload.text as string);
  const bonusCoupons = async (n: number) => {
    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(tg(n)) } });
    return prisma.coupon.count({ where: { participantId: p.id, receipt: { source: 'REFERRAL' } } });
  };
  /** Kassir QR chiqaradi, n-chi foydalanuvchi skanerlaydi */
  const scan = async (n: number, amount = 200000) => {
    const v = await (await api('tr_kassa', '/vouchers', { method: 'POST', json: { amount } })).json();
    const { token } = await prisma.voucher.findUniqueOrThrow({ where: { id: v.id } });
    await t.send(textMessage(tg(n), `/start v_${token}`));
  };
  /** n-chi foydalanuvchi ro'yxatdan o'tadi (inviter berilsa — uning havolasi orqali) */
  const register = async (n: number, inviter?: number) => {
    const ref = inviter ? (await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(tg(inviter)) } })).refCode : null;
    await t.send(textMessage(tg(n), ref ? `/start ref_${ref}` : '/start'));
    await t.send(contactMessage(tg(n), phone(n)));
  };
  const setCfg = (json: Record<string, unknown>) => api('tr_admin', '/settings/referral', { method: 'PATCH', json });

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    await cleanup();
    savedSetting = (await prisma.setting.findUnique({ where: { key: 'referral' } }))?.value;
    await prisma.setting.deleteMany({ where: { key: 'referral' } });
    const fazo = await prisma.branch.findFirstOrThrow({ where: { name: 'Fazo Restaurant' } });
    await prisma.branch.update({ where: { id: fazo.id }, data: { minSum: 100000, couponPrice: 100000, maxPerReceipt: 10, isActive: true } });
    const hash = await bcrypt.hash(PW, 4);
    const users = [
      ['tr_admin', 'ADMIN', null],
      ['tr_op', 'OPERATOR', null],
      ['tr_kassa', 'CASHIER', fazo.id],
    ] as const;
    for (const [login, role, branchId] of users) {
      await prisma.adminUser.create({
        data: { login: `${login}_${RUN}`, role, branchId, permissions: [...ROLE_TEMPLATES[role]], passwordHash: hash },
      });
    }
    t = await createTestApp();
    for (const [login] of users) {
      const res = await fetch(`${t.baseUrl}/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: `${login}_${RUN}`, password: PW }),
      });
      cookies[login] = res.headers.get('set-cookie')!.split(';')[0];
    }
    await register(1); // taklif qiluvchi
  });
  afterAll(async () => {
    vi.useRealTimers();
    await t.app.close();
    await cleanup();
    await prisma.setting.deleteMany({ where: { key: 'referral' } });
    if (savedSetting !== undefined) await prisma.setting.create({ data: { key: 'referral', value: savedSetting as object } });
    await prisma.$disconnect();
  });
  beforeEach(() => {
    t.calls.length = 0;
    t.app.get(VouchersService).redeemLimiter.reset();
  });

  it('sozlamalar: standart qiymatlar, faqat «settings» ruxsati bilan o\'zgaradi', async () => {
    expect(await (await api('tr_admin', '/settings/referral')).json()).toMatchObject({
      settings: { enabled: true, couponsPerFriend: 1, monthlyCap: 10 },
    });
    expect((await api('tr_op', '/settings/referral')).status).toBe(403);
    expect((await setCfg({ monthlyCap: 0 })).status).toBe(400);
  });

  it('bosh xabarda taklif haqida eslatma bor', async () => {
    await t.send(textMessage(tg(1), 'salom'));
    expect(texts(tg(1)).at(-1)).toContain('birinchi xaridini qilsa, sizga <b>+1 kupon</b>');
  });

  it('havola bosish va ro\'yxatdan o\'tish bonus bermaydi — faqat do\'stning birinchi xaridi', async () => {
    await register(2, 1);
    expect(await bonusCoupons(1)).toBe(0);

    t.calls.length = 0;
    await scan(2);
    expect(await bonusCoupons(1)).toBe(1);
    expect(texts(tg(1)).at(-1)).toMatch(/Do'stingiz Test birinchi xaridini qildi — <b>\+1 bonus kupon<\/b>/);
    const r = await prisma.receipt.findFirstOrThrow({ where: { participant: { tgId: BigInt(tg(1)) }, source: 'REFERRAL' } });
    expect(r).toMatchObject({ status: 'APPROVED', amount: null, couponsCount: 1 });

    // Ikkinchi xarid — yana bonus yo'q
    await scan(2);
    expect(await bonusCoupons(1)).toBe(1);
  });

  it('do\'stning birinchi xaridi bekor qilinsa — taklif bonusi ham qaytariladi, tiklansa — qaytadi', async () => {
    const inviter = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(tg(1)) } });
    const friend = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(tg(2)) } });
    const bonus = () => prisma.coupon.count({ where: { participantId: inviter.id, eligible: true, receipt: { source: 'REFERRAL' } } });
    expect(await bonus()).toBe(1);
    const [first, second] = await prisma.voucher.findMany({ where: { redeemedById: friend.id }, orderBy: { id: 'asc' } });
    const post = (path: string, json?: unknown) => api('tr_admin', path, { method: 'POST', json });

    // Do'stning yana bitta haqiqiy xaridi bor — bonus qoladi
    expect((await post(`/vouchers/${first.id}/revoke`, { reason: 'Soxta QR' })).status).toBe(200);
    expect(await bonus()).toBe(1);
    // Hammasi bekor — bonus ham qaytadi
    expect((await post(`/vouchers/${second.id}/revoke`, { reason: 'Soxta QR' })).status).toBe(200);
    expect(await bonus()).toBe(0);
    // Bittasi tiklansa — bonus qaytadi
    expect((await post(`/vouchers/${first.id}/restore`)).status).toBe(200);
    expect(await bonus()).toBe(1);
    expect((await post(`/vouchers/${second.id}/restore`)).status).toBe(200);
  });

  it('havolasiz kelgan, xodim do\'st va xodim taklif qiluvchi — bonus yo\'q', async () => {
    await register(3); // havolasiz
    await scan(3);
    await prisma.staffPhone.create({ data: { phone: `+${phone(4)}`, name: 'Xodim' } });
    await register(4, 1); // xodim do'st
    await scan(4);
    expect(await bonusCoupons(1)).toBe(1);

    await prisma.staffPhone.create({ data: { phone: `+${phone(5)}`, name: 'Xodim 2' } });
    await register(5); // xodim taklif qiluvchi
    await register(6, 5);
    await scan(6);
    expect(await bonusCoupons(5)).toBe(0);
  });

  it('oylik chegara va o\'chirib qo\'yish', async () => {
    await setCfg({ monthlyCap: 2 });
    await register(7, 1);
    await scan(7);
    expect(await bonusCoupons(1)).toBe(2);
    await register(8, 1);
    await scan(8);
    expect(await bonusCoupons(1)).toBe(2); // chegara

    // Oldingi bonuslar o'tgan oyda bo'lsa — bu oy yana beriladi
    await prisma.receipt.updateMany({
      where: { participant: { tgId: BigInt(tg(1)) }, source: 'REFERRAL' },
      data: { createdAt: new Date('2026-09-20T07:00:00Z') },
    });
    await register(9, 1);
    await scan(9);
    expect(await bonusCoupons(1)).toBe(3);

    await setCfg({ enabled: false });
    await register(10, 1);
    await scan(10);
    expect(await bonusCoupons(1)).toBe(3);
    // O'chiq paytda birinchi xaridini qilgan do'st keyin ham bonus bermaydi
    await setCfg({ enabled: true, monthlyCap: 10 });
    await scan(10);
    expect(await bonusCoupons(1)).toBe(3);
  });

  it('statistika', async () => {
    const stats = (await (await api('tr_admin', '/settings/referral')).json()).stats;
    expect(stats.rewarded).toBeGreaterThanOrEqual(3);
    expect(stats.coupons).toBeGreaterThanOrEqual(3);
    expect(stats.invited).toBeGreaterThanOrEqual(7);
  });
});
