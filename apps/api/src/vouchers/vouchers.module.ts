import { Global, Module } from '@nestjs/common';

import { VouchersController } from './vouchers.controller.js';
import { VouchersService } from './vouchers.service.js';

@Global()
@Module({
  controllers: [VouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
