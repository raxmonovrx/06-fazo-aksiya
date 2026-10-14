import { Module } from '@nestjs/common';

import { AdminModule } from './admin/admin.module.js';
import { BotModule } from './bot/bot.module.js';
import { CampaignModule } from './campaign/campaign.module.js';
import { HealthController } from './health.controller.js';
import { MiniappModule } from './miniapp/miniapp.module.js';
import { ParticipantsModule } from './participants/participants.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TelegramModule } from './telegram/telegram.module.js';
import { VouchersModule } from './vouchers/vouchers.module.js';

@Module({
  imports: [
    PrismaModule,
    CampaignModule,
    TelegramModule,
    ParticipantsModule,
    BotModule,
    MiniappModule,
    AdminModule,
    VouchersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
