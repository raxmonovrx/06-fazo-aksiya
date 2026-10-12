import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { BotModule } from './bot/bot.module.js';
import { CampaignModule } from './campaign/campaign.module.js';
import { HealthController } from './health.controller.js';
import { ParticipantsModule } from './participants/participants.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReceiptsModule } from './receipts/receipts.module.js';
import { TelegramModule } from './telegram/telegram.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    CampaignModule,
    TelegramModule,
    ParticipantsModule,
    BotModule,
    ReceiptsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
