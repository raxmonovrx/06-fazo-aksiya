import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { Bot } from 'grammy';
import { z } from 'zod';

import { CampaignService } from '../campaign/campaign.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ParticipantsService } from '../participants/participants.service.js';
import { RateLimiter } from '../core/rate-limiter.js';
import { parseVoucherToken } from '../core/voucher-token.js';
import { VouchersService } from '../vouchers/vouchers.service.js';
import { BOT } from '../telegram/bot.token.js';
import { MiniappGuard, type MiniappRequest } from './miniapp.guard.js';

const submitSchema = z.object({ text: z.string().min(1).max(2000) });

@Controller('miniapp')
@UseGuards(MiniappGuard)
export class MiniappController {
  private readonly hintLimiter = new RateLimiter(3, 60_000);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly participants: ParticipantsService,
    private readonly campaigns: CampaignService,
    private readonly prisma: PrismaService,
    private readonly vouchers: VouchersService,
  ) {}

  @Get('me')
  async me(@Req() req: MiniappRequest) {
    const p = req.participant;
    const [summary, receipts, campaign, branches] = await Promise.all([
      this.participants.summary(p.id),
      // Kupon yozuvlari: kassa QR'i (VOUCHER) va taklif bonusi (REFERRAL)
      this.prisma.receipt.findMany({
        where: { participantId: p.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          status: true,
          fiscalAt: true,
          receiptNumber: true,
          amount: true,
          couponsCount: true,
          source: true,
          createdAt: true,
          branch: { select: { name: true } },
        },
      }),
      this.campaigns.getActive(),
      this.prisma.branch.findMany({ where: { isActive: true }, select: { minSum: true, couponPrice: true } }),
    ]);
    // Qoidalar ekrani uchun: hamma filialda bir xil bo'lsa — raqam, aks holda null ("filialga qarab")
    const same = (vals: number[]) => (vals.length && vals.every((v) => v === vals[0]) ? vals[0] : null);
    return {
      participant: { firstName: p.firstName, phone: p.phone, refCode: p.refCode },
      coupons: summary.coupons,
      receipts,
      campaign: campaign && {
        name: campaign.name,
        startsAt: campaign.startsAt,
        endsAt: campaign.endsAt,
        receiptWindowHours: campaign.receiptWindowHours,
        rulesText: campaign.rulesText,
      },
      rules: {
        couponPrice: same(branches.map((b) => Number(b.couponPrice))),
        minSum: same(branches.map((b) => Number(b.minSum))),
      },
      isStaff: p.isStaff,
    };
  }

  /** Skaner natijasi: kassir bergan QR (t.me/<bot>?start=v_<token>). Soliq cheki QR'i qabul qilinmaydi. */
  @Post('receipts')
  @HttpCode(200)
  async submit(@Req() req: MiniappRequest, @Body() body: unknown) {
    const parsed = submitSchema.safeParse(body);
    const text = parsed.success ? parsed.data.text : '';
    const token = parseVoucherToken(text);
    if (token) {
      const r = await this.vouchers.redeem(req.participant, token);
      return { code: r.code, couponsCount: r.couponsCount, amount: r.amount, branchName: r.branchName, totalCoupons: r.totalCoupons, isStaff: r.isStaff };
    }
    if (/ofd\.soliq\.uz/i.test(text)) return { code: 'FISCAL_DISABLED' };
    return { code: 'INVALID' };
  }

  /** "QR rasmini botga yuborish": bot chatga yo'riqnoma yuboradi, mini app esa yopiladi. */
  @Post('photo-hint')
  @HttpCode(200)
  async photoHint(@Req() req: MiniappRequest) {
    const p = req.participant;
    if (this.hintLimiter.hit(String(p.id))) {
      await this.bot.api
        .sendMessage(Number(p.tgId), "📷 Kassir bergan QR'ning rasmini shu yerga yuboring.\nQR aniq va to'liq ko'rinsin.")
        .catch(() => undefined);
    }
    return { ok: true };
  }
}
