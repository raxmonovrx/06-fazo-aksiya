import { buildDailyMessage } from './notifications.service.js';

const at = new Date('2026-10-16T15:15:00Z'); // 20:15 Toshkent
const fazo = { name: 'Fazo Restaurant', minSum: 100000 };

describe('buildDailyMessage', () => {
  it('bitta tasdiqlangan chek — SPEC namunasi kabi', () => {
    const text = buildDailyMessage([{ status: 'APPROVED', fiscalAt: at, amount: 250000, couponsCount: 2, rejectReason: null, branch: fazo }], 7, false);
    expect(text).toContain("Fazo Restaurantdagi chekingiz uchun 2 ta kupon qo'shildi 🎉");
    expect(text).toContain('16.10.2026 20:15');
    expect(text).toContain("250 000 so'm");
    expect(text).toContain('Jami kuponlaringiz: <b>7 ta</b>');
  });

  it('aralash: tasdiqlangan, summa kam, rad etilgan (sababi bilan)', () => {
    const text = buildDailyMessage(
      [
        { status: 'APPROVED', fiscalAt: at, amount: 300000, couponsCount: 3, rejectReason: null, branch: fazo },
        { status: 'BELOW_MIN', fiscalAt: at, amount: 8000, couponsCount: 0, rejectReason: null, branch: fazo },
        { status: 'REJECTED', fiscalAt: at, amount: null, couponsCount: 0, rejectReason: 'Chek qaytarilgan (refund)', branch: { name: 'Le Fazo', minSum: 1 } },
      ],
      3,
      false,
    );
    expect(text).toContain("Cheklaringiz uchun 3 ta kupon qo'shildi");
    expect(text).toContain("kamida 100 000 so'm kerak");
    expect(text).toContain('❌ Le Fazo');
    expect(text).toContain('refund');
  });

  it('xodimga jami kupon o\'rniga izoh', () => {
    const text = buildDailyMessage([{ status: 'APPROVED', fiscalAt: at, amount: 200000, couponsCount: 2, rejectReason: null, branch: fazo }], 0, true);
    expect(text).toContain("xodimlari o'yinda qatnashmaydi");
    expect(text).not.toContain('Jami');
  });

  it('HTML belgilar ekranlanadi', () => {
    const text = buildDailyMessage([{ status: 'REJECTED', fiscalAt: null, amount: null, couponsCount: 0, rejectReason: '<script>', branch: null }], 0, false);
    expect(text).toContain('&lt;script&gt;');
  });
});
