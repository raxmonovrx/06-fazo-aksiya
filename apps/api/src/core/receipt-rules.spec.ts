import { checkReceiptTiming } from './receipt-rules.js';
import { tashkentToUtc } from './time.js';

const campaign = {
  startsAt: tashkentToUtc(2026, 10, 15)!,
  endsAt: null,
  receiptWindowHours: 72,
};
const at = (d: number, h: number, mi = 0) => tashkentToUtc(2026, 10, d, h, mi)!;

describe('checkReceiptTiming', () => {
  it('aksiyadan oldingi chek', () => {
    expect(checkReceiptTiming(at(14, 23, 59), at(15, 10), campaign)).toBe('BEFORE_CAMPAIGN');
  });
  it('oyna ichida', () => {
    expect(checkReceiptTiming(at(15, 0), at(17, 23, 59), campaign)).toBeNull();
  });
  it('72 soatdan keyin', () => {
    expect(checkReceiptTiming(at(15, 10), at(18, 10, 1), campaign)).toBe('WINDOW_EXPIRED');
  });
  it('kelajakdagi chek (kassa soati 10 daqiqadan ko\'p oldinda)', () => {
    expect(checkReceiptTiming(at(16, 12, 30), at(16, 12), campaign)).toBe('FUTURE');
    expect(checkReceiptTiming(at(16, 12, 5), at(16, 12), campaign)).toBeNull();
  });
  it('aksiya tugagandan keyin', () => {
    const ended = { ...campaign, endsAt: at(20, 0) };
    expect(checkReceiptTiming(at(20, 1), at(20, 2), ended)).toBe('AFTER_CAMPAIGN');
  });
});
