import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { CampaignService } from '../campaign/campaign.service.js';
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
  ) {}

  @Get('me')
  async me(@Req() req: MiniappRequest) {
    const p = req.participant;
    const [summary, receipts, campaign] = await Promise.all([
      this.participants.summary(p.id),
      this.receipts.listForParticipant(p.id),
      this.campaigns.getActive(),
    ]);
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
