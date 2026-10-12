import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { GrammyError, type Bot } from 'grammy';

import { esc } from '../bot/texts.js';
import { formatTashkent } from '../core/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { fmtSum } from '../reconcile/reconcile.service.js';
import { BOT } from '../telegram/bot.token.js';

/** Telegram: ~30 xabar/soniya umumiy limit — biz 25 tadan oshirmaymiz. */
const PER_SECOND = 25;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface DecidedReceipt {
  status: string;
  fiscalAt: Date | null;
  amount: Prisma.Decimal | number | null;
  couponsCount: number;
  rejectReason: string | null;
  branch: { name: string; minSum: Prisma.Decimal | number } | null;
}

/** Bitta mijozga ertalabki xabar matni (sof funksiya). */
export function buildDailyMessage(receipts: DecidedReceipt[], totalCoupons: number, isStaff: boolean): string {
  const lines = receipts.map((r) => {
    const where = `${r.branch?.name ?? 'Chek'}${r.fiscalAt ? `, ${formatTashkent(r.fiscalAt)}` : ''}`;
    if (r.status === 'APPROVED') return `✅ ${esc(where)} — ${fmtSum(Number(r.amount))} so'm → <b>+${r.couponsCount} kupon</b>`;
    if (r.status === 'BELOW_MIN')
      return `➖ ${esc(where)} — ${fmtSum(Number(r.amount))} so'm, kupon uchun kamida ${fmtSum(Number(r.branch?.minSum ?? 0))} so'm kerak`;
    return `❌ ${esc(where)} — ${esc(r.rejectReason ?? 'rad etildi')}`;
  });
  const added = receipts.filter((r) => r.status === 'APPROVED').reduce((a, r) => a + r.couponsCount, 0);
  const head =
    added > 0
      ? receipts.length === 1 && receipts[0].branch
        ? `${esc(receipts[0].branch.name)}dagi chekingiz uchun ${added} ta kupon qo'shildi 🎉`
        : `Cheklaringiz uchun ${added} ta kupon qo'shildi 🎉`
      : `Cheklaringiz tekshirildi:`;
  const tail = isStaff ? `\n\nℹ️ Fazo xodimlari o'yinda qatnashmaydi.` : `\n\n🎟 Jami kuponlaringiz: <b>${totalCoupons} ta</b>`;
  return `${head}\n\n${lines.join('\n')}${tail}`;
}

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(BOT) private readonly bot: Bot,
  ) {}

  /** Hal qilingan, lekin hali aytilmagan cheklar → har mijozga bitta xabar (outbox). */
  async queueDaily(): Promise<number> {
    const receipts = await this.prisma.receipt.findMany({
      where: {
        notifiedAt: null,
        decidedAt: { not: null },
        status: { in: ['APPROVED', 'BELOW_MIN', 'REJECTED'] },
        participant: { isBlocked: false, botBlockedAt: null },
      },
      orderBy: { fiscalAt: 'asc' },
      include: { branch: { select: { name: true, minSum: true } }, participant: { select: { id: true, isStaff: true } } },
    });
    const byParticipant = new Map<number, typeof receipts>();
    for (const r of receipts) byParticipant.set(r.participantId, [...(byParticipant.get(r.participantId) ?? []), r]);

    for (const [participantId, list] of byParticipant) {
      const total = await this.prisma.coupon.count({ where: { participantId, eligible: true } });
      const text = buildDailyMessage(list, total, list[0].participant.isStaff);
      await this.prisma.$transaction([
        this.prisma.notification.create({
          data: { participantId, type: 'DAILY_SUMMARY', payload: { text, receiptIds: list.map((r) => r.id) } },
        }),
        this.prisma.receipt.updateMany({ where: { id: { in: list.map((r) => r.id) } }, data: { notifiedAt: new Date() } }),
      ]);
    }
    return byParticipant.size;
  }

  /** Navbatdagi xabarlarni yuboradi. Natija: yuborilgan / xato / bot bloklangan. */
  async sendPending(): Promise<{ sent: number; failed: number; blocked: number }> {
    const stats = { sent: 0, failed: 0, blocked: 0 };
    if (this.running) return stats;
    this.running = true;
    try {
      const pending = await this.prisma.notification.findMany({
        where: { sentAt: null, error: null, sendAfter: { lte: new Date() } },
        orderBy: { id: 'asc' },
        include: { participant: { select: { tgId: true } } },
      });
      for (let i = 0; i < pending.length; i++) {
        const n = pending[i];
        const started = Date.now();
        try {
          await this.bot.api.sendMessage(Number(n.participant.tgId), (n.payload as { text: string }).text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
          });
          await this.prisma.notification.update({ where: { id: n.id }, data: { sentAt: new Date() } });
          stats.sent++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const blocked = e instanceof GrammyError && (e.error_code === 403 || /chat not found|user is deactivated/i.test(e.description));
          await this.prisma.notification.update({ where: { id: n.id }, data: { error: msg.slice(0, 500) } });
          if (blocked) {
            await this.prisma.participant.update({ where: { id: n.participantId }, data: { botBlockedAt: new Date() } });
            stats.blocked++;
          } else {
            stats.failed++;
            this.log.error(`Xabar #${n.id}: ${msg}`);
          }
        }
        const wait = 1000 / PER_SECOND - (Date.now() - started);
        if (wait > 0 && i < pending.length - 1) await sleep(wait);
      }
    } finally {
      this.running = false;
    }
    return stats;
  }
}
