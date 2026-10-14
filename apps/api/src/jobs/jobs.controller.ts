import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';

import { AdminGuard, CurrentAdmin } from '../admin/auth.js';
import { AuditService } from '../admin/audit.service.js';
import { JobsService } from './jobs.service.js';

/** Cron ishlarini qo'lda ishga tushirish (tekshirish uchun). */
@Controller('admin/jobs')
@UseGuards(AdminGuard)
// Perm berilmagan — faqat ADMIN
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  @Post('nightly')
  @HttpCode(200)
  async nightly(@CurrentAdmin() admin: AdminUser) {
    await this.audit.log(admin.id, 'jobs.nightly', 'jobs', null);
    await this.jobs.runNightly();
    return { ok: true };
  }

  @Post('notify')
  @HttpCode(200)
  async notify(@CurrentAdmin() admin: AdminUser) {
    const res = await this.jobs.runMorning();
    await this.audit.log(admin.id, 'jobs.notify', 'jobs', null, res);
    return res;
  }
}
