import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import { z } from 'zod';

import { PrismaService } from '../prisma/prisma.service.js';
import { AdminGuard, CurrentAdmin, Perm } from './auth.js';
import { AuditService } from './audit.service.js';
import { can } from './permissions.js';
import { parse } from './zod.js';

const terminalSchema = z.object({
  name: z.string().trim().min(1).max(60),
  output: z.enum(['PRINT_80', 'PRINT_58', 'SCREEN']),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
});
const listSchema = z.object({ branchId: z.coerce.number().int().optional() });

const ORDER = [{ sortOrder: 'asc' as const }, { id: 'asc' as const }];

/** Kassa qurilmalari: admin filialga qo'shadi, kassir Kassa sahifasida tugma sifatida ko'radi. */
@Controller('admin')
@UseGuards(AdminGuard)
@Perm('branches')
export class TerminalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Kassa uchun: o'z filialining faol qurilmalari (filialga biriktirilmagan admin — tanlangan filial) */
  @Get('terminals')
  @Perm('cashier', 'branches')
  list(@Query() query: unknown, @CurrentAdmin() admin: AdminUser) {
    const { branchId } = parse(listSchema, query);
    const id = admin.branchId ?? branchId;
    if (!id) throw new BadRequestException('Filialni tanlang');
    return this.prisma.terminal.findMany({
      where: { branchId: id, ...(!can(admin, 'branches') && { isActive: true }) },
      orderBy: ORDER,
    });
  }

  @Post('branches/:id/terminals')
  async create(@Param('id', ParseIntPipe) branchId: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(terminalSchema, body);
    this.assertBranch(admin, branchId);
    if (!(await this.prisma.branch.findUnique({ where: { id: branchId } }))) throw new NotFoundException();
    const t = await this.prisma.terminal.create({ data: { ...data, branchId } });
    await this.audit.log(admin.id, 'terminal.create', 'terminal', t.id, { ...data, branchId });
    return t;
  }

  @Patch('terminals/:id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(terminalSchema.partial(), body);
    const before = await this.prisma.terminal.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    this.assertBranch(admin, before.branchId);
    const t = await this.prisma.terminal.update({ where: { id }, data });
    await this.audit.log(admin.id, 'terminal.update', 'terminal', id, { before, after: data });
    return t;
  }

  /** QR chiqargan qurilma tarix uchun qoladi — faqat o'chiriladi (faolsiz) */
  @Delete('terminals/:id')
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: AdminUser) {
    const t = await this.prisma.terminal.findUnique({ where: { id }, include: { _count: { select: { vouchers: true } } } });
    if (!t) throw new NotFoundException();
    this.assertBranch(admin, t.branchId);
    if (t._count.vouchers) {
      await this.prisma.terminal.update({ where: { id }, data: { isActive: false } });
      await this.audit.log(admin.id, 'terminal.archive', 'terminal', id, { name: t.name });
      return { ok: true, archived: true };
    }
    await this.prisma.terminal.delete({ where: { id } });
    await this.audit.log(admin.id, 'terminal.delete', 'terminal', id, { name: t.name });
    return { ok: true, archived: false };
  }

  /** Filialga biriktirilgan xodim faqat o'z filialining qurilmalarini boshqaradi */
  private assertBranch(admin: AdminUser, branchId: number) {
    if (admin.role !== 'ADMIN' && admin.branchId && admin.branchId !== branchId) throw new ForbiddenException();
  }
}
