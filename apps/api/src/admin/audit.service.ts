import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(actorId: number | null, action: string, entity: string, entityId: string | number | null, data?: unknown) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId === null ? null : String(entityId),
        data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
