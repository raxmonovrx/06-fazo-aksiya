import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Prisma, type AdminUser } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { CampaignService } from '../campaign/campaign.service.js';
import { tashkentDayStart } from '../core/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminGuard, CurrentAdmin, Roles } from './auth.js';
import { AuditService } from './audit.service.js';
import { parse } from './zod.js';

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  receiptWindowHours: z.coerce.number().int().min(1).max(24 * 30).optional(),
  rulesText: z.string().max(20_000).optional(),
});
const userSchema = z.object({
  login: z.string().trim().min(3).max(32).regex(/^[a-z0-9._-]+$/i),
  password: z.string().min(8).max(200),
  role: z.enum(['ADMIN', 'OPERATOR']),
});
const userPatchSchema = z.object({
  password: z.string().min(8).max(200).optional(),
  role: z.enum(['ADMIN', 'OPERATOR']).optional(),
  isActive: z.boolean().optional(),
});

@Controller('admin')
@UseGuards(AdminGuard)
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignService,
    private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  async dashboard() {
    const todayStart = tashkentDayStart(new Date());
    const [participantsTotal, participantsToday, staff, byStatus, couponsEligible, couponsToday, branches, perBranch] =
      await Promise.all([
        this.prisma.participant.count({ where: { rulesAcceptedAt: { not: null } } }),
        this.prisma.participant.count({ where: { rulesAcceptedAt: { gte: todayStart } } }),
        this.prisma.participant.count({ where: { isStaff: true } }),
        this.prisma.receipt.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.coupon.count({ where: { eligible: true } }),
        this.prisma.coupon.count({ where: { eligible: true, createdAt: { gte: todayStart } } }),
        this.prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
        this.prisma.$queryRaw<Array<{ branchId: number | null; receipts: number; approved: number; amount: string | null; coupons: number }>>`
          SELECT r."branchId",
                 count(*)::int AS receipts,
                 count(*) FILTER (WHERE r.status = 'APPROVED')::int AS approved,
                 sum(r.amount) FILTER (WHERE r.status IN ('APPROVED','BELOW_MIN'))::text AS amount,
                 coalesce(sum(r."couponsCount") FILTER (WHERE r.status = 'APPROVED'), 0)::int AS coupons
          FROM receipts r GROUP BY r."branchId"`,
      ]);
    const receiptsToday = await this.prisma.receipt.count({ where: { createdAt: { gte: todayStart } } });
    const unknownFms = await this.prisma.unknownFm.count();
    return {
      participants: { total: participantsTotal, today: participantsToday, staff },
      receipts: { today: receiptsToday, byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) },
      coupons: { eligible: couponsEligible, today: couponsToday },
      unknownFms,
      branches: [...branches, { id: null, name: "Noma'lum" }].map((b) => {
        const row = perBranch.find((x) => x.branchId === b.id);
        return { ...b, receipts: row?.receipts ?? 0, approved: row?.approved ?? 0, amount: Number(row?.amount ?? 0), coupons: row?.coupons ?? 0 };
      }),
    };
  }

  @Get('settings/campaign')
  async getCampaign() {
    const c = await this.prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
    if (!c) throw new NotFoundException();
    return c;
  }

  @Patch('settings/campaign')
  @Roles('ADMIN')
  async patchCampaign(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(campaignSchema, body);
    const c = await this.prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
    if (!c) throw new NotFoundException();
    if (data.endsAt && (data.startsAt ?? c.startsAt) >= data.endsAt) throw new BadRequestException('Tugash sanasi boshlanishdan keyin bo\'lsin');
    const updated = await this.prisma.campaign.update({ where: { id: c.id }, data });
    this.campaigns.invalidate();
    await this.audit.log(admin.id, 'campaign.update', 'campaign', c.id, { before: c, after: data });
    return updated;
  }

  @Get('users')
  @Roles('ADMIN')
  users() {
    return this.prisma.adminUser.findMany({ select: { id: true, login: true, role: true, isActive: true, createdAt: true }, orderBy: { id: 'asc' } });
  }

  @Post('users')
  @Roles('ADMIN')
  async createUser(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(userSchema, body);
    try {
      const u = await this.prisma.adminUser.create({
        data: { login: data.login, role: data.role, passwordHash: await bcrypt.hash(data.password, 12) },
      });
      await this.audit.log(admin.id, 'admin.create', 'admin', u.id, { login: u.login, role: u.role });
      return { id: u.id, login: u.login, role: u.role };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Bu login band');
      throw e;
    }
  }

  @Patch('users/:id')
  @Roles('ADMIN')
  async patchUser(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(userPatchSchema, body);
    if (id === admin.id && (data.isActive === false || data.role === 'OPERATOR')) {
      throw new BadRequestException("O'zingizni o'chira yoki pasaytira olmaysiz");
    }
    const u = await this.prisma.adminUser
      .update({
        where: { id },
        data: {
          role: data.role,
          isActive: data.isActive,
          ...(data.password && { passwordHash: await bcrypt.hash(data.password, 12) }),
        },
      })
      .catch(() => null);
    if (!u) throw new NotFoundException();
    await this.audit.log(admin.id, 'admin.update', 'admin', id, { ...data, password: data.password ? '***' : undefined });
    return { id: u.id, login: u.login, role: u.role, isActive: u.isActive };
  }
}
