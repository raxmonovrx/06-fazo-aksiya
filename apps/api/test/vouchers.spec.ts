import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { signInitData } from '../src/core/init-data.js';
import { VouchersService } from '../src/vouchers/vouchers.service.js';
import { callback, contactMessage, createTestApp, textMessage } from './helpers.js';

const BASE = 9_500_000_000;
const TOKEN = process.env.BOT_TOKEN!;
const prisma = new PrismaClient();
const RUN = Math.floor(Math.random() * 1e6);
// 16.10.2026 12:00 Toshkent — aksiya (15.10) davomida
const NOW = new Date('2026-10-16T07:00:00Z');
const PW = 'parol12345';

const tg = (n: number) => BASE + n;
const lastText = (calls: Array<{ method: string; payload: any }>, chatId: number) =>
  [...calls].reverse().find((c) => c.method === 'sendMessage' && c.payload.chat_id === chatId)?.payload.text as string | undefined;

async function cleanup() {
  const ids = { gte: BigInt(BASE), lt: BigInt(BASE + 1000) };
  const ps = await prisma.participant.findMany({ where: { tgId: ids }, select: { id: true } });
  const pid = { in: ps.map((p) => p.id) };
  const admins = await prisma.adminUser.findMany({ where: { login: { startsWith: 'tv_' } }, select: { id: true } });
  const aid = { in: admins.map((a) => a.id) };
  await prisma.voucher.deleteMany({ where: { issuedById: aid } });
  await prisma.coupon.deleteMany({ where: { participantId: pid } });
  await prisma.receipt.deleteMany({ where: { participantId: pid } });
  await prisma.participant.deleteMany({ where: { tgId: ids } });
  await prisma.staffPhone.deleteMany({ where: { phone: { startsWith: '+99899500' } } });
  await prisma.auditLog.deleteMany({ where: { actorId: aid } });
  await prisma.adminUser.deleteMany({ where: { id: aid } });
}

describe('Vaucherlar (kassir QR)', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  const cookies: Record<string, string> = {};
  let fazoId: number;
  let leFazoId: number;

  const api = (who: string, path: string, init: { method?: string; json?: unknown } = {}) =>
    fetch(`${t.baseUrl}/admin${path}`, {
      method: init.method ?? 'GET',
      headers: { cookie: cookies[who] ?? '', ...(init.json !== undefined && { 'content-type': 'application/json' }) },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
  const issue = async (who: string, body: Record<string, unknown>) => (await api(who, '/vouchers', { method: 'POST', json: body })).json();
  const tokenOf = async (id: number) => (await prisma.voucher.findUniqueOrThrow({ where: { id } })).token;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    await cleanup();
    fazoId = (await prisma.branch.findFirstOrThrow({ where: { name: 'Fazo Restaurant' } })).id;
    leFazoId = (await prisma.branch.findFirstOrThrow({ where: { name: 'Le Fazo' } })).id;
    await prisma.branch.updateMany({ data: { minSum: 100000, couponPrice: 100000, maxPerReceipt: 10, isActive: true } });
    const hash = await bcrypt.hash(PW, 4);
    const users = [
      ['tv_admin', 'ADMIN', null],
      ['tv_op', 'OPERATOR', null],
      ['tv_kassa1', 'CASHIER', fazoId],
      ['tv_kassa2', 'CASHIER', leFazoId],
      ['tv_nobranch', 'CASHIER', null],
    ] as const;
    for (const [login, role, branchId] of users) {
      await prisma.adminUser.create({ data: { login: `${login}_${RUN}`, role, branchId, passwordHash: hash } });
    }
    // Ro'yxatdan o'tgan: 1, 2; xodim: 3; 4 — ro'yxatdan o'tmagan (keyin o'tadi)
    for (const n of [1, 2, 3]) {
      await prisma.participant.create({
        data: {
          tgId: BigInt(tg(n)),
          phone: `+99899500000${n}`,
          refCode: `V${RUN}${n}`.slice(0, 12),
          rulesAcceptedAt: new Date(),
          firstName: `Mijoz${n}`,
          isStaff: n === 3,
        },
      });
    }
    await prisma.staffPhone.create({ data: { phone: '+998995000003', name: 'Test xodim' } });
    t = await createTestApp();
    for (const [login] of users) {
      const res = await fetch(`${t.baseUrl}/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ login: `${login}_${RUN}`, password: PW }),
      });
      cookies[login] = res.headers.get('set-cookie')!.split(';')[0];
    }
  });
  afterAll(async () => {
    vi.useRealTimers();
    await t.app.close();
    await cleanup();
    await prisma.$disconnect();
  });
  beforeEach(() => {
    t.calls.length = 0;
    t.app.get(VouchersService).redeemLimiter.reset();
  });

  it('kassir chiqaradi: o\'z filiali, filial qoidasi bo\'yicha kupon, QR va havola', async () => {
    const v = await issue('tv_kassa1', { amount: 350000, branchId: leFazoId, customerPhone: '90 111 22 33', customerName: 'Ali' });
    expect(v).toMatchObject({ branchId: fazoId, couponsCount: 3, amount: 350000, customerPhone: '+998901112233', status: 'ISSUED' });
    expect(v.link).toMatch(/^https:\/\/t\.me\/FazoClub_bot\?start=v_[A-Za-z0-9_-]{22}$/);
    expect(v.qrSvg).toContain('<svg');
    expect(new Date(v.expiresAt).getTime() - NOW.getTime()).toBe(72 * 3600 * 1000);
    const audit = await prisma.auditLog.findFirst({ where: { action: 'voucher.issue', entityId: String(v.id) } });
    expect(audit).not.toBeNull();
  });

  it('chiqarish cheklovlari: summa kam, filialsiz kassir, operator, aksiyadan oldin', async () => {
    expect((await api('tv_kassa1', '/vouchers', { method: 'POST', json: { amount: 50000 } })).status).toBe(400);
    expect((await api('tv_nobranch', '/vouchers', { method: 'POST', json: { amount: 200000 } })).status).toBe(400);
    expect((await api('tv_admin', '/vouchers', { method: 'POST', json: { amount: 200000 } })).status).toBe(400);
    expect((await api('tv_op', '/vouchers', { method: 'POST', json: { amount: 200000, branchId: fazoId } })).status).toBe(403);
    expect((await api('tv_kassa1', '/vouchers', { method: 'POST', json: { amount: 200000, customerPhone: '123' } })).status).toBe(400);
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
    expect((await api('tv_kassa1', '/vouchers', { method: 'POST', json: { amount: 200000 } })).status).toBe(400);
    vi.setSystemTime(NOW);
    const admin = await issue('tv_admin', { amount: 200000, branchId: leFazoId });
    expect(admin).toMatchObject({ branchId: leFazoId, couponsCount: 2 });
  });

  it('kassir boshqa admin bo\'limlariga kira olmaydi', async () => {
    expect((await api('tv_kassa1', '/receipts')).status).toBe(403);
    expect((await api('tv_kassa1', '/dashboard')).status).toBe(403);
    expect((await api('tv_kassa1', '/participants')).status).toBe(403);
    const me = await (await api('tv_kassa1', '/auth/me')).json();
    expect(me).toMatchObject({ role: 'CASHIER', branch: { id: fazoId } });
  });

  it('bot: ro\'yxatdan o\'tgan mijoz skanerlaydi → kuponlar, skanerlagan akkaunt muhrlanadi', async () => {
    const v = await issue('tv_kassa1', { amount: 350000, customerPhone: '+998901112233' });
    const token = await tokenOf(v.id);
    await t.send(textMessage(tg(1), `/start v_${token}`));
    expect(lastText(t.calls, tg(1))).toContain('+3 kupon');

    const row = await prisma.voucher.findUniqueOrThrow({ where: { id: v.id }, include: { receipt: { include: { coupons: true } } } });
    expect(row).toMatchObject({
      status: 'REDEEMED',
      redeemedPhone: '+998995000001',
      redeemedTgId: BigInt(tg(1)),
      redeemedName: 'Test', // /start paytida Telegram profilidan yangilanadi
      phoneMismatch: true, // kassir boshqa raqam yozgan — bloklamaydi, faqat belgi
      redeemedByStaff: false,
    });
    expect(row.receipt).toMatchObject({ source: 'VOUCHER', status: 'APPROVED', couponsCount: 3, branchId: fazoId });
    expect(row.receipt!.coupons.map((c) => c.eligible)).toEqual([true, true, true]);

    // Takror: o'zi → ALREADY_YOURS, boshqa odam → USED
    await t.send(textMessage(tg(1), `/start v_${token}`));
    expect(lastText(t.calls, tg(1))).toContain('allaqachon ishlatgansiz');
    await t.send(textMessage(tg(2), `/start v_${token}`));
    expect(lastText(t.calls, tg(2))).toContain('allaqachon ishlatilgan');
    expect(await prisma.coupon.count({ where: { receiptId: row.receiptId! } })).toBe(3);
  });

  it('ro\'yxatdan o\'tmagan mijoz: QR saqlanadi, ro\'yxatdan o\'tgach kuponlar qo\'shiladi', async () => {
    const v = await issue('tv_kassa1', { amount: 200000 });
    const token = await tokenOf(v.id);
    await t.send(textMessage(tg(4), `/start v_${token}`));
    expect(t.calls.some((c) => c.method === 'sendMessage' && c.payload.chat_id === tg(4) && /QR qabul qilindi/.test(c.payload.text))).toBe(true);
    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(tg(4)) } });
    expect(p).toMatchObject({ pendingVoucher: token, source: 'voucher', startPayload: 'v_' });

    await t.send(contactMessage(tg(4), '998995000004'));
    await t.send(callback(tg(4), 'rules:accept'));
    expect(lastText(t.calls, tg(4))).toContain('+2 kupon');
    const after = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(tg(4)) } });
    expect(after.pendingVoucher).toBeNull();
    expect((await prisma.voucher.findUniqueOrThrow({ where: { id: v.id } })).redeemedById).toBe(after.id);
  });

  it('xodim skanerlasa: kuponlar o\'yinda emas, belgi va admin alert', async () => {
    const v = await issue('tv_kassa1', { amount: 150000 });
    await t.send(textMessage(tg(3), `/start v_${await tokenOf(v.id)}`));
    expect(lastText(t.calls, tg(3))).toContain("xodimlari o'yinda qatnashmaydi");
    const row = await prisma.voucher.findUniqueOrThrow({ where: { id: v.id }, include: { receipt: { include: { coupons: true } } } });
    expect(row.redeemedByStaff).toBe(true);
    expect(row.receipt!.coupons.every((c) => !c.eligible)).toBe(true);
    await vi.waitFor(() => {
      const alert = t.calls.find((c) => c.method === 'sendMessage' && String(c.payload.chat_id) === process.env.ADMIN_ALERT_CHAT_ID);
      expect(alert?.payload.text).toContain('Xodim vaucher skanerladi');
    });
  });

  it('muddat o\'tgan, bekor qilingan va yaroqsiz QR', async () => {
    const old = await issue('tv_kassa1', { amount: 150000 });
    vi.setSystemTime(new Date(NOW.getTime() + 73 * 3600 * 1000));
    await t.send(textMessage(tg(2), `/start v_${await tokenOf(old.id)}`));
    expect(lastText(t.calls, tg(2))).toContain("muddati o'tgan");
    vi.setSystemTime(NOW);

    const v = await issue('tv_kassa1', { amount: 150000 });
    // Boshqa kassir bekor qila olmaydi, chiqargan kassir — oladi
    expect((await api('tv_kassa2', `/vouchers/${v.id}/cancel`, { method: 'POST', json: { reason: 'xato' } })).status).toBe(403);
    expect((await api('tv_kassa1', `/vouchers/${v.id}/cancel`, { method: 'POST', json: { reason: "Noto'g'ri summa" } })).status).toBe(200);
    expect((await api('tv_kassa1', `/vouchers/${v.id}/cancel`, { method: 'POST', json: { reason: 'yana' } })).status).toBe(409);
    await t.send(textMessage(tg(2), `/start v_${await tokenOf(v.id)}`));
    expect(lastText(t.calls, tg(2))).toContain('bekor qilingan');

    await t.send(textMessage(tg(2), '/start v_AAAAAAAAAAAAAAAAAAAAAA'));
    expect(lastText(t.calls, tg(2))).toContain('yaroqsiz');
  });

  it('poyga: ikki kishi bir vaqtda skanerlasa — faqat bittasi oladi', async () => {
    const v = await issue('tv_kassa1', { amount: 500000 });
    const token = await tokenOf(v.id);
    const svc = t.app.get(VouchersService);
    const [p1, p2] = await Promise.all([1, 2].map((n) => prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(tg(n)) } })));
    const results = await Promise.all([svc.redeem(p1, token), svc.redeem(p2, token), svc.redeem(p1, token)]);
    expect(results.filter((r) => r.code === 'REDEEMED')).toHaveLength(1);
    const row = await prisma.voucher.findUniqueOrThrow({ where: { id: v.id } });
    expect(await prisma.coupon.count({ where: { receiptId: row.receiptId! } })).toBe(5);
    expect(await prisma.receipt.count({ where: { receiptNumber: `V${v.id}` } })).toBe(1);
  });

  it('mini app skaneri vaucher havolasini qabul qiladi', async () => {
    const v = await issue('tv_kassa2', { amount: 260000 });
    const initData = signInitData({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: tg(2) }) }, TOKEN);
    const res = await fetch(`${t.baseUrl}/miniapp/receipts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `tma ${initData}` },
      body: JSON.stringify({ text: v.link }),
    });
    expect(await res.json()).toMatchObject({ code: 'REDEEMED', couponsCount: 2, branchName: 'Le Fazo' });
  });

  it('bitta kassir bitta odamga ko\'p vaucher bersa — alert', async () => {
    for (let i = 0; i < 3; i++) {
      const v = await issue('tv_kassa2', { amount: 120000 });
      await t.send(textMessage(tg(1), `/start v_${await tokenOf(v.id)}`));
    }
    await vi.waitFor(() => {
      const alert = t.calls.find((c) => c.method === 'sendMessage' && /bitta odamga 3 ta vaucher/.test(c.payload.text ?? ''));
      expect(alert).toBeTruthy();
    });
  });

  it('ro\'yxat: kassir faqat o\'zinikini ko\'radi, token chiqmaydi, admin hammasini', async () => {
    const mine = await (await api('tv_kassa2', '/vouchers')).json();
    expect(mine.items.length).toBeGreaterThan(0);
    expect(mine.items.every((i: any) => i.issuedBy.login === `tv_kassa2_${RUN}`)).toBe(true);
    expect(mine.items.every((i: any) => !('token' in i))).toBe(true);
    const all = await (await api('tv_admin', '/vouchers?pageSize=200')).json();
    expect(all.total).toBeGreaterThan(mine.total);
    expect(all.summary.REDEEMED.count).toBeGreaterThan(0);
    const flagged = await (await api('tv_op', '/vouchers?flagged=true&pageSize=200')).json();
    expect(flagged.items.every((i: any) => i.phoneMismatch || i.redeemedByStaff)).toBe(true);
  });
});
