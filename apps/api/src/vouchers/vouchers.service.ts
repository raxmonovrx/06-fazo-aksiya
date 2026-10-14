import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type AdminUser, type Participant, type Voucher } from '@prisma/client';
import QRCode from 'qrcode';

import { can } from '../admin/permissions.js';
import { esc } from '../bot/texts.js';
import { CampaignService } from '../campaign/campaign.service.js';
import { config } from '../config.js';
import { calcCoupons } from '../core/coupons.js';
import { normalizePhone } from '../core/phone.js';
import { formatTashkent, tashkentDayStart } from '../core/time.js';
import { newVoucherToken, voucherStartParam } from '../core/voucher-token.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimiter } from '../receipts/rate-limiter.js';
import { fmtSum } from '../reconcile/reconcile.service.js';
import { AlertsService } from '../telegram/alerts.service.js';

/** Vaucher amal qilish muddati (soat) */
export const VOUCHER_TTL_HOURS = 72;
/** Bitta odam bir kunda bitta kassirdan shuncha vaucher olsa — shubhali */
const SAME_PAIR_ALERT = 3;
/** Bitta odam bir kunda shuncha vaucher skanerlasa — shubhali */
const PER_PARTICIPANT_ALERT = 5;

export type RedeemCode = 'REDEEMED' | 'ALREADY_YOURS' | 'USED' | 'EXPIRED' | 'CANCELLED' | 'INVALID' | 'NO_CAMPAIGN' | 'RATE_LIMIT' | 'BLOCKED';

export interface RedeemResult {
  code: RedeemCode;
  couponsCount?: number;
  amount?: number;
  branchName?: string;
  totalCoupons?: number;
  isStaff?: boolean;
}

export interface IssueInput {
  amount: number;
  branchId?: number;
  terminalId?: number;
  customerName?: string;
  customerPhone?: string;
}

const voucherLink = (token: string) => `https://t.me/${config().BOT_USERNAME}?start=${voucherStartParam(token)}`;

@Injectable()
export class VouchersService {
  private readonly log = new Logger(VouchersService.name);
  // Tokenni taxmin qilib bo'lmaydi, lekin baribir: bitta foydalanuvchi daqiqasiga 10 ta urinish
  readonly redeemLimiter = new RateLimiter(10, 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignService,
    private readonly alerts: AlertsService,
  ) {}

  // ── Chiqarish (kassir) ─────────────────────────────────────────────────

  async issue(actor: AdminUser, input: IssueInput) {
    // Filialga biriktirilgan xodim faqat o'z filialida chiqaradi
    const branchId = actor.branchId ?? input.branchId;
    if (!branchId) {
      throw new BadRequestException(actor.role === 'ADMIN' ? 'Filialni tanlang' : 'Sizga filial biriktirilmagan — adminga murojaat qiling');
    }
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new BadRequestException('Filial topilmadi');
    if (!branch.isActive) throw new BadRequestException('Bu filial aksiyada qatnashmaydi');
    const terminal = input.terminalId ? await this.prisma.terminal.findUnique({ where: { id: input.terminalId } }) : null;
    if (input.terminalId && (!terminal || terminal.branchId !== branch.id || !terminal.isActive)) {
      throw new BadRequestException('Kassa qurilmasi topilmadi — sahifani yangilang');
    }

    const campaign = await this.campaigns.getActive();
    const now = new Date();
    if (!campaign) throw new BadRequestException("Faol aksiya yo'q");
    if (now < campaign.startsAt) throw new BadRequestException(`Aksiya ${formatTashkent(campaign.startsAt)} da boshlanadi`);
    if (campaign.endsAt && now > campaign.endsAt) throw new BadRequestException('Aksiya tugagan');

    const couponsCount = calcCoupons(input.amount, {
      minSum: Number(branch.minSum),
      couponPrice: Number(branch.couponPrice),
      maxPerReceipt: branch.maxPerReceipt,
    });
    if (couponsCount <= 0) throw new BadRequestException(`Summa kam: kupon uchun kamida ${fmtSum(Number(branch.minSum))} so'm`);

    let customerPhone: string | null = null;
    if (input.customerPhone?.trim()) {
      customerPhone = normalizePhone(input.customerPhone);
      if (!customerPhone) throw new BadRequestException("Telefon noto'g'ri (+998XXXXXXXXX)");
    }

    const expiresAt = new Date(now.getTime() + VOUCHER_TTL_HOURS * 60 * 60 * 1000);
    const voucher = await this.prisma.$transaction(async (tx) => {
      const v = await tx.voucher.create({
        data: {
          token: newVoucherToken(),
          branchId: branch.id,
          amount: new Prisma.Decimal(input.amount),
          couponsCount,
          customerName: input.customerName?.trim() || null,
          customerPhone,
          issuedById: actor.id,
          terminalId: terminal?.id ?? null,
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'voucher.issue',
          entity: 'voucher',
          entityId: String(v.id),
          data: { amount: input.amount, couponsCount, branchId: branch.id, terminalId: v.terminalId, customerPhone, customerName: v.customerName },
        },
      });
      return v;
    });
    return this.present(voucher, branch.name, true);
  }

  /** QR va havola bilan (chop etish / qayta chop etish uchun). */
  async present(v: Voucher, branchName: string, withQr: boolean) {
    const link = voucherLink(v.token);
    return {
      id: v.id,
      status: v.status,
      amount: Number(v.amount),
      couponsCount: v.couponsCount,
      branchId: v.branchId,
      branchName,
      terminalId: v.terminalId,
      customerName: v.customerName,
      customerPhone: v.customerPhone,
      issuedAt: v.issuedAt,
      expiresAt: v.expiresAt,
      link,
      ...(withQr && { qrSvg: await QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) }),
    };
  }

  async reprint(actor: AdminUser, id: number) {
    const v = await this.prisma.voucher.findUnique({ where: { id }, include: { branch: true } });
    if (!v) throw new NotFoundException();
    this.assertCanManage(actor, v);
    if (v.status !== 'ISSUED') throw new ConflictException('Faqat ishlatilmagan vaucherni qayta chop etish mumkin');
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action: 'voucher.reprint', entity: 'voucher', entityId: String(id) } });
    return this.present(v, v.branch.name, true);
  }

  async cancel(actor: AdminUser, id: number, reason: string) {
    const v = await this.prisma.voucher.findUnique({ where: { id } });
    if (!v) throw new NotFoundException();
    this.assertCanManage(actor, v);
    const upd = await this.prisma.voucher.updateMany({
      where: { id, status: 'ISSUED' },
      data: { status: 'CANCELLED', cancelledById: actor.id, cancelledAt: new Date(), cancelReason: reason },
    });
    if (!upd.count) throw new ConflictException('Vaucher allaqachon ishlatilgan yoki bekor qilingan');
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action: 'voucher.cancel', entity: 'voucher', entityId: String(id), data: { reason } } });
    return { ok: true };
  }

  /**
   * O'zi chiqarganini har doim; boshqalarnikini — `vouchers.cancel` ruxsati bilan
   * (filialga biriktirilgan bo'lsa — faqat o'z filialida).
   */
  private assertCanManage(actor: AdminUser, v: Pick<Voucher, 'issuedById' | 'branchId'>) {
    if (v.issuedById === actor.id) return;
    if (!can(actor, 'vouchers.cancel')) throw new ForbiddenException();
    if (actor.branchId && v.branchId !== actor.branchId) throw new ForbiddenException();
  }

  /** Kassa ekrani skanerlanishini kutadi */
  async status(actor: AdminUser, id: number) {
    const v = await this.prisma.voucher.findUnique({ where: { id }, select: { id: true, status: true, issuedById: true, branchId: true, expiresAt: true, redeemedAt: true } });
    if (!v) throw new NotFoundException();
    if (v.issuedById !== actor.id && !can(actor, 'vouchers')) throw new ForbiddenException();
    if (actor.branchId && v.branchId !== actor.branchId) throw new ForbiddenException();
    return { id: v.id, status: v.status, expiresAt: v.expiresAt, redeemedAt: v.redeemedAt };
  }

  // ── Skanerlash (mijoz) ─────────────────────────────────────────────────

  async redeem(p: Participant, token: string): Promise<RedeemResult> {
    if (p.isBlocked) return { code: 'BLOCKED' };
    if (!this.redeemLimiter.hit(String(p.id))) return { code: 'RATE_LIMIT' };

    const v = await this.prisma.voucher.findUnique({ where: { token }, include: { branch: { select: { name: true } } } });
    if (!v) return { code: 'INVALID' };
    if (v.status === 'CANCELLED') return { code: 'CANCELLED' };
    if (v.status === 'REDEEMED') return { code: v.redeemedById === p.id ? 'ALREADY_YOURS' : 'USED' };
    const now = new Date();
    if (v.expiresAt <= now) return { code: 'EXPIRED' };
    const campaign = await this.campaigns.getActive();
    if (!campaign) return { code: 'NO_CAMPAIGN' };

    const isStaff = p.isStaff || Boolean(p.phone && (await this.prisma.staffPhone.findUnique({ where: { phone: p.phone } })));
    const phoneMismatch = Boolean(v.customerPhone && p.phone && v.customerPhone !== p.phone);

    const done = await this.prisma.$transaction(async (tx) => {
      // Atomar: ikki kishi bir vaqtda skanerlasa — faqat bittasi o'tadi
      const upd = await tx.voucher.updateMany({
        where: { id: v.id, status: 'ISSUED', expiresAt: { gt: now } },
        data: {
          status: 'REDEEMED',
          redeemedById: p.id,
          redeemedAt: now,
          // Skanerlagan akkaunt o'sha paytdagi holatida muhrlanadi
          redeemedPhone: p.phone,
          redeemedTgId: p.tgId,
          redeemedName: [p.firstName, p.lastName].filter(Boolean).join(' ') || p.username || null,
          phoneMismatch,
          redeemedByStaff: isStaff,
        },
      });
      if (!upd.count) return false;
      const receipt = await tx.receipt.create({
        data: {
          participantId: p.id,
          source: 'VOUCHER',
          status: 'APPROVED',
          receiptNumber: `V${v.id}`,
          fiscalAt: v.issuedAt,
          amount: v.amount,
          branchId: v.branchId,
          couponsCount: v.couponsCount,
          reviewedById: v.issuedById,
          decidedAt: now,
          // Natija mijozga darhol aytiladi — ertalabki xabarga kirmaydi
          notifiedAt: now,
        },
      });
      await tx.coupon.createMany({
        data: Array.from({ length: v.couponsCount }, () => ({
          campaignId: campaign.id,
          participantId: p.id,
          receiptId: receipt.id,
          eligible: !isStaff,
        })),
      });
      await tx.voucher.update({ where: { id: v.id }, data: { receiptId: receipt.id } });
      return true;
    });
    if (!done) {
      const again = await this.prisma.voucher.findUnique({ where: { id: v.id } });
      if (again?.status === 'REDEEMED') return { code: again.redeemedById === p.id ? 'ALREADY_YOURS' : 'USED' };
      return { code: again?.status === 'CANCELLED' ? 'CANCELLED' : 'EXPIRED' };
    }

    void this.fraudChecks(p, v, isStaff, phoneMismatch).catch((e) => this.log.error(e));
    const totalCoupons = await this.prisma.coupon.count({ where: { participantId: p.id, eligible: true } });
    return {
      code: 'REDEEMED',
      couponsCount: v.couponsCount,
      amount: Number(v.amount),
      branchName: v.branch.name,
      totalCoupons,
      isStaff,
    };
  }

  /** Ishchilar soxta vaucher chiqarib o'zlari olishini aniqlash uchun ogohlantirishlar. */
  private async fraudChecks(p: Participant, v: Voucher, isStaff: boolean, phoneMismatch: boolean) {
    const cashier = await this.prisma.adminUser.findUnique({ where: { id: v.issuedById }, select: { login: true } });
    const who = `${esc(p.phone ?? '')} (${esc([p.firstName, p.lastName].filter(Boolean).join(' '))})`;
    const day = tashkentDayStart(new Date());

    if (isStaff) {
      await this.alerts.send(
        `🚩 <b>Xodim vaucher skanerladi</b>: ${who}\nVaucher #${v.id}, ${fmtSum(Number(v.amount))} so'm, kassir: ${esc(cashier?.login ?? '?')}`,
      );
    }
    const pair = await this.prisma.voucher.count({
      where: { issuedById: v.issuedById, redeemedById: p.id, redeemedAt: { gte: day } },
    });
    if (pair >= SAME_PAIR_ALERT) {
      await this.alerts.send(
        `🚩 <b>Shubhali</b>: kassir ${esc(cashier?.login ?? '?')} bugun bitta odamga ${pair} ta vaucher berdi → ${who}`,
        `voucher-pair:${v.issuedById}:${p.id}:${day.toISOString()}`,
      );
    }
    const perPerson = await this.prisma.voucher.count({ where: { redeemedById: p.id, redeemedAt: { gte: day } } });
    if (perPerson >= PER_PARTICIPANT_ALERT) {
      await this.alerts.send(
        `🚩 <b>Shubhali</b>: ${who} bugun ${perPerson} ta vaucher skanerladi`,
        `voucher-person:${p.id}:${day.toISOString()}`,
      );
    }
    if (phoneMismatch) this.log.warn(`Vaucher #${v.id}: kassir raqami ${v.customerPhone}, skanerlagan ${p.phone}`);
  }

  // ── Ro'yxat (admin) ────────────────────────────────────────────────────

  async list(
    actor: AdminUser,
    q: { status?: string; branchId?: number; issuedById?: number; from?: Date; to?: Date; q?: string; flagged?: boolean; page: number; pageSize: number },
  ) {
    const where: Prisma.VoucherWhereInput = {};
    // `vouchers` ruxsatisiz — faqat o'zi chiqarganlar; filialga biriktirilgan — faqat o'z filiali
    if (!can(actor, 'vouchers')) where.issuedById = actor.id;
    else if (q.issuedById) where.issuedById = q.issuedById;
    if (actor.branchId) where.branchId = actor.branchId;
    if (q.status) {
      const list = q.status.split(',').filter((s): s is 'ISSUED' | 'REDEEMED' | 'CANCELLED' => ['ISSUED', 'REDEEMED', 'CANCELLED'].includes(s));
      if (list.length) where.status = { in: list };
    }
    if (q.branchId && !actor.branchId) where.branchId = q.branchId;
    if (q.from || q.to) where.issuedAt = { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) };
    if (q.flagged) where.OR = [{ phoneMismatch: true }, { redeemedByStaff: true }];
    if (q.q?.trim()) {
      const s = q.q.trim();
      const digits = s.replace(/\D/g, '');
      const or: Prisma.VoucherWhereInput[] = [];
      if (digits.length >= 3) or.push({ customerPhone: { contains: digits } }, { redeemedPhone: { contains: digits } });
      if (/^\d+$/.test(s) && Number(s) < 2_147_483_647) or.push({ id: Number(s) });
      or.push({ customerName: { contains: s, mode: 'insensitive' } }, { redeemedName: { contains: s, mode: 'insensitive' } });
      where.AND = [{ OR: or }];
    }
    const [total, items, sums] = await Promise.all([
      this.prisma.voucher.count({ where }),
      this.prisma.voucher.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          branch: { select: { id: true, name: true } },
          terminal: { select: { id: true, name: true } },
          issuedBy: { select: { id: true, login: true } },
          cancelledBy: { select: { id: true, login: true } },
          redeemedBy: { select: { id: true, phone: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.voucher.groupBy({ by: ['status'], where, _count: { _all: true }, _sum: { amount: true, couponsCount: true } }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      summary: Object.fromEntries(
        sums.map((s) => [s.status, { count: s._count._all, amount: Number(s._sum.amount ?? 0), coupons: s._sum.couponsCount ?? 0 }]),
      ),
      items: items.map(({ token: _token, ...rest }) => ({ ...rest, redeemedTgId: rest.redeemedTgId?.toString() ?? null })),
    };
  }
}
