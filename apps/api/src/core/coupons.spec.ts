import { calcCoupons } from './coupons.js';

const rule = { minSum: 100_000, couponPrice: 100_000, maxPerReceipt: 10 };

describe('calcCoupons', () => {
  it.each([
    [8_000, 0], // real chek: minSum'dan kam
    [99_999, 0],
    [100_000, 1],
    [199_999, 1],
    [200_000, 2],
    [950_000, 9],
    [1_000_000, 10],
    [25_000_000, 10], // to'y cheki — maxPerReceipt bilan cheklanadi
    [0, 0],
    [-5, 0],
    [Number.NaN, 0],
  ])('%d so\'m → %d kupon', (sum, expected) => {
    expect(calcCoupons(sum, rule)).toBe(expected);
  });

  it('minSum couponPrice dan kichik bo\'lsa, kamida 1 kupon beradi', () => {
    expect(calcCoupons(60_000, { minSum: 50_000, couponPrice: 100_000, maxPerReceipt: 5 })).toBe(1);
  });

  it('minSum couponPrice dan katta bo\'lsa, floor ishlaydi', () => {
    expect(calcCoupons(350_000, { minSum: 300_000, couponPrice: 100_000, maxPerReceipt: 10 })).toBe(3);
  });

  it('noto\'g\'ri qoida → 0', () => {
    expect(calcCoupons(500_000, { ...rule, couponPrice: 0 })).toBe(0);
    expect(calcCoupons(500_000, { ...rule, maxPerReceipt: 0 })).toBe(0);
  });
});
