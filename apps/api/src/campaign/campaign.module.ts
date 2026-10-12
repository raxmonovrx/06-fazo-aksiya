import { Global, Module } from '@nestjs/common';

import { CampaignService } from './campaign.service.js';
import { PublicController } from './public.controller.js';

@Global()
@Module({
  controllers: [PublicController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
