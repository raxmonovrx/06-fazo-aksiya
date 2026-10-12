import { olapToSaleRows } from './iiko.source.js';

const fields = { closedAt: 'CloseTime', amount: 'DishDiscountSumInt', orderNum: 'OrderNum', receiptNumber: 'FiscalChequeNumber', fm: 'CashRegisterSerialNumber', refund: 'Storned' };
const depts = new Map([['fazo family restauraunt', 1]]);

describe('olapToSaleRows', () => {
  it('OLAP qatorini SaleRow ga aylantiradi', () => {
    const rows = olapToSaleRows(
      [
        { Department: 'Fazo Family Restauraunt', OrderNum: 77, CloseTime: '2026-10-11T20:52:51.000', DishDiscountSumInt: 8000, FiscalChequeNumber: '4495', CashRegisterSerialNumber: 'lg420230613349', Storned: false },
        { Department: 'Fazo Family Restauraunt', OrderNum: 78, CloseTime: '2026-10-11T21:00:00', DishDiscountSumInt: -8000, FiscalChequeNumber: '4496', CashRegisterSerialNumber: 'LG420230613349', Storned: true },
        { Department: 'Boshqa', OrderNum: 1, CloseTime: '2026-10-11T21:00:00', DishDiscountSumInt: 0 },
        { Department: 'Boshqa', OrderNum: 2, CloseTime: null, DishDiscountSumInt: 5000 },
      ],
      fields,
      'https://fazo-co.iiko.it',
      depts,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ fm: 'LG420230613349', receiptNumber: '4495', branchId: 1, amount: 8000, isRefund: false });
    expect(rows[0].closedAt.toISOString()).toBe('2026-10-11T15:52:51.000Z');
    expect(rows[1]).toMatchObject({ isRefund: true, amount: 8000 });
    expect(rows[0].externalKey).toContain('fazo-co.iiko.it');
  });

  it('fiskal maydonlarsiz (faqat vaqt bo\'yicha moslash uchun)', () => {
    const rows = olapToSaleRows(
      [{ Department: 'Fazo Family Restauraunt', OrderNum: 5, CloseTime: '2026-10-11T20:52:00', DishDiscountSumInt: 120000 }],
      { closedAt: 'CloseTime', amount: 'DishDiscountSumInt', orderNum: 'OrderNum' },
      'https://fazo-co.iiko.it',
      depts,
    );
    expect(rows[0]).toMatchObject({ fm: null, receiptNumber: null, branchId: 1, amount: 120000 });
  });

  it('standart maydonlar (fazo-co real javobi) va bir nechta fiskal raqam', () => {
    const rows = olapToSaleRows(
      [
        { Department: 'Fazo Family Restauraunt', OrderNum: 106, CloseTime: '2026-10-11T20:52:53.894', DishDiscountSumInt: 8000, FiscalChequeNumber: '4495', Storned: 'FALSE' },
        { Department: 'Fazo Family Restauraunt', OrderNum: 107, CloseTime: '2026-10-11T21:10:00', DishDiscountSumInt: 500000, FiscalChequeNumber: '4496, 4497', Storned: 'FALSE' },
        { Department: 'Fazo Family Restauraunt', OrderNum: 108, CloseTime: '2026-10-11T21:20:00', DishDiscountSumInt: 90000, FiscalChequeNumber: '', Storned: 'FALSE' },
        { Department: 'Fazo Family Restauraunt', OrderNum: 109, CloseTime: '2026-10-11T21:30:00', DishDiscountSumInt: 8000, FiscalChequeNumber: '4498', Storned: 'TRUE' },
      ],
      { closedAt: 'CloseTime', amount: 'DishDiscountSumInt', orderNum: 'OrderNum', receiptNumber: 'FiscalChequeNumber', refund: 'Storned' },
      'https://fazo-co.iiko.it',
      depts,
    );
    expect(rows.map((r) => [r.receiptNumber, r.isRefund, (r.raw as any)._multiFiscal ?? false])).toEqual([
      ['4495', false, false],
      ['4496', false, true],
      ['4497', false, true],
      [null, false, false],
      ['4498', true, false],
    ]);
    expect(rows[0]).toMatchObject({ fm: null, branchId: 1, amount: 8000 });
    // QR vaqti 20:52:51, iiko 20:52:53 — ±10 daqiqa oynasiga bemalol tushadi
    expect(rows[0].closedAt.toISOString()).toBe('2026-10-11T15:52:53.000Z');
  });
});
