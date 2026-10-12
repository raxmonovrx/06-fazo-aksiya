import { Controller, Get, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CampaignService } from './campaign.service.js';

/** Ochiq ma'lumot: qoidalar sahifasi uchun (auth'siz). */
@Controller('public')
export class PublicController {
  constructor(
    private readonly campaigns: CampaignService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('campaign')
  async campaign() {
    const c = await this.campaigns.getActive();
    if (!c) throw new NotFoundException();
    const branches = await this.prisma.branch.findMany({
      where: { isActive: true },
      select: { name: true, minSum: true, couponPrice: true, maxPerReceipt: true },
      orderBy: { id: 'asc' },
    });
    return {
      name: c.name,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      receiptWindowHours: c.receiptWindowHours,
      rulesText: c.rulesText,
      branches: branches.map((b) => ({ ...b, minSum: Number(b.minSum), couponPrice: Number(b.couponPrice) })),
    };
  }
}
