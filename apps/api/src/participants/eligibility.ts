import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Kupon o'yinda qatnashadimi: egasi xodim ham, bloklangan ham emas va kupon
 * berilgan yozuv (QR yoki taklif bonusi) bekor qilinmagan (APPROVED).
 * Qayta hisoblash — bir joyda: xodim/blok belgisi yoki QR bekor qilinsa chaqiriladi.
 */
export async function syncCouponEligibility(prisma: Pick<PrismaService, '$executeRaw'>, participantIds: number[]) {
  if (!participantIds.length) return;
  await prisma.$executeRaw`
    UPDATE coupons c
    SET eligible = (NOT p."isStaff" AND NOT p."isBlocked" AND r.status = 'APPROVED')
    FROM participants p, receipts r
    WHERE c."participantId" = p.id AND c."receiptId" = r.id AND p.id = ANY(${participantIds})`;
}
