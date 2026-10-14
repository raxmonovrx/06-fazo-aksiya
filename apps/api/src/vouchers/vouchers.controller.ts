import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import { z } from 'zod';

import { AdminGuard, CurrentAdmin, Roles } from '../admin/auth.js';
import { parse } from '../admin/zod.js';
import { parseDateTime } from '../reconcile/excel.js';
import { VouchersService } from './vouchers.service.js';

const issueSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000_000),
  branchId: z.coerce.number().int().optional(),
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

const parseDate = (s?: string) => {
  if (!s) return undefined;
  const d = /T.*(Z|[+-]\d{2}:?\d{2})$/.test(s) ? new Date(s) : parseDateTime(s.replace('T', ' '));
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
};

/** Kassa: vaucher chiqarish, ro'yxat, qayta chop etish, bekor qilish. */
@Controller('admin/vouchers')
@UseGuards(AdminGuard)
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Post()
  @Roles('ADMIN', 'CASHIER')
  issue(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.issue(admin, parse(issueSchema, body));
  }

  @Get()
  @Roles('ADMIN', 'OPERATOR', 'CASHIER')
  list(@Query() query: unknown, @CurrentAdmin() admin: AdminUser) {
    const q = parse(listSchema, query);
    return this.vouchers.list(admin, { ...q, from: parseDate(q.from), to: parseDate(q.to), flagged: q.flagged === 'true' });
  }

  @Post(':id/reprint')
  @HttpCode(200)
  @Roles('ADMIN', 'CASHIER')
  reprint(@Param('id', ParseIntPipe) id: number, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.reprint(admin, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('ADMIN', 'CASHIER')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    return this.vouchers.cancel(admin, id, parse(cancelSchema, body).reason);
  }
}
