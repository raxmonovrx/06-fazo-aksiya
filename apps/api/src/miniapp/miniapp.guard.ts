import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Participant } from '@prisma/client';
import type { Request } from 'express';

import { config } from '../config.js';
import { validateInitData } from '../core/init-data.js';
import { isRegistered, ParticipantsService } from '../participants/participants.service.js';

export type MiniappRequest = Request & { participant: Participant };

/** `Authorization: tma <initData>` — imzo bot tokeni bilan tekshiriladi. */
@Injectable()
export class MiniappGuard implements CanActivate {
  constructor(private readonly participants: ParticipantsService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<MiniappRequest>();
    const header = req.headers.authorization ?? '';
    const raw = header.startsWith('tma ') ? header.slice(4) : '';
    const res = validateInitData(raw, config().BOT_TOKEN);
    if (!res.ok) throw new UnauthorizedException({ code: res.error });

    const p = await this.participants.findByTgId(res.user.id);
    if (!isRegistered(p)) throw new ForbiddenException({ code: 'NOT_REGISTERED' });
    if (p.isBlocked) throw new ForbiddenException({ code: 'BLOCKED' });
    req.participant = p;
    return true;
  }
}
