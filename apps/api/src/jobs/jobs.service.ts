import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { tashkentDayStart, TZ } from '../core/time.js';
import { IikoSource } from '../iiko/iiko.source.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImportService } from '../reconcile/import.service.js';
import { ReconcileService } from '../reconcile/reconcile.service.js';
import { AlertsService } from '../telegram/alerts.service.js';
import { NotificationsService } from './notifications.service.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class JobsService {
  private readonly log = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly iiko: IikoSource,
    private readonly imports: ImportService,
    private readonly reconcile: ReconcileService,
    private readonly notifications: NotificationsService,
    private readonly alerts: AlertsService,
  ) {}

  /**
   * 03:15 — iiko'dan kechagi kun + oxirgi 3 kun savdosi, keyin solishtirish.
   * RestoBrain sinxroni :00/:30 va 04:00 da — to'qnashmaslik uchun 03:15.
   */
  @Cron('15 3 * * *', { name: 'nightly-reconcile', timeZone: TZ })
  async nightly() {
    if (process.env.JOBS_DISABLED === '1') return;
    await this.runNightly();
  }

  async runNightly() {
    if (this.iiko.enabled()) {
      const today = tashkentDayStart(new Date());
      const from = new Date(today.getTime() - 4 * DAY);
      let lastError: Error | null = null;
      // iiko sessiyasi band bo'lishi mumkin (RestoBrain) — 3 marta, 5 daqiqa oraliq bilan
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const rows = await this.iiko.fetch(from, today);
          const res = await this.imports.saveRecords('IIKO_API', rows, { periodFrom: from, periodTo: today });
          this.log.log(`iiko import: ${res.inserted} yangi, ${res.matched} bog'landi`);
          lastError = null;
          break;
        } catch (e) {
          lastError = e as Error;
          this.log.warn(`iiko import ${attempt}-urinish: ${lastError.message}`);
          if (attempt < 3) await sleep(5 * 60_000);
        }
      }
      if (lastError) {
        await this.alerts.send(`🔴 <b>iiko import ishlamadi</b> (3 urinish): ${lastError.message}\nExcel import orqali yuklang.`);
      }
    }
    try {
      await this.reconcile.reconcileAll();
    } catch (e) {
      await this.alerts.send(`🔴 <b>Solishtirish xatosi</b>: ${(e as Error).message}`);
    }
  }

  /** 09:00 — mijozlarga kechagi natijalar. */
  @Cron('0 9 * * *', { name: 'morning-notify', timeZone: TZ })
  async morning() {
    if (process.env.JOBS_DISABLED === '1') return;
    await this.runMorning();
  }

  async runMorning() {
    try {
      const queued = await this.notifications.queueDaily();
      const stats = await this.notifications.sendPending();
      this.log.log(`Ertalabki xabarlar: navbat ${queued}, ${JSON.stringify(stats)}`);
      await this.adminSummary(stats);
      return { queued, ...stats };
    } catch (e) {
      await this.alerts.send(`🔴 <b>Bildirishnoma xatosi</b>: ${(e as Error).message}`);
      throw e;
    }
  }

  private async adminSummary(stats: { sent: number; failed: number; blocked: number }) {
    const since = new Date(tashkentDayStart(new Date()).getTime() - DAY);
    const until = tashkentDayStart(new Date());
    const [participants, receipts, review, coupons, unknown] = await Promise.all([
      this.prisma.participant.count({ where: { rulesAcceptedAt: { gte: since, lt: until } } }),
      this.prisma.receipt.count({ where: { createdAt: { gte: since, lt: until } } }),
      this.prisma.receipt.count({ where: { status: { in: ['NEEDS_REVIEW', 'NOT_FOUND'] } } }),
      this.prisma.coupon.count({ where: { eligible: true, createdAt: { gte: since, lt: until } } }),
      this.prisma.unknownFm.count(),
    ]);
    await this.alerts.send(
      `📊 <b>Kecha</b>: +${participants} ishtirokchi, +${receipts} chek, +${coupons} kupon.\n` +
        `👀 Moderatsiyada: ${review}` +
        (unknown ? ` · noma'lum FM: ${unknown}` : '') +
        `\n📨 Xabarlar: ${stats.sent} yuborildi` +
        (stats.blocked ? `, ${stats.blocked} bot bloklangan` : '') +
        (stats.failed ? `, ${stats.failed} xato` : ''),
    );
  }
}
