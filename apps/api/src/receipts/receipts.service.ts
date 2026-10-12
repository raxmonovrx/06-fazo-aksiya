import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type Participant, type Receipt, type ReceiptSource, type ReceiptStatus } from '@prisma/client';

import { CampaignService } from '../campaign/campaign.service.js';
import { parseReceiptQr } from '../core/receipt-qr.js';
import { checkReceiptTiming } from '../core/receipt-rules.js';
import { formatTashkent, tashkentDayStart } from '../core/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AlertsService } from '../telegram/alerts.service.js';
import { esc } from '../bot/texts.js';
import { RateLimiter } from './rate-limiter.js';

export type SubmitCode =
  | 'ACCEPTED' // PENDING — ertalab solishtiriladi
  | 'REVIEW' // NEEDS_REVIEW — noma'lum FM yoki rasm o'qilmadi
  | 'DUPLICATE'
  | 'ALREADY_YOURS'
  | 'INVALID_QR'
  | 'BEFORE_CAMPAIGN'
  | 'AFTER_CAMPAIGN'
  | 'WINDOW_EXPIRED'
  | 'FUTURE'
  | 'BRANCH_INACTIVE'
  | 'NO_CAMPAIGN'
  | 'RATE_LIMIT';

export interface SubmitResult {
  code: SubmitCode;
  message: string;
  receipt?: Pick<Receipt, 'id' | 'status' | 'fiscalAt' | 'receiptNumber'> & { branchName?: string | null };
}

export interface SubmitInput {
  participant: Participant;
  text: string | null;
  source: ReceiptSource;
  photoFileId?: string;
}

/** Bir telefondan bir kunda shundan ko'p chek — admin'ga ogohlantirish (SPEC 8). */
const SUSPICIOUS_PER_DAY = 5;
/** Bitta FM'dan bir soatda shundan ko'p chek — g'ayritabiiy. */
const SUSPICIOUS_FM_PER_HOUR = 40;

@Injectable()
export class ReceiptsService {
  private readonly log = new Logger(ReceiptsService.name);
  // SPEC 5.2: daqiqasiga 5 ta, kuniga 20 ta
  readonly perMinute = new RateLimiter(5, 60_000);
  readonly perDay = new RateLimiter(20, 24 * 60 * 60 * 1000);
  private readonly afterCreateHooks: Array<(receiptId: number) => Promise<void>> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignService,
    private readonly alerts: AlertsService,
  ) {}

  /** Solishtirish moduli yangi chekni darhol tekshirish uchun shu orqali ulanadi. */
  onCreated(hook: (receiptId: number) => Promise<void>) {
    this.afterCreateHooks.push(hook);
  }

  async submit(input: SubmitInput): Promise<SubmitResult> {
    const { participant, source } = input;
    const key = String(participant.id);
    if (!this.perMinute.hit(key) || !this.perDay.hit(key)) {
      await this.scanLog(input, 'RATE_LIMIT');
      return { code: 'RATE_LIMIT', message: MSG.RATE_LIMIT };
    }

    // Rasm o'qilmadi — moderatsiyaga
    if (input.text === null) {
      const receipt = await this.prisma.receipt.create({
        data: {
          participantId: participant.id,
          source,
          status: 'NEEDS_REVIEW',
          rejectCode: 'QR_UNREADABLE',
          photoFileId: input.photoFileId,
        },
      });
      await this.scanLog(input, 'QR_UNREADABLE', receipt.id);
      return { code: 'REVIEW', message: MSG.PHOTO_UNREADABLE, receipt: this.view(receipt) };
    }

    const parsed = parseReceiptQr(input.text);
    if (!parsed.ok) {
      await this.scanLog(input, `INVALID_QR:${parsed.error}`);
      return { code: 'INVALID_QR', message: MSG.INVALID_QR };
    }
    const qr = parsed.value;

    const campaign = await this.campaigns.getActive();
    if (!campaign) {
      await this.scanLog(input, 'NO_CAMPAIGN');
      return { code: 'NO_CAMPAIGN', message: MSG.NO_CAMPAIGN };
    }

    const existing = await this.prisma.receipt.findUnique({
      where: { fm_receiptNumber: { fm: qr.fm, receiptNumber: qr.receiptNumber } },
    });
    if (existing) {
      const code = existing.participantId === participant.id ? 'ALREADY_YOURS' : 'DUPLICATE';
      await this.scanLog(input, code, existing.id);
      return { code, message: MSG[code] };
    }

    const device = await this.prisma.fiscalDevice.findUnique({
      where: { fm: qr.fm },
      include: { branch: true },
    });

    const now = new Date();
    const timing = checkReceiptTiming(qr.fiscalAt, now, campaign);

    let status: ReceiptStatus = 'PENDING';
    let rejectCode: string | null = null;
    let code: SubmitCode = 'ACCEPTED';
    if (timing) {
      status = 'REJECTED';
      rejectCode = timing;
      code = timing;
    } else if (!device) {
      // Noma'lum kassa: rad etmaymiz, admin FM'ni filialga bog'lagach qayta ishlanadi
      status = 'NEEDS_REVIEW';
      rejectCode = 'UNKNOWN_FM';
      code = 'REVIEW';
    } else if (!device.branch.isActive) {
      status = 'REJECTED';
      rejectCode = 'BRANCH_INACTIVE';
      code = 'BRANCH_INACTIVE';
    }

    let receipt: Receipt;
    try {
      receipt = await this.prisma.receipt.create({
        data: {
          participantId: participant.id,
          fm: qr.fm,
          receiptNumber: qr.receiptNumber,
          fiscalSign: qr.fiscalSign,
          fiscalAt: qr.fiscalAt,
          rawUrl: qr.rawUrl,
          source,
          status,
          rejectCode,
          rejectReason: rejectCode ? REJECT_TEXT[rejectCode] ?? null : null,
          branchId: device?.branchId ?? null,
          photoFileId: input.photoFileId,
          decidedAt: status === 'REJECTED' ? now : null,
        },
      });
    } catch (e) {
      // Ikki kishi bir vaqtda skanerladi — birinchisi oldi
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        await this.scanLog(input, 'DUPLICATE');
        return { code: 'DUPLICATE', message: MSG.DUPLICATE };
      }
      throw e;
    }
    await this.scanLog(input, code, receipt.id);

    if (rejectCode === 'UNKNOWN_FM') await this.trackUnknownFm(qr.fm, receipt.id);
    if (status !== 'REJECTED') {
      void this.checkSuspicious(participant, qr.fm).catch((e) => this.log.error(e));
      for (const hook of this.afterCreateHooks) {
        await hook(receipt.id).catch((e) => this.log.error(`Darhol solishtirish: ${(e as Error).message}`));
      }
    }

    const view = { ...this.view(receipt), branchName: device?.branch.name ?? null };
    const message =
      code === 'ACCEPTED'
        ? MSG.ACCEPTED(device!.branch.name, qr.fiscalAt)
        : code === 'BEFORE_CAMPAIGN'
          ? MSG.BEFORE_CAMPAIGN(campaign.startsAt)
          : code === 'WINDOW_EXPIRED'
            ? MSG.WINDOW_EXPIRED(campaign.receiptWindowHours)
            : (MSG[code] as string);
    return { code, message, receipt: view };
  }

  /** Mijozning oxirgi cheklari (mini app uchun). */
  listForParticipant(participantId: number, take = 50) {
    return this.prisma.receipt.findMany({
      where: { participantId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        status: true,
        fiscalAt: true,
        receiptNumber: true,
        amount: true,
        couponsCount: true,
        rejectReason: true,
        source: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
    });
  }

  private view(r: Receipt) {
    return { id: r.id, status: r.status, fiscalAt: r.fiscalAt, receiptNumber: r.receiptNumber };
  }

  private async scanLog(input: SubmitInput, result: string, receiptId?: number) {
    await this.prisma.scanLog
      .create({
        data: {
          participantId: input.participant.id,
          tgId: input.participant.tgId,
          channel: input.source,
          rawText: input.text?.slice(0, 1000) ?? null,
          result,
          receiptId,
        },
      })
      .catch((e) => this.log.error(`ScanLog: ${(e as Error).message}`));
  }

  private async trackUnknownFm(fm: string, receiptId: number) {
    const row = await this.prisma.unknownFm.upsert({
      where: { fm },
      create: { fm },
      update: { lastSeen: new Date(), hits: { increment: 1 } },
    });
    await this.alerts.send(
      `⚠️ <b>Noma'lum kassa (FM)</b>: <code>${esc(fm)}</code>\n` +
        `Chek #${receiptId} moderatsiyaga tushdi (jami ${row.hits} ta).\n` +
        `Admin paneldan FM'ni filialga bog'lang.`,
      `unknown-fm:${fm}`,
    );
  }

  private async checkSuspicious(p: Participant, fm: string) {
    const today = await this.prisma.receipt.count({
      where: { participantId: p.id, createdAt: { gte: tashkentDayStart(new Date()) } },
    });
    if (today > SUSPICIOUS_PER_DAY) {
      await this.alerts.send(
        `🚩 <b>Shubhali faollik</b>: ${esc(p.phone ?? '')} (${esc(p.firstName ?? '')}) bugun ${today} ta chek qo'shdi.`,
        `susp-user:${p.id}:${formatTashkent(new Date(), false)}`,
      );
    }
    const hour = await this.prisma.receipt.count({
      where: { fm, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (hour > SUSPICIOUS_FM_PER_HOUR) {
      await this.alerts.send(
        `🚩 <b>Shubhali faollik</b>: FM <code>${esc(fm)}</code> dan oxirgi 1 soatda ${hour} ta chek.`,
        `susp-fm:${fm}`,
      );
    }
  }
}

export const REJECT_TEXT: Record<string, string> = {
  BEFORE_CAMPAIGN: 'Chek aksiya boshlanishidan oldin chiqarilgan',
  AFTER_CAMPAIGN: 'Chek aksiya tugagandan keyin chiqarilgan',
  WINDOW_EXPIRED: "Chek qo'shish muddati o'tgan",
  FUTURE: "Chek sanasi noto'g'ri",
  BRANCH_INACTIVE: 'Filial aksiyada qatnashmaydi',
  UNKNOWN_FM: "Kassa ro'yxatda yo'q — tekshirilmoqda",
  QR_UNREADABLE: "Rasmdagi QR o'qilmadi — tekshirilmoqda",
};

export const MSG = {
  ACCEPTED: (branch: string, at: Date) =>
    `Chek qabul qilindi ✅\n${branch}, ${formatTashkent(at)}\n\nKuponlar ertaga ertalab hisoblanadi.`,
  REVIEW: `Chek qabul qilindi ✅\nU tekshiruvga yuborildi, natijasini xabar qilamiz.`,
  PHOTO_UNREADABLE:
    `Rasmdagi QR kodni o'qib bo'lmadi 😕\nChek tekshiruvga yuborildi, natijasini xabar qilamiz.\n\n` +
    `Tezroq bo'lishi uchun QR kodni yaqinroqdan, aniq qilib qayta suratga oling.`,
  DUPLICATE: `Bu chek allaqachon qo'shilgan.`,
  ALREADY_YOURS: `Bu chekni siz allaqachon qo'shgansiz ✅`,
  INVALID_QR: `Bu fiskal chek QR kodi emas.\nChek pastidagi QR kodni skanerlang.`,
  BEFORE_CAMPAIGN: (startsAt: Date) =>
    `Aksiya ${formatTashkent(startsAt, false)} dan boshlanadi. Bu chek undan oldin chiqarilgan.`,
  AFTER_CAMPAIGN: `Bu chek aksiya tugagandan keyin chiqarilgan.`,
  WINDOW_EXPIRED: (hours: number) => `Chek ${hours} soatdan oldin chiqarilgan. Chekni olgan kuningiz qo'shing.`,
  FUTURE: `Chek sanasi noto'g'ri. Agar xato deb hisoblasangiz, aloqaga chiqing.`,
  BRANCH_INACTIVE: `Bu filial hozir aksiyada qatnashmaydi.`,
  NO_CAMPAIGN: `Hozir faol aksiya yo'q.`,
  RATE_LIMIT: `Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.`,
} as const;
