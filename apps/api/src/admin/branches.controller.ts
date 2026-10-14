import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Prisma, type AdminUser } from '@prisma/client';
import { z } from 'zod';

import { normalizeFm } from '../core/receipt-qr.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReconcileService } from '../reconcile/reconcile.service.js';
import { AdminGuard, AnyStaff, CurrentAdmin, Perm } from './auth.js';
import { AuditService } from './audit.service.js';
import { parse } from './zod.js';

const money = z.coerce.number().min(0).max(1_000_000_000);
const branchSchema = z.object({
  name: z.string().trim().min(1).max(100),
  brand: z.string().trim().max(100).nullish(),
  isActive: z.boolean().optional(),
  minSum: money.optional(),
  couponPrice: money.positive().optional(),
  maxPerReceipt: z.coerce.number().int().min(1).max(1000).optional(),
  iikoRef: z.object({ host: z.string().optional(), department: z.string().optional() }).nullish(),
});
const deviceSchema = z.object({
  fm: z.string().trim().min(6).max(30),
  legalName: z.string().trim().max(200).nullish(),
  stir: z.string().trim().max(20).nullish(),
  note: z.string().trim().max(500).nullish(),
});

@Controller('admin')
@UseGuards(AdminGuard)
@Perm('branches')
export class BranchesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reconcile: ReconcileService,
  ) {}

  @Get('branches')
  // Filtrlar va kassa uchun hamma xodimga kerak
  @AnyStaff()
  list() {
    return this.prisma.branch.findMany({
      orderBy: { id: 'asc' },
      include: {
        devices: { orderBy: { id: 'asc' } },
        terminals: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      },
    });
  }

  @Post('branches')
  async create(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(branchSchema, body);
    const b = await this.prisma.branch.create({ data: { ...data, iikoRef: data.iikoRef ?? undefined } });
    await this.audit.log(admin.id, 'branch.create', 'branch', b.id, data);
    return b;
  }

  @Patch('branches/:id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(branchSchema.partial(), body);
    const before = await this.prisma.branch.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const b = await this.prisma.branch.update({
      where: { id },
      data: { ...data, iikoRef: data.iikoRef === null ? Prisma.DbNull : (data.iikoRef ?? undefined) },
    });
    await this.audit.log(admin.id, 'branch.update', 'branch', id, { before, after: data });
    return b;
  }

  /** FM qo'shilganda shu FM bilan moderatsiyada turgan cheklar avtomatik qayta ishlanadi. */
  @Post('branches/:id/devices')
  async addDevice(@Param('id', ParseIntPipe) branchId: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(deviceSchema, body);
    const fm = normalizeFm(data.fm);
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException();
    let device;
    try {
      device = await this.prisma.fiscalDevice.create({ data: { ...data, fm, branchId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException("Bu FM allaqachon ro'yxatda");
      }
      throw e;
    }
    const waiting = await this.prisma.receipt.findMany({
      where: { fm, status: 'NEEDS_REVIEW', rejectCode: 'UNKNOWN_FM' },
      select: { id: true },
    });
    await this.prisma.receipt.updateMany({
      where: { id: { in: waiting.map((r) => r.id) } },
      data: branch.isActive
        ? { status: 'PENDING', rejectCode: null, rejectReason: null, branchId }
        : { status: 'REJECTED', rejectCode: 'BRANCH_INACTIVE', rejectReason: 'Filial aksiyada qatnashmaydi', branchId, decidedAt: new Date() },
    });
    for (const r of waiting) await this.reconcile.reconcileOne(r.id);
    await this.prisma.unknownFm.deleteMany({ where: { fm } });
    await this.audit.log(admin.id, 'device.create', 'fiscal_device', device.id, { ...data, fm, branchId, released: waiting.length });
    return { ...device, released: waiting.length };
  }

  @Delete('devices/:id')
  async removeDevice(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: AdminUser) {
    const d = await this.prisma.fiscalDevice.delete({ where: { id } }).catch(() => null);
    if (!d) throw new NotFoundException();
    await this.audit.log(admin.id, 'device.delete', 'fiscal_device', id, d);
    return { ok: true };
  }

  @Get('unknown-fms')
  @Perm('branches', 'moderation')
  unknownFms() {
    return this.prisma.unknownFm.findMany({ orderBy: { lastSeen: 'desc' } });
  }
}
