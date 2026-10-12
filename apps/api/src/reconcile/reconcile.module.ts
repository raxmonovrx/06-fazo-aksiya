import { Global, Module } from '@nestjs/common';

import { ImportService } from './import.service.js';
import { ReconcileService } from './reconcile.service.js';

@Global()
@Module({
  providers: [ReconcileService, ImportService],
  exports: [ReconcileService, ImportService],
})
export class ReconcileModule {}
