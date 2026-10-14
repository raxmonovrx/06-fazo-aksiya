import { randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Prisma, type Participant } from '@prisma/client';

import { normalizePhone } from '../core/phone.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

// O vs 0, I vs 1 kabi chalkash belgilarsiz
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeRefCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return s;
}

export type SavePhoneResult =
  | { ok: true; participant: Participant }
  | { ok: false; error: 'INVALID_PHONE' | 'PHONE_TAKEN' };

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  findByTgId(tgId: number | bigint) {
    return this.prisma.participant.findUnique({ where: { tgId: BigInt(tgId) } });
  }

  /**
   * /start: ishtirokchini topadi yoki yaratadi. Payload (ref_/src_) faqat
   * birinchi marta saqlanadi — keyingi /start'lar manbani o'zgartirmaydi.
   */
  async startOrGet(from: TgUser, payload?: string | null): Promise<Participant> {
    const tgId = BigInt(from.id);
    const profile = {
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      username: from.username ?? null,
      languageCode: from.language_code ?? null,
    };
    const existing = await this.prisma.participant.findUnique({ where: { tgId } });
    if (existing) {
      return this.prisma.participant.update({ where: { tgId }, data: profile });
    }

    let raw = payload?.trim().slice(0, 64) || null;
    let source: string | null = null;
    // Vaucher QR orqali kelgan — tokenning o'zi saqlanmaydi (u vaucher jadvalida)
    if (raw?.startsWith('v_')) {
      raw = 'v_';
      source = 'voucher';
    }
    let referredById: number | null = null;
    if (raw?.startsWith('src_')) source = raw.slice(4) || null;
    if (raw?.startsWith('ref_')) {
      source = 'referral';
      const ref = await this.prisma.participant.findUnique({
        where: { refCode: raw.slice(4).toUpperCase() },
        select: { id: true },
      });
      referredById = ref?.id ?? null;
    }

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.participant.create({
          data: { tgId, ...profile, refCode: makeRefCode(), startPayload: raw, source, referredById },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002' || attempt >= 5) {
          throw e;
        }
        // Parallel /start: boshqa so'rov allaqachon yaratgan bo'lsa — o'shani qaytaramiz
        const again = await this.prisma.participant.findUnique({ where: { tgId } });
        if (again) return again;
        // Aks holda refCode to'qnashdi — qayta urinamiz
      }
    }
  }

  async savePhone(tgId: number, rawPhone: string): Promise<SavePhoneResult> {
    const phone = normalizePhone(rawPhone);
    if (!phone) return { ok: false, error: 'INVALID_PHONE' };

    const owner = await this.prisma.participant.findUnique({ where: { phone } });
    if (owner && owner.tgId !== BigInt(tgId)) return { ok: false, error: 'PHONE_TAKEN' };

    const staff = await this.prisma.staffPhone.findUnique({ where: { phone } });
    try {
      const participant = await this.prisma.participant.update({
        where: { tgId: BigInt(tgId) },
        data: { phone, isStaff: Boolean(staff) },
      });
      return { ok: true, participant };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { ok: false, error: 'PHONE_TAKEN' };
      }
      throw e;
    }
  }

  acceptRules(tgId: number) {
    return this.prisma.participant.update({
      where: { tgId: BigInt(tgId) },
      data: { rulesAcceptedAt: new Date() },
    });
  }

  /** Mijoz uchun qisqa statistika: kuponlar va cheklar. */
  async summary(participantId: number) {
    const [coupons, byStatus] = await Promise.all([
      this.prisma.coupon.count({ where: { participantId, eligible: true } }),
      this.prisma.receipt.groupBy({
        by: ['status'],
        where: { participantId },
        _count: { _all: true },
      }),
    ]);
    const receipts = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
    return { coupons, receipts };
  }

  /** Ro'yxatdan o'tmasdan skanerlangan vaucher tokeni (oxirgisi saqlanadi). */
  setPendingVoucher(tgId: number, token: string) {
    return this.prisma.participant.update({ where: { tgId: BigInt(tgId) }, data: { pendingVoucher: token } });
  }

  /** Kutayotgan vaucherni oladi va tozalaydi. */
  async takePendingVoucher(participantId: number): Promise<string | null> {
    const p = await this.prisma.participant.findUnique({ where: { id: participantId }, select: { pendingVoucher: true } });
    if (!p?.pendingVoucher) return null;
    await this.prisma.participant.update({ where: { id: participantId }, data: { pendingVoucher: null } });
    return p.pendingVoucher;
  }
}

export const isRegistered = (p: Participant | null): p is Participant =>
  Boolean(p?.phone && p.rulesAcceptedAt);
