import { Global, Module } from '@nestjs/common';

import { MiniappController } from '../miniapp/miniapp.controller.js';
import { MiniappGuard } from '../miniapp/miniapp.guard.js';
import { ReceiptsBotHandlers } from './receipts.bot.js';
import { ReceiptsService } from './receipts.service.js';

@Global()
@Module({
  controllers: [MiniappController],
  providers: [ReceiptsService, ReceiptsBotHandlers, MiniappGuard],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
