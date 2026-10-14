import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { ROLE_TEMPLATES } from '../src/admin/permissions.js';
import { VouchersService } from '../src/vouchers/vouchers.service.js';
import { createTestApp } from './helpers.js';

const BASE = 9_300_000_000;
const prisma = new PrismaClient();
const RUN = Math.floor(Math.random() * 1e6) * 100;
const NOW = new Date('2026-10-16T07:00:00Z'); // 16.10.2026 12:00 Toshkent
const ADMIN_LOGIN = `t_admin_${RUN}`;
const OP_LOGIN = `t_op_${RUN}`;
const KASSA_LOGIN = `t_kassa_${RUN}`;

async function cleanup() {
  const ids = { gte: BigInt(BASE), lt: BigInt(BASE + 1000) };
  const ps = await prisma.participant.findMany({ where: { tgId: ids }, select: { id: true } });
  const pid = { in: ps.map((p) => p.id) };
  const admins = await prisma.adminUser.findMany({ where: { login: { startsWith: 't_' } }, select: { id: true } });
  const aid = { in: admins.map((a) => a.id) };
  await prisma.voucher.deleteMany({ where: { issuedById: aid } });
  await prisma.coupon.deleteMany({ where: { participantId: pid } });
  await prisma.receipt.deleteMany({ where: { participantId: pid } });
  await prisma.participant.deleteMany({ where: { tgId: ids } });
  await prisma.auditLog.deleteMany({ where: { actorId: aid } });
  await prisma.adminUser.deleteMany({ where: { id: aid } });
}

describe('Admin panel API', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  const cookies: Record<'admin' | 'op' | 'kassa', string> = { admin: '', op: '', kassa: '' };
  let fazoId: number;

  const api = (path: string, init: { method?: string; json?: unknown; as?: keyof typeof cookies | 'none' } = {}) =>
    fetch(`${t.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.json !== undefined && { 'content-type': 'application/json' }),
        ...(init.as !== 'none' && { cookie: cookies[init.as ?? 'admin'] }),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
  const login = async (l: string, password = 'parol12345') =>
    api('/admin/auth/login', { method: 'POST', json: { login: l, password }, as: 'none' });

  /** Kassir QR chiqaradi, n-chi ishtirokchi skanerlaydi */
  const redeem = async (n: number, amount: number) => {
    const v = await (await api('/admin/vouchers', { method: 'POST', json: { amount }, as: 'kassa' })).json();
    const { token } = await prisma.voucher.findUniqueOrThrow({ where: { id: v.id } });
    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(BASE + n) } });
    return t.app.get(VouchersService).redeem(p, token);
  };

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    await cleanup();
    fazoId = (await prisma.branch.findFirstOrThrow({ where: { name: 'Fazo Restaurant' } })).id;
    await prisma.branch.update({ where: { id: fazoId }, data: { minSum: 100000, couponPrice: 100000, maxPerReceipt: 10, isActive: true } });
    const hash = await bcrypt.hash('parol12345', 4);
    await prisma.adminUser.create({ data: { login: ADMIN_LOGIN, passwordHash: hash, role: 'ADMIN' } });
    await prisma.adminUser.create({ data: { login: OP_LOGIN, passwordHash: hash, role: 'OPERATOR', permissions: [...ROLE_TEMPLATES.OPERATOR] } });
    await prisma.adminUser.create({
      data: { login: KASSA_LOGIN, passwordHash: hash, role: 'CASHIER', branchId: fazoId, permissions: [...ROLE_TEMPLATES.CASHIER] },
    });
    for (const n of [1, 2]) {
      await prisma.participant.create({
        data: {
          tgId: BigInt(BASE + n),
          phone: `+99899300${String(n).padStart(4, '0')}`,
          refCode: `A${RUN}${n}`.slice(0, 12),
          rulesAcceptedAt: new Date(),
        },
      });
    }
    t = await createTestApp();
  });
  afterAll(async () => {
    vi.useRealTimers();
    await t.app.close();
    await cleanup();
    await prisma.$disconnect();
  });

  it('login: noto\'g\'ri parol 401, to\'g\'ri — cookie', async () => {
    expect((await login(ADMIN_LOGIN, 'xato')).status).toBe(401);
    const res = await login(ADMIN_LOGIN);
    expect(res.status).toBe(200);
    cookies.admin = res.headers.get('set-cookie')!.split(';')[0];
    expect(cookies.admin).toMatch(/^fc_admin=/);
    cookies.op = (await login(OP_LOGIN)).headers.get('set-cookie')!.split(';')[0];
    cookies.kassa = (await login(KASSA_LOGIN)).headers.get('set-cookie')!.split(';')[0];
    expect((await (await api('/admin/auth/me')).json()).role).toBe('ADMIN');
  });

  it('himoya: cookie\'siz 401, operator filial o\'zgartira olmaydi 403', async () => {
    expect((await api('/admin/dashboard', { as: 'none' })).status).toBe(401);
    expect((await api(`/admin/branches/${fazoId}`, { method: 'PATCH', json: { minSum: 1 }, as: 'op' })).status).toBe(403);
    expect((await api('/admin/dashboard', { as: 'op' })).status).toBe(200);
  });

  it('eski iiko/fiskal endpoint\'lar yo\'q', async () => {
    for (const path of ['/admin/receipts', '/admin/import/batches', '/admin/unknown-fms', '/admin/jobs/nightly']) {
      expect((await api(path)).status).toBe(404);
    }
  });

  it('xodim deb belgilansa — kuponlari o\'yindan chiqadi, qaytarilsa — qaytadi', async () => {
    expect((await redeem(1, 300000)).code).toBe('REDEEMED');
    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(BASE + 1) } });
    const eligible = () => prisma.coupon.count({ where: { participantId: p.id, eligible: true } });
    expect(await eligible()).toBe(3);
    await api(`/admin/participants/${p.id}`, { method: 'PATCH', json: { isStaff: true } });
    expect(await eligible()).toBe(0);
    await api(`/admin/participants/${p.id}`, { method: 'PATCH', json: { isStaff: false } });
    expect(await eligible()).toBe(3);
  });

  it('ro\'yxatlar, dashboard va eksport', async () => {
    await redeem(2, 200000);
    await api('/admin/vouchers', { method: 'POST', json: { amount: 150000 }, as: 'kassa' }); // skanerlanmagan

    const parts = await (await api('/admin/participants?q=993000001')).json();
    expect(parts.items[0].phone).toBe('+998993000001');

    const dash = await (await api('/admin/dashboard')).json();
    expect(dash.participants.total).toBeGreaterThanOrEqual(2);
    expect(dash.vouchers.issuedToday).toBeGreaterThanOrEqual(3);
    expect(dash.vouchers.redeemedToday).toBeGreaterThanOrEqual(2);
    expect(dash.vouchers.byState.ISSUED).toBeGreaterThanOrEqual(1);
    const fazo = dash.branches.find((b: any) => b.id === fazoId);
    expect(fazo.coupons).toBeGreaterThanOrEqual(5);
    expect(fazo.amount).toBeGreaterThanOrEqual(500000);

    for (const kind of ['participants.xlsx', 'coupons.xlsx', 'vouchers.csv']) {
      const res = await api(`/admin/export/${kind}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain(`fazo-group-${kind.split('.')[0]}`);
      expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(100);
    }
    expect((await api('/admin/export/receipts.csv')).status).toBe(404);
    expect((await api('/admin/export/coupons.xlsx', { as: 'op' })).status).toBe(403);
  });
});
