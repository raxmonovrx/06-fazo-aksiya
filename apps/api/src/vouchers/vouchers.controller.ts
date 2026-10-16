import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import { z } from 'zod';

import { AdminGuard, CurrentAdmin, Perm } from '../admin/auth.js';
import { parse } from '../admin/zod.js';
import { VouchersService } from './vouchers.service.js';

const issueSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000_000),
  branchId: z.coerce.number().int().optional(),
  terminalId: z.coerce.number().int().optional(),
  customerName: z.string().trim().max(100).optional(),
  customerPhone: z.string().trim().max(30).optional(),
});
const cancelSchema = z.object({ reason: z.string().trim().min(2).max(300) });
const listSchema = z.object({
  status: z.string().optional(),
  branchId: z.coerce.number().int().optional(),
  issuedById: z.coerce.number().int().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  flagged: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

/** ISO sana (panel "2026-10-15T00:00:00+05:00" yuboradi); noto'g'ri bo'lsa — filtr yo'q */
const parseDate = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Kassa: vaucher chiqarish, ro'yxat, qayta chop etish, bekor qilish. */
@Controller('admin/vouchers')
@UseGuards(AdminGuard)
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Post()
  @Perm('cashier')
  issue(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.issue(admin, parse(issueSchema, body));
  }

  @Get()
  @Perm('cashier', 'vouchers')
  list(@Query() query: unknown, @CurrentAdmin() admin: AdminUser) {
    const q = parse(listSchema, query);
    return this.vouchers.list(admin, { ...q, from: parseDate(q.from), to: parseDate(q.to), flagged: q.flagged === 'true' });
  }

  @Get(':id/status')
  @Perm('cashier', 'vouchers')
  status(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.status(admin, id);
  }

  @Post(':id/reprint')
  @HttpCode(200)
  @Perm('cashier', 'vouchers.cancel')
  reprint(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.reprint(admin, id);
  }

  /** Skanerlangan QR'ning kuponlarini bekor qilish (firibgarlik) — faqat `vouchers.revoke` ruxsati */
  @Post(':id/revoke')
  @HttpCode(200)
  @Perm('vouchers.revoke')
  revoke(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.revoke(admin, id, parse(cancelSchema, body).reason);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Perm('vouchers.revoke')
  restore(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.restore(admin, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Perm('cashier', 'vouchers.cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.cancel(admin, id, parse(cancelSchema, body).reason);
  }
}
