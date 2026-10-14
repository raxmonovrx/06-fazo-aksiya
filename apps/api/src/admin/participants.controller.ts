import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminUser, Prisma } from '@prisma/client';
import { z } from 'zod';

import { normalizePhone } from '../core/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminGuard, CurrentAdmin, Perm } from './auth.js';
import { AuditService } from './audit.service.js';
import { parse } from './zod.js';

const listSchema = z.object({
  q: z.string().optional(),
  staff: z.enum(['true', 'false']).optional(),
  blocked: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const patchSchema = z.object({ isBlocked: z.boolean().optional(), isStaff: z.boolean().optional() });
const staffImportSchema = z.object({ text: z.string().max(2_000_000), replace: z.boolean().default(false) });

@Controller('admin')
@UseGuards(AdminGuard)
@Perm('participants')
export class ParticipantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('participants')
  async list(@Query() query: unknown) {
    const q = parse(listSchema, query);
    const where: Prisma.ParticipantWhereInput = {};
    if (q.q?.trim()) {
      const s = q.q.trim();
      const digits = s.replace(/\D/g, '');
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { username: { contains: s.replace('@', ''), mode: 'insensitive' } },
        { refCode: s.toUpperCase() },
        ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
      ];
    }
    if (q.staff) where.isStaff = q.staff === 'true';
    if (q.blocked) where.isBlocked = q.blocked === 'true';
    const [total, items] = await Promise.all([
      this.prisma.participant.count({ where }),
      this.prisma.participant.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { _count: { select: { receipts: true, coupons: { where: { eligible: true } } } } },
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items };
  }

  @Get('participants/:id')
  async detail(@Param('id', ParseIntPipe) id: number) {
    const p = await this.prisma.participant.findUnique({
      where: { id },
      include: {
        referredBy: { select: { id: true, phone: true, firstName: true } },
        _count: { select: { referrals: true } },
        receipts: { orderBy: { id: 'desc' }, take: 100, include: { branch: { select: { name: true } } } },
      },
    });
    if (!p) throw new NotFoundException();
    const coupons = await this.prisma.coupon.groupBy({ by: ['eligible'], where: { participantId: id }, _count: { _all: true } });
    return {
      ...p,
      coupons: {
        eligible: coupons.find((c) => c.eligible)?._count._all ?? 0,
        ineligible: coupons.find((c) => !c.eligible)?._count._all ?? 0,
      },
    };
  }

  @Patch('participants/:id')
  @Perm('participants.edit')
  async patch(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(patchSchema, body);
    const p = await this.prisma.participant.update({ where: { id }, data }).catch(() => null);
    if (!p) throw new NotFoundException();
    if (data.isStaff !== undefined) await syncCouponEligibility(this.prisma, [id]);
    await this.audit.log(admin.id, 'participant.update', 'participant', id, data);
    return p;
  }

  // ── Xodimlar ───────────────────────────────────────────────────────────

  @Get('staff')
  @Perm('staff')
  staff() {
    return this.prisma.staffPhone.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /**
   * CSV/matn: har qatorda telefon va ixtiyoriy ism ("+998901234567;Ali Valiyev").
   * `replace` — ro'yxatni to'liq almashtirish.
   */
  @Post('staff/import')
  @Perm('staff')
  async importStaff(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const { text, replace } = parse(staffImportSchema, body);
    const rows = new Map<string, string | null>();
    const invalid: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parts = line.split(/[;,\t]/).map((s) => s.trim());
      const phoneIdx = parts.findIndex((s) => normalizePhone(s));
      if (phoneIdx < 0) {
        if (!/telefon|phone|номер/i.test(line)) invalid.push(line.slice(0, 60));
        continue;
      }
      const name = parts.filter((_, i) => i !== phoneIdx).join(' ').trim() || null;
      rows.set(normalizePhone(parts[phoneIdx])!, name);
    }
    if (!rows.size) throw new BadRequestException("Birorta ham to'g'ri telefon topilmadi");

    await this.prisma.$transaction(async (tx) => {
      if (replace) await tx.staffPhone.deleteMany({ where: { phone: { notIn: [...rows.keys()] } } });
      for (const [phone, name] of rows) {
        await tx.staffPhone.upsert({ where: { phone }, create: { phone, name, source: 'CSV' }, update: { name: name ?? undefined } });
      }
    });
    const affected = await syncStaffFlags(this.prisma);
    await this.audit.log(admin.id, 'staff.import', 'staff', null, { count: rows.size, replace, invalid: invalid.length, affected });
    return { imported: rows.size, invalid, participantsUpdated: affected };
  }

  @Delete('staff/:phone')
  @Perm('staff')
  async removeStaff(@Param('phone') phone: string, @CurrentAdmin() admin: AdminUser) {
    const p = normalizePhone(phone);
    if (!p) throw new BadRequestException();
    await this.prisma.staffPhone.deleteMany({ where: { phone: p } });
    const affected = await syncStaffFlags(this.prisma);
    await this.audit.log(admin.id, 'staff.delete', 'staff', p, { affected });
    return { ok: true };
  }
}

/** participants.isStaff ni staff_phones bilan moslaydi va kuponlarni qayta belgilaydi. */
export async function syncStaffFlags(prisma: PrismaService): Promise<number> {
  const changed = await prisma.$queryRaw<Array<{ id: number }>>`
    UPDATE participants p
    SET "isStaff" = EXISTS (SELECT 1 FROM staff_phones s WHERE s.phone = p.phone), "updatedAt" = now()
    WHERE p."isStaff" <> EXISTS (SELECT 1 FROM staff_phones s WHERE s.phone = p.phone)
    RETURNING p.id`;
  if (changed.length) await syncCouponEligibility(prisma, changed.map((c) => c.id));
  return changed.length;
}

/** Xodim kuponlari o'yinda qatnashmaydi; faqat APPROVED cheklarning kuponlari eligible bo'la oladi. */
export async function syncCouponEligibility(prisma: PrismaService, participantIds: number[]) {
  if (!participantIds.length) return;
  await prisma.$executeRaw`
    UPDATE coupons c
    SET eligible = (NOT p."isStaff" AND r.status = 'APPROVED')
    FROM participants p, receipts r
    WHERE c."participantId" = p.id AND c."receiptId" = r.id AND p.id = ANY(${participantIds})`;
}
