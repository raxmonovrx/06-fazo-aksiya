import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { AdminUser } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { isHttps } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RateLimiter } from '../core/rate-limiter.js';
import { ADMIN_COOKIE, AdminGuard, AnyStaff, CurrentAdmin, SESSION_HOURS, signAdminToken } from './auth.js';
import { AuditService } from './audit.service.js';
import { permissionsOf } from './permissions.js';
import { parse } from './zod.js';

const loginSchema = z.object({ login: z.string().min(1).max(64), password: z.string().min(1).max(200) });

@Controller('admin/auth')
export class AdminAuthController {
  private readonly limiter = new RateLimiter(10, 15 * 60 * 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!this.limiter.hit(req.ip ?? 'unknown')) throw new HttpException("Juda ko'p urinish, 15 daqiqadan keyin", HttpStatus.TOO_MANY_REQUESTS);
    const { login, password } = parse(loginSchema, body);
    const user = await this.prisma.adminUser.findUnique({ where: { login } });
    const ok = user?.isActive && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) throw new UnauthorizedException("Login yoki parol noto'g'ri");

    res.cookie(ADMIN_COOKIE, signAdminToken(user), {
      httpOnly: true,
      secure: isHttps(),
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_HOURS * 60 * 60 * 1000,
    });
    await this.audit.log(user.id, 'auth.login', 'admin', user.id, { ip: req.ip });
    return { id: user.id, login: user.login, role: user.role, branchId: user.branchId };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @AnyStaff()
  async me(@CurrentAdmin() admin: AdminUser) {
    const branch = admin.branchId
      ? await this.prisma.branch.findUnique({
          where: { id: admin.branchId },
          select: { id: true, name: true, minSum: true, couponPrice: true, maxPerReceipt: true },
        })
      : null;
    return {
      id: admin.id,
      login: admin.login,
      role: admin.role,
      permissions: permissionsOf(admin),
      // Kassa sahifasi kupon sonini oldindan ko'rsatishi uchun filial qoidasi bilan
      branch: branch && { ...branch, minSum: Number(branch.minSum), couponPrice: Number(branch.couponPrice) },
    };
  }
}
