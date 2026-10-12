import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma, type Receipt, type ReceiptStatus } from '@prisma/client';

import { CampaignService } from '../campaign/campaign.service.js';
import { calcCoupons } from '../core/coupons.js';
import { MATCH_WINDOW_MS, matchReceipt, type SaleCandidate } from '../core/match.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReceiptsService } from '../receipts/receipts.service.js';

/** Shuncha kundan keyin ham iiko'da topilmasa — NOT_FOUND (moderatsiya). */
export const NOT_FOUND_AFTER_DAYS = 3;

export interface ReconcileReport {
  checked: number;
  approved: number;
  belowMin: number;
  refunded: number;
  review: number;
  notFound: number;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class ReconcileService implements OnModuleInit {
  private readonly log = new Logger(ReconcileService.name);
  private running: Promise<ReconcileReport> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignService,
    private readonly receipts: ReceiptsService,
  ) {}

  onModuleInit() {
    // Savdo ma'lumoti oldin kelgan bo'lsa (masalan, Excel), yangi chek darhol tasdiqlanadi
    this.receipts.onCreated(async (id) => {
      await this.reconcileOne(id);
    });
  }

  /** Bir vaqtda faqat bitta to'liq solishtirish (cron va "Hozir solishtirish" tugmasi). */
  reconcileAll(): Promise<ReconcileReport> {
    if (!this.running) {
      this.running = this.doReconcileAll().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async doReconcileAll(): Promise<ReconcileReport> {
    const report: ReconcileReport = { checked: 0, approved: 0, belowMin: 0, refunded: 0, review: 0, notFound: 0 };

    report.refunded += await this.applyRefunds();

    const open = await this.prisma.receipt.findMany({
      where: { status: { in: ['PENDING', 'NOT_FOUND'] }, fm: { not: null } },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    for (const { id } of open) {
      report.checked++;
      const res = await this.reconcileOne(id);
      if (res === 'APPROVED') report.approved++;
      else if (res === 'BELOW_MIN') report.belowMin++;
      else if (res === 'REJECTED') report.refunded++;
      else if (res === 'NEEDS_REVIEW') report.review++;
    }

    report.notFound = await this.markNotFound();
    this.log.log(`Solishtirish: ${JSON.stringify(report)}`);
    return report;
  }

  /** Bitta chekni solishtiradi. Natijaviy status yoki null (o'zgarmadi). */
  async reconcileOne(receiptId: number): Promise<ReceiptStatus | null> {
    const r = await this.prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!r || !r.fm || !r.receiptNumber || !r.fiscalAt) return null;
    if (r.status !== 'PENDING' && r.status !== 'NOT_FOUND') return null;

    const from = new Date(r.fiscalAt.getTime() - MATCH_WINDOW_MS);
    const to = new Date(r.fiscalAt.getTime() + MATCH_WINDOW_MS);
    const sales = await this.prisma.saleRecord.findMany({
      where: {
        OR: [
          { fm: r.fm, receiptNumber: r.receiptNumber },
          ...(r.branchId ? [{ branchId: r.branchId, fm: null, closedAt: { gte: from, lte: to } }] : []),
        ],
      },
      include: { receipts: { select: { id: true } } },
    });
    if (!sales.length) return null;

    const candidates: SaleCandidate[] = sales.map((s) => ({
      id: s.id,
      fm: s.fm,
      receiptNumber: s.receiptNumber,
      branchId: s.branchId,
      closedAt: s.closedAt,
      amount: Number(s.amount),
      isRefund: s.isRefund,
      takenByOther: s.receipts.some((x) => x.id !== r.id),
      multiFiscal: (s.raw as { _multiFiscal?: boolean } | null)?._multiFiscal === true,
    }));
    const m = matchReceipt(
      { fm: r.fm, receiptNumber: r.receiptNumber, branchId: r.branchId, fiscalAt: r.fiscalAt },
      candidates,
    );

    switch (m.kind) {
      case 'NONE':
        return null;
      case 'MATCH':
        return this.approve(r.id, {
          amount: m.sale.amount,
          branchId: m.sale.branchId ?? r.branchId,
          saleRecordId: m.sale.id,
          from: ['PENDING', 'NOT_FOUND'],
        });
      case 'REFUND':
        await this.prisma.receipt.updateMany({
          where: { id: r.id, status: { in: ['PENDING', 'NOT_FOUND'] } },
          data: {
            status: 'REJECTED',
            rejectCode: 'REFUND',
            rejectReason: 'Chek qaytarilgan (refund)',
            saleRecordId: m.sale.id,
            decidedAt: new Date(),
          },
        });
        return 'REJECTED';
      case 'TIME_MISMATCH':
      case 'AMBIGUOUS':
      case 'MULTI_FISCAL':
        await this.prisma.receipt.updateMany({
          where: { id: r.id, status: { in: ['PENDING', 'NOT_FOUND'] } },
          data: {
            status: 'NEEDS_REVIEW',
            rejectCode: m.kind,
            rejectReason:
              m.kind === 'TIME_MISMATCH'
                ? "iiko'da topildi, lekin vaqt 10 daqiqadan ko'p farq qiladi"
                : m.kind === 'MULTI_FISCAL'
                  ? "Bitta buyurtmada bir nechta fiskal chek — summani chekdan tekshiring"
                  : `Bir nechta mos chek (${m.count} ta) — qo'lda tanlash kerak`,
            saleRecordId: m.kind === 'AMBIGUOUS' ? null : m.sale.id,
          },
        });
        return 'NEEDS_REVIEW';
    }
  }

  /**
   * Chekni summa bilan tasdiqlaydi va kuponlarni yaratadi (bitta tranzaksiyada).
   * Moderator tasdig'i ham shu yerdan o'tadi. `from` — qaysi statusdan o'tishi mumkin.
   */
  async approve(
    receiptId: number,
    opts: {
      amount: number;
      branchId: number | null;
      saleRecordId?: number | null;
      reviewedById?: number | null;
      from: ReceiptStatus[];
      extra?: Prisma.ReceiptUpdateManyMutationInput;
    },
  ): Promise<'APPROVED' | 'BELOW_MIN' | null> {
    const campaign = await this.campaigns.getActive();
    if (!campaign) throw new Error("Faol aksiya yo'q");
    if (!opts.branchId) throw new Error('Filial aniqlanmagan');

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUniqueOrThrow({ where: { id: opts.branchId! } });
      const count = calcCoupons(opts.amount, {
        minSum: Number(branch.minSum),
        couponPrice: Number(branch.couponPrice),
        maxPerReceipt: branch.maxPerReceipt,
      });
      const status = count > 0 ? 'APPROVED' : 'BELOW_MIN';

      // Shartli yangilash: parallel jarayon allaqachon hal qilgan bo'lsa — hech narsa qilmaymiz
      const upd = await tx.receipt.updateMany({
        where: { id: receiptId, status: { in: opts.from } },
        data: {
          ...opts.extra,
          status,
          amount: new Prisma.Decimal(opts.amount),
          branchId: branch.id,
          couponsCount: count,
          saleRecordId: opts.saleRecordId ?? undefined,
          reviewedById: opts.reviewedById ?? undefined,
          rejectCode: null,
          rejectReason: status === 'BELOW_MIN' ? `Summa ${fmtSum(Number(branch.minSum))} so'mdan kam` : null,
          decidedAt: new Date(),
          notifiedAt: null,
        },
      });
      if (upd.count === 0) return null;

      if (count > 0) {
        const receipt = await tx.receipt.findUniqueOrThrow({
          where: { id: receiptId },
          include: { participant: { select: { isStaff: true } } },
        });
        await tx.coupon.createMany({
          data: Array.from({ length: count }, () => ({
            campaignId: campaign.id,
            participantId: receipt.participantId,
            receiptId,
            eligible: !receipt.participant.isStaff,
          })),
        });
      }
      return status;
    });
  }

  /** Avval tasdiqlangan, keyin qaytarilgan cheklar: REJECTED, kuponlar eligible=false. */
  async applyRefunds(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ receiptId: number; saleId: number }>>`
      SELECT r.id AS "receiptId", s.id AS "saleId"
      FROM receipts r
      JOIN sale_records s ON s.fm = r.fm AND s."receiptNumber" = r."receiptNumber" AND s."isRefund" = true
      WHERE r.status IN ('APPROVED', 'BELOW_MIN')`;
    for (const row of rows) {
      await this.prisma.$transaction(async (tx) => this.revoke(tx, row.receiptId, row.saleId));
    }
    return rows.length;
  }

  private async revoke(tx: Tx, receiptId: number, saleId: number) {
    const upd = await tx.receipt.updateMany({
      where: { id: receiptId, status: { in: ['APPROVED', 'BELOW_MIN'] } },
      data: {
        status: 'REJECTED',
        rejectCode: 'REFUND',
        rejectReason: 'Chek qaytarilgan (refund)',
        decidedAt: new Date(),
        notifiedAt: null,
      },
    });
    if (!upd.count) return;
    await tx.coupon.updateMany({ where: { receiptId }, data: { eligible: false } });
    await tx.auditLog.create({
      data: { action: 'receipt.refund', entity: 'receipt', entityId: String(receiptId), data: { saleId } },
    });
  }

  /** Uzoq vaqt topilmagan PENDING cheklar → NOT_FOUND (moderatsiya navbati). */
  async markNotFound(now = new Date()): Promise<number> {
    const before = new Date(now.getTime() - NOT_FOUND_AFTER_DAYS * 24 * 60 * 60 * 1000);
    const res = await this.prisma.receipt.updateMany({
      where: { status: 'PENDING', fiscalAt: { lt: before } },
      data: { status: 'NOT_FOUND', rejectCode: 'NOT_FOUND', rejectReason: `${NOT_FOUND_AFTER_DAYS} kun ichida iiko'da topilmadi` },
    });
    return res.count;
  }

  /** Moderator rad etishi. */
  async reject(receipt: Pick<Receipt, 'id'>, reason: string, reviewedById: number | null) {
    return this.prisma.$transaction(async (tx) => {
      const upd = await tx.receipt.updateMany({
        where: { id: receipt.id, status: { not: 'REJECTED' } },
        data: {
          status: 'REJECTED',
          rejectCode: 'MODERATOR',
          rejectReason: reason,
          reviewedById,
          decidedAt: new Date(),
          notifiedAt: null,
        },
      });
      await tx.coupon.updateMany({ where: { receiptId: receipt.id }, data: { eligible: false } });
      return upd.count > 0;
    });
  }
}

export const fmtSum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
