import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Prisma, type AdminRole, type AdminUser } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { CampaignService } from '../campaign/campaign.service.js';
import { tashkentDayStart } from '../core/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReferralService, referralSettingsSchema } from '../vouchers/referral.service.js';
import { AdminGuard, CurrentAdmin, Perm } from './auth.js';
import { AuditService } from './audit.service.js';
import { BRANCH_ROLES, PERMISSIONS, permissionsOf, ROLE_TEMPLATES, type Permission } from './permissions.js';
import { parse } from './zod.js';

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  receiptWindowHours: z.coerce.number().int().min(1).max(24 * 30).optional(),
  rulesText: z.string().max(20_000).optional(),
});
const roleSchema = z.enum(['ADMIN', 'OPERATOR', 'MANAGER', 'CASHIER']);
const permsSchema = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length);
const userSchema = z.object({
  login: z.string().trim().min(3).max(32).regex(/^[a-z0-9._-]+$/i),
  password: z.string().min(8).max(200),
  role: roleSchema,
  // Berilmasa — rol shabloni
  permissions: permsSchema.optional(),
  branchId: z.number().int().nullable().optional(),
});
const userPatchSchema = z.object({
  password: z.string().min(8).max(200).optional(),
  role: roleSchema.optional(),
  permissions: permsSchema.optional(),
  branchId: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
});
const USER_SELECT = {
  id: true,
  login: true,
  role: true,
  permissions: true,
  isActive: true,
  createdAt: true,
  branchId: true,
  branch: { select: { id: true, name: true } },
} satisfies Prisma.AdminUserSelect;

/** Rol, filial va ruxsatlar birga to'g'rimi — saqlanadigan qiymatlarni qaytaradi */
function normalizeAccess(role: AdminRole, branchId: number | null | undefined, permissions: readonly Permission[] | undefined) {
  if (BRANCH_ROLES.includes(role) && !branchId) throw new BadRequestException('Bu rol uchun filialni tanlang');
  return {
    // ADMIN hamma filialni ko'radi — filial cheklovi yo'q
    branchId: role === 'ADMIN' ? null : (branchId ?? null),
    permissions: role === 'ADMIN' ? [] : [...new Set(permissions ?? ROLE_TEMPLATES[role])],
  };
}

@Controller('admin')
@UseGuards(AdminGuard)
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignService,
    private readonly audit: AuditService,
    private readonly referral: ReferralService,
  ) {}

  @Get('dashboard')
  @Perm('dashboard')
  async dashboard() {
    const now = new Date();
    const todayStart = tashkentDayStart(now);
    const [participantsTotal, participantsToday, staff, couponsEligible, couponsToday, referralCoupons, issuedToday, redeemedToday, states, branches, perBranch] =
      await Promise.all([
        this.prisma.participant.count({ where: { rulesAcceptedAt: { not: null } } }),
        this.prisma.participant.count({ where: { rulesAcceptedAt: { gte: todayStart } } }),
        this.prisma.participant.count({ where: { isStaff: true } }),
        this.prisma.coupon.count({ where: { eligible: true } }),
        this.prisma.coupon.count({ where: { eligible: true, createdAt: { gte: todayStart } } }),
        this.prisma.coupon.count({ where: { eligible: true, receipt: { source: 'REFERRAL' } } }),
        this.prisma.voucher.count({ where: { issuedAt: { gte: todayStart } } }),
        this.prisma.voucher.count({ where: { redeemedAt: { gte: todayStart } } }),
        this.prisma.$queryRaw<Array<{ state: string; n: number }>>`
          SELECT CASE WHEN status = 'ISSUED' AND "expiresAt" <= ${now} THEN 'EXPIRED' ELSE status::text END AS state,
                 count(*)::int AS n
          FROM vouchers GROUP BY 1`,
        this.prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
        this.prisma.$queryRaw<Array<{ branchId: number; issued: number; redeemed: number; amount: string | null; coupons: number }>>`
          SELECT v."branchId",
                 count(*) FILTER (WHERE v.status <> 'CANCELLED')::int AS issued,
                 count(*) FILTER (WHERE v.status = 'REDEEMED')::int AS redeemed,
                 sum(v.amount) FILTER (WHERE v.status = 'REDEEMED')::text AS amount,
                 coalesce(sum(v."couponsCount") FILTER (WHERE v.status = 'REDEEMED'), 0)::int AS coupons
          FROM vouchers v GROUP BY v."branchId"`,
      ]);
    return {
      participants: { total: participantsTotal, today: participantsToday, staff },
      coupons: { eligible: couponsEligible, today: couponsToday, referral: referralCoupons },
      vouchers: {
        issuedToday,
        redeemedToday,
        byState: Object.fromEntries(states.map((s) => [s.state, s.n])) as Partial<Record<'ISSUED' | 'REDEEMED' | 'CANCELLED' | 'EXPIRED', number>>,
      },
      branches: branches.map((b) => {
        const row = perBranch.find((x) => x.branchId === b.id);
        return { ...b, issued: row?.issued ?? 0, redeemed: row?.redeemed ?? 0, amount: Number(row?.amount ?? 0), coupons: row?.coupons ?? 0 };
      }),
    };
  }

  @Get('settings/campaign')
  @Perm('dashboard', 'settings')
  async getCampaign() {
    const c = await this.prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
    if (!c) throw new NotFoundException();
    return c;
  }

  @Patch('settings/campaign')
  @Perm('settings')
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

  @Get('settings/referral')
  @Perm('settings')
  async getReferral() {
    const [settings, bonus] = await Promise.all([
      this.referral.settings(),
      this.prisma.receipt.aggregate({ where: { source: 'REFERRAL' }, _count: { _all: true }, _sum: { couponsCount: true } }),
    ]);
    const invited = await this.prisma.participant.count({ where: { referredById: { not: null } } });
    return { settings, stats: { invited, rewarded: bonus._count._all, coupons: bonus._sum.couponsCount ?? 0 } };
  }

  @Patch('settings/referral')
  @Perm('settings')
  async patchReferral(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const before = await this.referral.settings();
    const data = parse(referralSettingsSchema, { ...before, ...(body as object) });
    await this.referral.saveSettings(data);
    await this.audit.log(admin.id, 'settings.referral', 'setting', 'referral', { before, after: data });
    return data;
  }

  @Get('users')
  @Perm('users')
  async users() {
    const [users, logins] = await Promise.all([
      this.prisma.adminUser.findMany({ select: USER_SELECT, orderBy: { id: 'asc' } }),
      this.prisma.auditLog.groupBy({ by: ['actorId'], where: { action: 'auth.login' }, _max: { createdAt: true } }),
    ]);
    return users.map((u) => ({
      ...u,
      permissions: permissionsOf(u),
      lastLoginAt: logins.find((l) => l.actorId === u.id)?._max.createdAt ?? null,
    }));
  }

  @Post('users')
  @Perm('users')
  async createUser(@Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(userSchema, body);
    if (data.role === 'ADMIN' && admin.role !== 'ADMIN') throw new ForbiddenException();
    const access = normalizeAccess(data.role, data.branchId, data.permissions);
    try {
      const u = await this.prisma.adminUser.create({
        data: { login: data.login, role: data.role, ...access, passwordHash: await bcrypt.hash(data.password, 12) },
        select: USER_SELECT,
      });
      await this.audit.log(admin.id, 'admin.create', 'admin', u.id, { login: u.login, role: u.role, ...access });
      return { ...u, permissions: permissionsOf(u) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Bu login band');
      throw e;
    }
  }

  @Patch('users/:id')
  @Perm('users')
  async patchUser(@Param('id', ParseIntPipe) id: number, @Body() body: unknown, @CurrentAdmin() admin: AdminUser) {
    const data = parse(userPatchSchema, body);
    const accessChange = data.role !== undefined || data.permissions !== undefined || data.branchId !== undefined;
    // O'zini qulflab qo'ymasin: o'z rolini, ruxsatini va holatini o'zgartira olmaydi (parol — mumkin)
    if (id === admin.id && (accessChange || data.isActive !== undefined)) {
      throw new BadRequestException("O'zingizning rolingiz va ruxsatlaringizni o'zgartira olmaysiz");
    }
    const before = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    // ADMIN'ga faqat ADMIN tegadi
    if (admin.role !== 'ADMIN' && (before.role === 'ADMIN' || data.role === 'ADMIN')) throw new ForbiddenException();
    const role = data.role ?? before.role;
    const access = accessChange
      ? normalizeAccess(
          role,
          data.branchId !== undefined ? data.branchId : before.branchId,
          // Rol almashib, ruxsatlar berilmasa — yangi rol shabloni
          data.permissions ?? (role !== before.role ? undefined : permissionsOf(before)),
        )
      : {};
    const u = await this.prisma.adminUser.update({
      where: { id },
      data: {
        role: data.role,
        ...access,
        isActive: data.isActive,
        ...(data.password && { passwordHash: await bcrypt.hash(data.password, 12) }),
      },
      select: USER_SELECT,
    });
    await this.audit.log(admin.id, 'admin.update', 'admin', id, { ...data, password: data.password ? '***' : undefined });
    return { ...u, permissions: permissionsOf(u) };
  }
}
