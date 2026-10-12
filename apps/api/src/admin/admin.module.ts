import { Module } from '@nestjs/common';

import { AdminAuthController } from './auth.controller.js';
import { AdminGuard } from './auth.js';
import { AuditService } from './audit.service.js';
import { BranchesController } from './branches.controller.js';
import { ExportController } from './export.controller.js';
import { ImportController } from './import.controller.js';
import { ParticipantsController } from './participants.controller.js';
import { ReceiptsAdminController } from './receipts-admin.controller.js';
import { SettingsController } from './settings.controller.js';

@Module({
  controllers: [
    AdminAuthController,
    BranchesController,
    ReceiptsAdminController,
    ParticipantsController,
    ImportController,
    ExportController,
    SettingsController,
  ],
  providers: [AdminGuard, AuditService],
})
export class AdminModule {}
