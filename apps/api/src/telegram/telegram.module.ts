import { Global, Module } from '@nestjs/common';
import { autoRetry } from '@grammyjs/auto-retry';
import { Bot } from 'grammy';

import { config } from '../config.js';
import { AlertsService } from './alerts.service.js';
import { BOT } from './bot.token.js';

export { BOT };

@Global()
@Module({
  providers: [
    {
      provide: BOT,
      useFactory: () => {
        const bot = new Bot(config().BOT_TOKEN);
        // 429 (flood) va 5xx — avtomatik qayta urinish
        bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 30 }));
        return bot;
      },
    },
    AlertsService,
  ],
  exports: [BOT, AlertsService],
})
export class TelegramModule {}
