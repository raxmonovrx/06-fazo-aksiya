import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole, AdminUser } from '@prisma/client';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { can, type Permission } from './permissions.js';

export const ADMIN_COOKIE = 'fc_admin';
export const SESSION_HOURS = 12;

interface AdminClaims {
  sub: number;
  role: AdminRole;
}

export type AdminRequest = Request & { admin: AdminUser };

export function signAdminToken(user: Pick<AdminUser, 'id' | 'role'>) {
  return jwt.sign({ sub: user.id, role: user.role } satisfies AdminClaims, config().JWT_SECRET, {
    expiresIn: `${SESSION_HOURS}h`,
    algorithm: 'HS256',
  });
}

const PERMS_KEY = 'adminPerms';
const ANY = '*';
/**
 * Ruxsatlardan kamida bittasi kerak. Endpoint'da ham, controller'da ham
 * bo'lmasa — faqat ADMIN (yangi endpoint tasodifan ochilib qolmasin).
 */
export const Perm = (...perms: Permission[]) => SetMetadata(PERMS_KEY, perms);
/** Har qanday kirgan xodim (masalan /auth/me, filiallar ro'yxati) */
export const AnyStaff = () => SetMetadata(PERMS_KEY, [ANY]);

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AdminRequest>().admin;
});

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const token: string | undefined = req.cookies?.[ADMIN_COOKIE];
    if (!token) throw new UnauthorizedException();
    let claims: AdminClaims;
    try {
      claims = jwt.verify(token, config().JWT_SECRET, { algorithms: ['HS256'] }) as unknown as AdminClaims;
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.adminUser.findUnique({ where: { id: Number(claims.sub) } });
    if (!user?.isActive) throw new UnauthorizedException();

    const perms = this.reflector.getAllAndOverride<string[] | undefined>(PERMS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const ok = perms?.length
      ? perms.includes(ANY) || perms.some((p) => can(user, p as Permission))
      : user.role === 'ADMIN';
    if (!ok) throw new ForbiddenException();
    req.admin = user;
    return true;
  }
}
