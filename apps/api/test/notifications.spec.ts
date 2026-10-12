import { GrammyError } from 'grammy';
import { PrismaClient } from '@prisma/client';

import { NotificationsService } from '../src/jobs/notifications.service.js';
import { createTestApp } from './helpers.js';

const BASE = 9_400_000_000;
const prisma = new PrismaClient();
const RUN = Math.floor(Math.random() * 1e6) * 100;

async function cleanup() {
  const ids = { gte: BigInt(BASE), lt: BigInt(BASE + 1000) };
  const ps = await prisma.participant.findMany({ where: { tgId: ids }, select: { id: true } });
  const pid = { in: ps.map((p) => p.id) };
  await prisma.notification.deleteMany({ where: { participantId: pid } });
  await prisma.coupon.deleteMany({ where: { participantId: pid } });
  await prisma.receipt.deleteMany({ where: { participantId: pid } });
  await prisma.participant.deleteMany({ where: { tgId: ids } });
}

describe('Ertalabki bildirishnomalar', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    await cleanup();
    t = await createTestApp();
    const branch = await prisma.branch.findFirstOrThrow({ where: { name: 'Fazo Restaurant' } });
    const campaign = await prisma.campaign.findFirstOrThrow();
    for (const n of [1, 2]) {
      const p = await prisma.participant.create({
        data: { tgId: BigInt(BASE + n), phone: `+99899400${String(n).padStart(4, '0')}`, refCode: `N${RUN}${n}`.slice(0, 12), rulesAcceptedAt: new Date() },
      });
      const r = await prisma.receipt.create({
        data: {
          participantId: p.id, fm: 'LG420230613349', receiptNumber: String(RUN + n), fiscalAt: new Date('2026-10-16T15:00:00Z'),
          source: 'QR', status: 'APPROVED', amount: 250000, couponsCount: 2, branchId: branch.id, decidedAt: new Date(),
        },
      });
      await prisma.coupon.createMany({ data: [1, 2].map(() => ({ campaignId: campaign.id, participantId: p.id, receiptId: r.id })) });
    }
    // Rad etilgan (skanerda darhol aytilgan) — xabarga kirmasligi kerak
    const p1 = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(BASE + 1) } });
    await prisma.receipt.create({
      data: { participantId: p1.id, fm: 'LG420230613349', receiptNumber: String(RUN + 50), source: 'QR', status: 'REJECTED', decidedAt: new Date(), notifiedAt: new Date(), rejectReason: 'x' },
    });
  });
  afterAll(async () => {
    await t.app.close();
    await cleanup();
    await prisma.$disconnect();
  });

  it('har mijozga bitta xabar; bot bloklagan foydalanuvchi belgilanadi; takror yuborilmaydi', async () => {
    const svc = t.app.get(NotificationsService);
    const blockedChat = BASE + 2;
    t.bot.api.config.use(async (prev, method, payload, signal) => {
      if (method === 'sendMessage' && (payload as { chat_id: number }).chat_id === blockedChat) {
        throw new GrammyError('Forbidden', { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }, method, payload);
      }
      return prev(method, payload, signal);
    });

    expect(await svc.queueDaily()).toBeGreaterThanOrEqual(2);
    const stats = await svc.sendPending();
    expect(stats.blocked).toBe(1);
    expect(stats.sent).toBeGreaterThanOrEqual(1);

    const sent = t.calls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === BASE + 1);
    expect(sent).toHaveLength(1);
    expect(sent[0].payload.text).toContain("2 ta kupon qo'shildi");
    expect(sent[0].payload.text).toContain('Jami kuponlaringiz: <b>2 ta</b>');

    const p2 = await prisma.participant.findUniqueOrThrow({ where: { tgId: BigInt(blockedChat) } });
    expect(p2.botBlockedAt).not.toBeNull();

    // Ikkinchi ishga tushirish — yangi xabar yo'q
    t.calls.length = 0;
    await svc.queueDaily();
    await svc.sendPending();
    expect(t.calls.filter((c) => c.method === 'sendMessage' && [BASE + 1, BASE + 2].includes(c.payload.chat_id))).toHaveLength(0);
  });
});
