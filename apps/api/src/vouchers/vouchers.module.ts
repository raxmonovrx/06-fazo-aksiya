import { Global, Module } from '@nestjs/common';

import { ReferralService } from './referral.service.js';
import { VouchersController } from './vouchers.controller.js';
import { VouchersService } from './vouchers.service.js';

@Global()
@Module({
  controllers: [VouchersController],
  providers: [VouchersService, ReferralService],
  exports: [VouchersService, ReferralService],
})
export class VouchersModule {}
