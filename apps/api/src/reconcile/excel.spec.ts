import ExcelJS from 'exceljs';

import { parseAmount, parseCsv, parseDateTime, readSheet, toSaleRows } from './excel.js';

const branches = [
  { id: 1, name: 'Fazo Restaurant', department: 'Fazo Family Restauraunt' },
  { id: 2, name: 'Le Fazo', department: 'Le Fazo' },
];

describe('excel import', () => {
  it('parseAmount', () => {
    expect(parseAmount('8 000')).toBe(8000);
    expect(parseAmount('1 234,50')).toBe(1234.5);
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount("350 000 so'm")).toBe(350000);
    expect(parseAmount(-8000)).toBe(-8000);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });

  it('parseDateTime: turli formatlar Toshkent vaqti sifatida', () => {
    const iso = '2026-10-11T15:52:51.000Z';
    expect(parseDateTime('11.10.2026 20:52:51')?.toISOString()).toBe(iso);
    expect(parseDateTime('2026-10-11 20:52:51')?.toISOString()).toBe(iso);
    expect(parseDateTime('11.10.2026', '20:52:51')?.toISOString()).toBe(iso);
    // exceljs Date: devordagi vaqt UTC komponentlarda
    expect(parseDateTime(new Date(Date.UTC(2026, 9, 11, 20, 52, 51)))?.toISOString()).toBe(iso);
    expect(parseDateTime('salom')).toBeNull();
  });

  it('CSV: ; ajratuvchi, qo\'shtirnoq', () => {
    expect(parseCsv('a;b;c\n"x;y";2;3\n')).toEqual([
      ['a', 'b', 'c'],
      ['x;y', '2', '3'],
    ]);
  });

  it('xlsx: sarlavhadan oldingi qatorlar o\'tkazib yuboriladi, qatorlar SaleRow bo\'ladi', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('OLAP');
    ws.addRow(['Отчет по продажам']);
    ws.addRow([]);
    ws.addRow(['Торговое предприятие', 'Номер чека', 'ФМ', 'Время закрытия', 'Сумма со скидкой']);
    ws.addRow(['Fazo Family Restauraunt', 4495, 'LG420230613349', new Date(Date.UTC(2026, 9, 11, 20, 52, 51)), 8000]);
    ws.addRow(['Le Fazo', '120', 'XX0000000001', '12.10.2026 13:00:00', '-45 000']);
    ws.addRow(['Fazo Family Restauraunt', 4496, 'LG420230613349', 'buzuq sana', 1000]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const sheet = await readSheet(buf, 'olap.xlsx');
    expect(sheet.headers).toEqual(['Торговое предприятие', 'Номер чека', 'ФМ', 'Время закрытия', 'Сумма со скидкой']);
    expect(sheet.rows).toHaveLength(3);

    const { rows, errors } = toSaleRows(
      sheet,
      { branch: 0, receiptNumber: 1, fm: 2, closedAt: 3, amount: 4 },
      branches,
      null,
    );
    expect(errors).toEqual([{ row: 4, error: "Sana/vaqt o'qilmadi" }]);
    expect(rows[0]).toMatchObject({
      fm: 'LG420230613349',
      receiptNumber: '4495',
      branchId: 1,
      amount: 8000,
      isRefund: false,
    });
    expect(rows[0].closedAt.toISOString()).toBe('2026-10-11T15:52:51.000Z');
    expect(rows[1]).toMatchObject({ branchId: 2, amount: 45000, isRefund: true });
    // Qayta import idempotent bo'lishi uchun kalit barqaror
    const again = toSaleRows(sheet, { branch: 0, receiptNumber: 1, fm: 2, closedAt: 3, amount: 4 }, branches, null);
    expect(again.rows[0].externalKey).toBe(rows[0].externalKey);
  });
});
