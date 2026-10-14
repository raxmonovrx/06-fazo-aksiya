import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Filial logosi baytlari (yuzlab KB) odatiy so'rovlarda qaytmaydi — ro'yxatlar,
 * audit va JSON javoblar yengil qoladi. Kerak joyda: `omit: { logoPrint: false }`.
 */
const OMIT = { branch: { logoOriginal: true, logoPrint: true } } as const;

@Injectable()
export class PrismaService extends PrismaClient<{ omit: typeof OMIT }> implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ omit: OMIT });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
