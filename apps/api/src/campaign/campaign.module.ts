import { Global, Module } from '@nestjs/common';

import { CampaignService } from './campaign.service.js';

@Global()
@Module({
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
