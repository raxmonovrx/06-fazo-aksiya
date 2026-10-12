import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

import { signInitData } from '../src/core/init-data.js';
import { ReceiptsService } from '../src/receipts/receipts.service.js';
import { createTestApp } from './helpers.js';

const BASE = 9_300_000_000;
const TOKEN = process.env.BOT_TOKEN!;
const prisma = new PrismaClient();
const RUN = Math.floor(Math.random() * 1e6) * 100;
const FM = 'LG420230613349';
const NEW_FM = `ZZTEST${String(RUN).padStart(8, '0')}`.slice(0, 14);
const NOW = new Date('2026-10-16T07:00:00Z'); // 16.10.2026 12:00 Toshkent
const ADMIN_LOGIN = `t_admin_${RUN}`;
const OP_LOGIN = `t_op_${RUN}`;

const qr = (r: number, fm = FM, c = '20261016100000') =>
  `https://ofd.soliq.uz/check?t=${fm}&r=${RUN + r}&c=${c}&s=047808378930`;

async function cleanup() {
  const ids = { gte: BigInt(BASE), lt: BigInt(BASE + 1000) };
  const ps = await prisma.participant.findMany({ where: { tgId: ids }, select: { id: true } });
  const pid = { in: ps.map((p) => p.id) };
  await prisma.coupon.deleteMany({ where: { participantId: pid } });
  await prisma.scanLog.deleteMany({ where: { participantId: pid } });
  await prisma.receipt.deleteMany({ where: { participantId: pid } });
  await prisma.participant.deleteMany({ where: { tgId: ids } });
  await prisma.saleRecord.deleteMany({ where: { OR: [{ receiptNumber: { startsWith: String(RUN).slice(0, 4) } }, { fm: NEW_FM }] } });
  await prisma.fiscalDevice.deleteMany({ where: { fm: { startsWith: 'ZZTEST' } } });
  await prisma.unknownFm.deleteMany({ where: { fm: { startsWith: 'ZZTEST' } } });
  await prisma.staffPhone.deleteMany({ where: { phone: { startsWith: '+99899300' } } });
  // Saqlangan mapping avtomatik taxminni tekshirishga xalaqit bermasin
  await prisma.setting.deleteMany({ where: { key: 'excel_mapping' } });
  const admins = await prisma.adminUser.findMany({ where: { login: { startsWith: 't_' } }, select: { id: true } });
  const aid = { in: admins.map((a) => a.id) };
  await prisma.auditLog.deleteMany({ where: { actorId: aid } });
  await prisma.importBatch.deleteMany({ where: { createdById: aid } });
  await prisma.adminUser.deleteMany({ where: { id: aid } });
}

describe('Admin panel API + solishtirish', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;
  let cookie = '';
  let opCookie = '';
  let fazoId: number;

  const api = (path: string, init: RequestInit & { json?: unknown; as?: 'op' | 'none' } = {}) =>
    fetch(`${t.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.json !== undefined && { 'content-type': 'application/json' }),
        ...(init.as === 'none' ? {} : { cookie: init.as === 'op' ? opCookie : cookie }),
        ...(init.headers as Record<string, string>),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });

  const submit = (n: number, text: string) =>
    fetch(`${t.baseUrl}/miniapp/receipts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `tma ${signInitData({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: BASE + n }) }, TOKEN)}`,
      },
      body: JSON.stringify({ text }),
    }).then((r) => r.json());

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
    await cleanup();
    const hash = await bcrypt.hash('parol12345', 4);
    await prisma.adminUser.create({ data: { login: ADMIN_LOGIN, passwordHash: hash, role: 'ADMIN' } });
    await prisma.adminUser.create({ data: { login: OP_LOGIN, passwordHash: hash, role: 'OPERATOR' } });
    for (const n of [1, 2, 3]) {
      await prisma.participant.create({
        data: {
          tgId: BigInt(BASE + n),
          phone: `+99899300${String(n).padStart(4, '0')}`,
          refCode: `A${RUN}${n}`.slice(0, 12),
          rulesAcceptedAt: new Date(),
        },
      });
    }
    fazoId = (await prisma.fiscalDevice.findUniqueOrThrow({ where: { fm: FM } })).branchId;
    await prisma.branch.update({ where: { id: fazoId }, data: { minSum: 100000, couponPrice: 100000, maxPerReceipt: 10, isActive: true } });
    t = await createTestApp();
  });
  afterAll(async () => {
    vi.useRealTimers();
    await t.app.close();
    await cleanup();
    await prisma.$disconnect();
  });
  beforeEach(() => {
    t.app.get(ReceiptsService).perMinute.reset();
  });

  it('login: noto\'g\'ri parol 401, to\'g\'ri — cookie', async () => {
    expect((await api('/admin/auth/login', { method: 'POST', json: { login: ADMIN_LOGIN, password: 'xato' }, as: 'none' })).status).toBe(401);
    const res = await api('/admin/auth/login', { method: 'POST', json: { login: ADMIN_LOGIN, password: 'parol12345' }, as: 'none' });
    expect(res.status).toBe(200);
    cookie = res.headers.get('set-cookie')!.split(';')[0];
    expect(cookie).toMatch(/^fc_admin=/);
    const op = await api('/admin/auth/login', { method: 'POST', json: { login: OP_LOGIN, password: 'parol12345' }, as: 'none' });
    opCookie = op.headers.get('set-cookie')!.split(';')[0];
    expect((await (await api('/admin/auth/me')).json()).role).toBe('ADMIN');
  });

  it('himoya: cookie\'siz 401, operator filial o\'zgartira olmaydi 403', async () => {
    expect((await api('/admin/dashboard', { as: 'none' })).status).toBe(401);
    expect((await api(`/admin/branches/${fazoId}`, { method: 'PATCH', json: { minSum: 1 }, as: 'op' })).status).toBe(403);
    expect((await api('/admin/dashboard', { as: 'op' })).status).toBe(200);
  });

  it('Excel import → PENDING cheklar summa bilan tasdiqlanadi → kuponlar formula bo\'yicha', async () => {
    // 1: 350 000 → 3 kupon; 2: 8 000 → BELOW_MIN; 3 (xodim emas, boshqa ishtirokchi): 25 mln → 10 (max)
    expect((await submit(1, qr(1))).code).toBe('ACCEPTED');
    expect((await submit(1, qr(2))).code).toBe('ACCEPTED');
    expect((await submit(2, qr(3))).code).toBe('ACCEPTED');

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('OLAP');
    ws.addRow(['Отчет по продажам за 16.10.2026']);
    ws.addRow(['Торговое предприятие', 'Номер чека', 'ФМ', 'Время закрытия', 'Сумма со скидкой']);
    ws.addRow(['Fazo Family Restauraunt', RUN + 1, FM, '16.10.2026 10:01:10', '350 000']);
    ws.addRow(['Fazo Family Restauraunt', RUN + 2, FM, '16.10.2026 09:59:00', 8000]);
    ws.addRow(['Fazo Family Restauraunt', RUN + 3, FM, '16.10.2026 10:00:30', 25_000_000]);
    ws.addRow(['Fazo Family Restauraunt', RUN + 99, FM, '16.10.2026 11:00:00', 120_000]);
    const fd = new FormData();
    fd.append('file', new Blob([await wb.xlsx.writeBuffer()]), 'olap.xlsx');

    const preview = await (await api('/admin/import/preview', { method: 'POST', body: fd })).json();
    expect(preview.headers).toContain('Номер чека');
    expect(preview.totalRows).toBe(4);
    // Avtomatik taxmin: iiko rus nomlari
    expect(preview.mapping).toMatchObject({ receiptNumber: 1, fm: 2, closedAt: 3, amount: 4, branch: 0 });

    const res = await (
      await api('/admin/import/commit', {
        method: 'POST',
        json: { token: preview.token, mapping: preview.mapping, defaultBranchId: null },
      })
    ).json();
    expect(res).toMatchObject({ rows: 4, inserted: 4, matched: 3 });

    const byNum = async (n: number) =>
      prisma.receipt.findFirstOrThrow({ where: { receiptNumber: String(RUN + n) }, include: { coupons: true } });
    const r1 = await byNum(1);
    expect(r1).toMatchObject({ status: 'APPROVED', couponsCount: 3 });
    expect(Number(r1.amount)).toBe(350000);
    expect(r1.coupons.map((c) => c.eligible)).toEqual([true, true, true]);
    expect(await byNum(2)).toMatchObject({ status: 'BELOW_MIN', couponsCount: 0 });
    expect(await byNum(3)).toMatchObject({ status: 'APPROVED', couponsCount: 10 });

    // Qayta import — takror yozuv va takror kupon yo'q
    const fd2 = new FormData();
    fd2.append('file', new Blob([await wb.xlsx.writeBuffer()]), 'olap.xlsx');
    const p2 = await (await api('/admin/import/preview', { method: 'POST', body: fd2 })).json();
    const res2 = await (await api('/admin/import/commit', { method: 'POST', json: { token: p2.token, mapping: p2.mapping } })).json();
    expect(res2).toMatchObject({ inserted: 0, duplicates: 4 });
    expect((await byNum(1)).coupons).toHaveLength(3);
  });

  it('savdo yozuvi oldin bo\'lsa — yangi chek darhol tasdiqlanadi', async () => {
    const body = await submit(1, qr(99, FM, '20261016110000'));
    expect(body.code).toBe('ACCEPTED');
    // Mini app natija oynasi darhol yakuniy holatni ko'radi
    expect(body.receipt).toMatchObject({ status: 'APPROVED', couponsCount: 1, amount: 120000, branchName: 'Fazo Restaurant' });
    const r = await prisma.receipt.findUniqueOrThrow({ where: { id: body.receipt.id } });
    expect(r).toMatchObject({ status: 'APPROVED', couponsCount: 1 });
  });

  it('xodim deb belgilansa — kuponlari o\'yindan chiqadi', async () => {
    const res = await api('/admin/staff/import', { method: 'POST', json: { text: 'telefon;ism\n+998 99 300 00 02;Test Xodim\nnotogri' } });
    const body = await res.json();
    expect(body).toMatchObject({ imported: 1, participantsUpdated: 1 });
    expect(body.invalid).toEqual(['notogri']);
    const p = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(BASE + 2) }, include: { coupons: true } });
    expect(p.isStaff).toBe(true);
    expect(p.coupons.every((c) => !c.eligible)).toBe(true);
  });

  it('refund import qilinsa — tasdiqlangan chek REJECTED, kuponlar eligible=false', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('R');
    ws.addRow(['Номер чека', 'ФМ', 'Время закрытия', 'Сумма со скидкой', 'Возврат']);
    ws.addRow([RUN + 1, FM, '16.10.2026 10:30:00', 350000, 'Да']);
    const fd = new FormData();
    fd.append('file', new Blob([await wb.xlsx.writeBuffer()]), 'refund.xlsx');
    const p = await (await api('/admin/import/preview', { method: 'POST', body: fd })).json();
    expect(p.mapping.refund).toBe(4);
    await api('/admin/import/commit', { method: 'POST', json: { token: p.token, mapping: p.mapping } });
    const r = await prisma.receipt.findFirstOrThrow({ where: { receiptNumber: String(RUN + 1) }, include: { coupons: true } });
    expect(r).toMatchObject({ status: 'REJECTED', rejectCode: 'REFUND' });
    expect(r.coupons.every((c) => !c.eligible)).toBe(true);
  });

  it('noma\'lum FM → moderatsiya; FM filialga qo\'shilgach chek PENDING bo\'ladi', async () => {
    const body = await submit(3, qr(50, NEW_FM));
    expect(body.code).toBe('REVIEW');
    const unknown = await (await api('/admin/unknown-fms')).json();
    expect(unknown.map((u: any) => u.fm)).toContain(NEW_FM);

    const dev = await (await api(`/admin/branches/${fazoId}/devices`, { method: 'POST', json: { fm: NEW_FM, note: 'test' } })).json();
    expect(dev.released).toBe(1);
    const r = await prisma.receipt.findUniqueOrThrow({ where: { id: body.receipt.id } });
    expect(r).toMatchObject({ status: 'PENDING', branchId: fazoId, rejectCode: null });
    expect((await api(`/admin/branches/${fazoId}/devices`, { method: 'POST', json: { fm: NEW_FM } })).status).toBe(409);
  });

  it('moderator: tasdiqlash (summa bilan) va rad etish, audit yoziladi', async () => {
    const pending = await prisma.receipt.findFirstOrThrow({ where: { fm: NEW_FM } });
    const ok = await (await api(`/admin/receipts/${pending.id}/approve`, { method: 'POST', as: 'op', json: { amount: 230000, branchId: fazoId } })).json();
    expect(ok.status).toBe('APPROVED');
    const again = await api(`/admin/receipts/${pending.id}/approve`, { method: 'POST', json: { amount: 230000, branchId: fazoId } });
    expect(again.status).toBe(409);

    const detail = await (await api(`/admin/receipts/${pending.id}`)).json();
    expect(detail.coupons).toHaveLength(2);
    expect(detail.audit[0]).toMatchObject({ action: 'receipt.approve' });

    const rej = await (await api(`/admin/receipts/${pending.id}/reject`, { method: 'POST', json: { reason: 'Soxta chek' } })).json();
    expect(rej.status).toBe('REJECTED');
    const c = await prisma.coupon.findMany({ where: { receiptId: pending.id } });
    expect(c.every((x) => !x.eligible)).toBe(true);
  });

  it('qo\'lda kiritish (MANUAL) summa bilan → darhol APPROVED', async () => {
    const res = await (
      await api('/admin/receipts/manual', {
        method: 'POST',
        as: 'op',
        json: { phone: '+998 99 300 00 03', fm: FM, receiptNumber: String(RUN + 70), fiscalAt: '16.10.2026 11:40', amount: 520000 },
      })
    ).json();
    expect(res.status).toBe('APPROVED');
    const r = await prisma.receipt.findUniqueOrThrow({ where: { id: res.id } });
    expect(r).toMatchObject({ source: 'MANUAL', couponsCount: 5 });
    const dup = await api('/admin/receipts/manual', {
      method: 'POST',
      json: { phone: '+998993000003', fm: FM, receiptNumber: String(RUN + 70), fiscalAt: '16.10.2026 11:40' },
    });
    expect(dup.status).toBe(409);
  });

  it('ro\'yxatlar, dashboard va eksport', async () => {
    const list = await (await api(`/admin/receipts?status=APPROVED,BELOW_MIN&phone=99300`)).json();
    expect(list.total).toBeGreaterThanOrEqual(3);
    const parts = await (await api('/admin/participants?q=993000001')).json();
    expect(parts.items[0].phone).toBe('+998993000001');
    const dash = await (await api('/admin/dashboard')).json();
    expect(dash.participants.total).toBeGreaterThanOrEqual(3);
    expect(dash.branches.find((b: any) => b.id === fazoId).coupons).toBeGreaterThan(0);

    for (const kind of ['participants.xlsx', 'coupons.xlsx', 'receipts.csv']) {
      const res = await api(`/admin/export/${kind}`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain(kind.split('.')[0]);
      expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(100);
    }
    expect((await api('/admin/export/coupons.xlsx', { as: 'op' })).status).toBe(403);
  });
});
