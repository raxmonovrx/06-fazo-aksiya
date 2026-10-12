export interface CouponRule {
  minSum: number;
  couponPrice: number;
  maxPerReceipt: number;
}

/**
 * sum < minSum → 0, aks holda min(max(1, floor(sum / couponPrice)), maxPerReceipt)
 */
export function calcCoupons(sum: number, rule: CouponRule): number {
  if (!Number.isFinite(sum) || sum <= 0) return 0;
  if (sum < rule.minSum) return 0;
  if (rule.couponPrice <= 0 || rule.maxPerReceipt <= 0) return 0;
  return Math.min(Math.max(1, Math.floor(sum / rule.couponPrice)), rule.maxPerReceipt);
}
