import { Global, Module } from '@nestjs/common';

import { BotService } from './bot.service.js';
import { WebhookController } from './webhook.controller.js';

@Global()
@Module({
  controllers: [WebhookController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
