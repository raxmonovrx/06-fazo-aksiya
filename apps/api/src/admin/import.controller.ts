import { BadRequestException, Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { AdminUser } from '@prisma/client';
import { z } from 'zod';

import { PrismaService } from '../prisma/prisma.service.js';
import { ImportService } from '../reconcile/import.service.js';
import { ReconcileService } from '../reconcile/reconcile.service.js';
import { AdminGuard, CurrentAdmin, Roles } from './auth.js';
import { AuditService } from './audit.service.js';
import { parse } from './zod.js';

const col = z.number().int().min(0).optional();
const commitSchema = z.object({
  token: z.string(),
  defaultBranchId: z.number().int().nullable().default(null),
  mapping: z
    .object({ amount: z.number().int().min(0), closedAt: col, date: col, time: col, fm: col, receiptNumber: col, branch: col, refund: col })
    .refine((m) => m.closedAt !== undefined || m.date !== undefined, { message: 'Sana ustunini tanlang' }),
});

@Controller('admin')
@UseGuards(AdminGuard)
@Roles('ADMIN')
export class ImportController {
  constructor(
    private readonly imports: ImportService,
    private readonly reconcile: ReconcileService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 30 * 1024 * 1024 } }))
  preview(@UploadedFile() file: { buffer: Buffer; originalname: string } | undefined) {
    if (!file) throw new BadRequestException('Fayl tanlanmagan');
    return this.imports.preview(file.buffer, Buffer.from(file.originalname, 'latin1').toString('utf8'));
  }

  @Post('import/commit')
  async commit(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(commitSchema, body);
    const res = await this.imports.commit(data.token, data.mapping, data.defaultBranchId, admin.id);
    await this.audit.log(admin.id, 'import.excel', 'import_batch', res.batchId, {
      rows: res.rows,
      inserted: res.inserted,
      matched: res.matched,
      mapping: data.mapping,
    });
    return res;
  }

  @Get('import/batches')
  batches() {
    return this.prisma.importBatch.findMany({
      orderBy: { id: 'desc' },
      take: 50,
      include: { createdBy: { select: { login: true } } },
    });
  }

  @Post('reconcile/run')
  async run(@CurrentAdmin() admin: AdminUser) {
    const report = await this.reconcile.reconcileAll();
    await this.audit.log(admin.id, 'reconcile.run', 'reconcile', null, report);
    return report;
  }
}
