import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { CampaignService } from '../campaign/campaign.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ParticipantsService } from '../participants/participants.service.js';
import { ReceiptsService } from '../receipts/receipts.service.js';
import { MiniappGuard, type MiniappRequest } from './miniapp.guard.js';

const submitSchema = z.object({ text: z.string().min(1).max(2000) });

@Controller('miniapp')
@UseGuards(MiniappGuard)
export class MiniappController {
  constructor(
    private readonly receipts: ReceiptsService,
    private readonly participants: ParticipantsService,
    private readonly campaigns: CampaignService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  async me(@Req() req: MiniappRequest) {
    const p = req.participant;
    const [summary, receipts, campaign, branches] = await Promise.all([
      this.participants.summary(p.id),
      this.receipts.listForParticipant(p.id),
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

  @Post('receipts')
  @HttpCode(200)
  async submit(@Req() req: MiniappRequest, @Body() body: unknown) {
    const parsed = submitSchema.safeParse(body);
    const text = parsed.success ? parsed.data.text : '';
    return this.receipts.submit({ participant: req.participant, text, source: 'QR' });
  }
}
