import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Bot } from 'grammy';
import { z } from 'zod';

import { esc } from '../bot/texts.js';
import { CampaignService } from '../campaign/campaign.service.js';
import { tashkentMonthStart } from '../core/time.js';
import { isRegistered } from '../participants/participants.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BOT } from '../telegram/bot.token.js';

export const referralSettingsSchema = z.object({
  enabled: z.boolean(),
  // Bitta do'st uchun necha kupon
  couponsPerFriend: z.coerce.number().int().min(1).max(10),
  // Bitta odam bir oyda taklif orqali ko'pi bilan shuncha kupon oladi
  monthlyCap: z.coerce.number().int().min(1).max(1000),
});
export type ReferralSettings = z.infer<typeof referralSettingsSchema>;

export const REFERRAL_DEFAULTS: ReferralSettings = { enabled: true, couponsPerFriend: 1, monthlyCap: 10 };
const KEY = 'referral';

/** Nega bonus berilmadi — audit/test uchun */
export type ReferralOutcome =
  | { granted: number; inviterId: number }
  | { skipped: 'OFF' | 'NO_INVITER' | 'DONE' | 'NOT_FIRST' | 'STAFF' | 'INVITER_INACTIVE' | 'NO_CAMPAIGN' | 'CAP' };

/**
 * Taklif bonusi: havola orqali kelgan do'st birinchi QR'ini skanerlaganda
 * (ya'ni haqiqatan xarid qilganda) taklif qilganga kupon beriladi. Faqat
 * ro'yxatdan o'tish yoki havolani bosish hech narsa bermaydi.
 */
@Injectable()
export class ReferralService {
  private readonly log = new Logger(ReferralService.name);
  private cache: { value: ReferralSettings; at: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignService,
    @Inject(BOT) private readonly bot: Bot,
  ) {}

  async settings(): Promise<ReferralSettings> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.value;
    const row = await this.prisma.setting.findUnique({ where: { key: KEY } });
    const parsed = referralSettingsSchema.safeParse({ ...REFERRAL_DEFAULTS, ...((row?.value as object) ?? {}) });
    const value = parsed.success ? parsed.data : REFERRAL_DEFAULTS;
    this.cache = { value, at: Date.now() };
    return value;
  }

  async saveSettings(value: ReferralSettings) {
    await this.prisma.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: value as unknown as Prisma.InputJsonValue },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    this.cache = null;
    return value;
  }

  /** Do'st QR'ni muvaffaqiyatli skanerlagandan keyin chaqiriladi. */
  async onFriendRedeemed(friendId: number, branchId: number, friendIsStaff: boolean): Promise<ReferralOutcome> {
    const cfg = await this.settings();
    if (!cfg.enabled) return { skipped: 'OFF' };
    const friend = await this.prisma.participant.findUnique({ where: { id: friendId }, include: { referredBy: true } });
    const inviter = friend?.referredBy;
    if (!friend || !inviter) return { skipped: 'NO_INVITER' };

    // Atomar: bitta do'st uchun faqat bir marta (ikki QR bir vaqtda skanerlansa ham)
    const now = new Date();
    const claim = await this.prisma.participant.updateMany({
      where: { id: friendId, referralBonusAt: null },
      data: { referralBonusAt: now },
    });
    if (!claim.count) return { skipped: 'DONE' };

    // Faqat birinchi QR (bonus yoqilishidan oldin skanerlagan bo'lsa ham — hisoblanmaydi)
    if ((await this.prisma.voucher.count({ where: { redeemedById: friendId } })) !== 1) return { skipped: 'NOT_FIRST' };
    if (friendIsStaff || inviter.isStaff) return { skipped: 'STAFF' };
    if (inviter.isBlocked || !isRegistered(inviter)) return { skipped: 'INVITER_INACTIVE' };
    const campaign = await this.campaigns.getActive();
    if (!campaign) return { skipped: 'NO_CAMPAIGN' };

    const used = await this.prisma.receipt.aggregate({
      where: { participantId: inviter.id, source: 'REFERRAL', createdAt: { gte: tashkentMonthStart(now) } },
      _sum: { couponsCount: true },
    });
    const give = Math.min(cfg.couponsPerFriend, cfg.monthlyCap - (used._sum.couponsCount ?? 0));
    if (give <= 0) return { skipped: 'CAP' };

    await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          participantId: inviter.id,
          source: 'REFERRAL',
          status: 'APPROVED',
          // Qaysi do'st uchun — ishtirokchi ID
          receiptNumber: `R${friend.id}`,
          fiscalAt: now,
          branchId,
          couponsCount: give,
          decidedAt: now,
          notifiedAt: now,
        },
      });
      await tx.coupon.createMany({
        data: Array.from({ length: give }, () => ({
          campaignId: campaign.id,
          participantId: inviter.id,
          receiptId: receipt.id,
          eligible: true,
        })),
      });
    });

    const total = await this.prisma.coupon.count({ where: { participantId: inviter.id, eligible: true } });
    const who = friend.firstName ? `Do'stingiz ${esc(friend.firstName)}` : "Siz taklif qilgan do'stingiz";
    await this.bot.api
      .sendMessage(
        Number(inviter.tgId),
        `🎉 ${who} birinchi xaridini qildi — <b>+${give} bonus kupon</b>!\n🎟 Jami kuponlaringiz: <b>${total} ta</b>`,
        { parse_mode: 'HTML' },
      )
      .catch((e) => this.log.warn(`Taklif bonusi xabari yetmadi (${inviter.id}): ${(e as Error).message}`));
    return { granted: give, inviterId: inviter.id };
  }
}
