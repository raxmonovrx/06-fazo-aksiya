import { Injectable } from '@nestjs/common';
import type { Campaign } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CampaignService {
  private cache: { value: Campaign | null; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Faol aksiya (30 soniya keshlanadi — har skanerda bazaga bormaslik uchun). */
  async getActive(): Promise<Campaign | null> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.value;
    const value = await this.prisma.campaign.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    this.cache = { value, at: Date.now() };
    return value;
  }

  invalidate() {
    this.cache = null;
  }
}
