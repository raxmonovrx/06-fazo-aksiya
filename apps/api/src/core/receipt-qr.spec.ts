import { parseReceiptQr } from './receipt-qr.js';

// Real chek: "Fazo DT" MChJ, STIR 312163993, 8 000 so'm, "Орбит жвачка", naqd
const REAL = 'https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261011205251&s=047808378930';

describe('parseReceiptQr', () => {
  it('real chekni to\'g\'ri o\'qiydi', () => {
    const res = parseReceiptQr(REAL);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.fm).toBe('LG420230613349');
    expect(res.value.receiptNumber).toBe('4495');
    expect(res.value.fiscalSign).toBe('047808378930');
    // 11.10.2026 20:52:51 Toshkent = 15:52:51 UTC
    expect(res.value.fiscalAt.toISOString()).toBe('2026-10-11T15:52:51.000Z');
    expect(res.value.rawUrl).toBe(REAL);
  });

  it('bo\'shliq, http va www ni qabul qiladi', () => {
    expect(parseReceiptQr(`  ${REAL}\n`).ok).toBe(true);
    expect(parseReceiptQr(REAL.replace('https://', 'http://')).ok).toBe(true);
    expect(parseReceiptQr(REAL.replace('ofd.', 'www.ofd.')).ok).toBe(true);
  });

  it('parametrlar tartibi ahamiyatsiz, FM katta harfga o\'tadi', () => {
    const res = parseReceiptQr('https://ofd.soliq.uz/check?s=047808378930&c=20261011205251&r=4495&t=lg420230613349');
    expect(res.ok && res.value.fm).toBe('LG420230613349');
  });

  it('chek raqamidagi boshlang\'ich nollarni olib tashlaydi', () => {
    const res = parseReceiptQr(REAL.replace('r=4495', 'r=004495'));
    expect(res.ok && res.value.receiptNumber).toBe('4495');
  });

  it.each([
    ['', 'NOT_URL'],
    ['salom', 'NOT_URL'],
    ['https://evil.uz/check?t=LG420230613349&r=4495&c=20261011205251&s=047808378930', 'WRONG_HOST'],
    ['https://ofd.soliq.uz.evil.uz/check?t=LG420230613349&r=4495&c=20261011205251&s=1', 'WRONG_HOST'],
    ['ftp://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261011205251&s=047808378930', 'WRONG_HOST'],
    ['https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261011205251', 'MISSING_PARAMS'],
    ['https://ofd.soliq.uz/check?t=LG42&r=4495&c=20261011205251&s=047808378930', 'BAD_FM'],
    ['https://ofd.soliq.uz/check?t=LG420230613349&r=44a5&c=20261011205251&s=047808378930', 'BAD_RECEIPT_NUMBER'],
    ['https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261311205251&s=047808378930', 'BAD_DATE'],
    ['https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261031256051&s=047808378930', 'BAD_DATE'],
    ['https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=2026101120&s=047808378930', 'BAD_DATE'],
    ['https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261011205251&s=abc', 'BAD_SIGN'],
  ])('%s → %s', (input, error) => {
    const res = parseReceiptQr(input);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(error);
  });
});
