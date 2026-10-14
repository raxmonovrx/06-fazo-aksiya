import { Global, Module } from '@nestjs/common';

import { BotService } from './bot.service.js';
import { VoucherScanHandlers } from './voucher-scan.bot.js';
import { WebhookController } from './webhook.controller.js';

@Global()
@Module({
  controllers: [WebhookController],
  providers: [BotService, VoucherScanHandlers],
  exports: [BotService],
})
export class BotModule {}
