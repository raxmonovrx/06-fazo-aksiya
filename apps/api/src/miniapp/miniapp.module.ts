import { Module } from '@nestjs/common';

import { MiniappController } from './miniapp.controller.js';
import { MiniappGuard } from './miniapp.guard.js';

@Module({
  controllers: [MiniappController],
  providers: [MiniappGuard],
})
export class MiniappModule {}
