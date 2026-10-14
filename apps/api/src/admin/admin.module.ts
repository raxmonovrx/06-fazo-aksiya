import { Global, Module } from '@nestjs/common';

import { AdminAuthController } from './auth.controller.js';
import { AdminGuard } from './auth.js';
import { AuditService } from './audit.service.js';
import { BranchesController } from './branches.controller.js';
import { ExportController } from './export.controller.js';
import { ImportController } from './import.controller.js';
import { ParticipantsController } from './participants.controller.js';
import { ReceiptsAdminController } from './receipts-admin.controller.js';
import { SettingsController } from './settings.controller.js';
import { TerminalsController } from './terminals.controller.js';

@Global()
@Module({
  controllers: [
    AdminAuthController,
    BranchesController,
    ReceiptsAdminController,
    ParticipantsController,
    ImportController,
    ExportController,
    SettingsController,
    TerminalsController,
  ],
  providers: [AdminGuard, AuditService],
  exports: [AdminGuard, AuditService],
})
export class AdminModule {}
