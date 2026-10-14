import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { Prisma, type AdminUser } from '@prisma/client';
import { z } from 'zod';

import { decodeImageDataUrl, toImageDataUrl } from '../core/image-data-url.js';
import { normalizeFm } from '../core/receipt-qr.js';
import { resolveReceiptTexts, receiptTextsSchema } from '../core/receipt-texts.js';
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
const logoSchema = z.object({
  enabled: z.boolean(),
  threshold: z.coerce.number().int().min(0).max(255),
  invert: z.boolean(),
  // Berilmasa — o'zgarmaydi; null — logoni o'chirish
  original: z.string().max(3_000_000).nullable().optional(),
  print: z.string().max(1_000_000).nullable().optional(),
  texts: receiptTextsSchema.optional(),
  // Matnlarni barcha filiallarga ham qo'llash (logo — faqat shu filialga)
  textsToAll: z.boolean().optional(),
});
/** Asl rasm (qayta sozlash uchun) va chekka chiqadigan oq-qora PNG chegaralari */
const LOGO_ORIGINAL_MAX = 1_500_000;
const LOGO_PRINT_MAX = 500_000;

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

  /** Chek sozlamasi: logo (asl rasm bilan — panelda qayta oq-qora qilish uchun) va matnlar */
  @Get('branches/:id/receipt')
  async receipt(@Param('id', ParseIntPipe) id: number) {
    const b = await this.prisma.branch.findUnique({ where: { id }, omit: { logoOriginal: false, logoPrint: false } });
    if (!b) throw new NotFoundException();
    return {
      enabled: b.logoEnabled,
      threshold: b.logoThreshold,
      invert: b.logoInvert,
      updatedAt: b.logoUpdatedAt,
      original: toImageDataUrl(b.logoOriginal),
      print: toImageDataUrl(b.logoPrint),
      texts: resolveReceiptTexts(b.receiptTexts),
    };
  }

  @Put('branches/:id/receipt')
  async saveReceipt(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(logoSchema, body);
    const b = await this.prisma.branch.findUnique({ where: { id }, omit: { logoPrint: false } });
    if (!b) throw new NotFoundException();

    const bytes: { logoOriginal?: Uint8Array<ArrayBuffer> | null; logoPrint?: Uint8Array<ArrayBuffer> | null } = {};
    if (data.original !== undefined) {
      const v = data.original === null ? null : decodeImageDataUrl(data.original, LOGO_ORIGINAL_MAX);
      if (typeof v === 'string') throw new BadRequestException(v);
      bytes.logoOriginal = v;
    }
    if (data.print !== undefined) {
      const v = data.print === null ? null : decodeImageDataUrl(data.print, LOGO_PRINT_MAX, 'image/png');
      if (typeof v === 'string') throw new BadRequestException(v);
      bytes.logoPrint = v;
    }
    const hasPrint = bytes.logoPrint !== undefined ? Boolean(bytes.logoPrint) : Boolean(b.logoPrint);
    if (data.enabled && !hasPrint) throw new BadRequestException('Avval logo yuklang');

    await this.prisma.branch.update({
      where: { id },
      data: {
        logoEnabled: data.enabled,
        logoThreshold: data.threshold,
        logoInvert: data.invert,
        ...bytes,
        ...((bytes.logoOriginal !== undefined || bytes.logoPrint !== undefined) && { logoUpdatedAt: new Date() }),
        ...(data.texts && { receiptTexts: data.texts }),
      },
    });
    if (data.texts && data.textsToAll) {
      await this.prisma.branch.updateMany({ where: { id: { not: id } }, data: { receiptTexts: data.texts } });
    }
    await this.audit.log(admin.id, 'branch.receipt', 'branch', id, {
      ...(data.texts && { texts: data.texts, textsToAll: Boolean(data.textsToAll) }),
      enabled: data.enabled,
      threshold: data.threshold,
      invert: data.invert,
      ...(bytes.logoPrint !== undefined && { print: bytes.logoPrint ? `${bytes.logoPrint.length} B` : null }),
    });
    return this.receipt(id);
  }

  @Get('unknown-fms')
  @Perm('branches', 'moderation')
  unknownFms() {
    return this.prisma.unknownFm.findMany({ orderBy: { lastSeen: 'desc' } });
  }
}
