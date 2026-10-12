import { Module } from '@nestjs/common';

import { IikoSource } from '../iiko/iiko.source.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [JobsController],
  providers: [JobsService, NotificationsService, IikoSource],
})
export class JobsModule {}
