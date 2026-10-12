import { matchReceipt, type SaleCandidate } from './match.js';

const T0 = new Date('2026-10-16T15:52:51Z');
const min = (m: number) => new Date(T0.getTime() + m * 60_000);
const receipt = { fm: 'LG420230613349', receiptNumber: '4495', branchId: 1, fiscalAt: T0 };

let id = 1;
const sale = (o: Partial<SaleCandidate>): SaleCandidate => ({
  id: id++,
  fm: null,
  receiptNumber: null,
  branchId: 1,
  closedAt: T0,
  amount: 8000,
  isRefund: false,
  takenByOther: false,
  ...o,
});

describe('matchReceipt', () => {
  it('aniq moslik (fm + raqam)', () => {
    const s = sale({ fm: 'LG420230613349', receiptNumber: '4495', closedAt: min(1) });
    expect(matchReceipt(receipt, [sale({}), s])).toEqual({ kind: 'MATCH', sale: s, exact: true });
  });

  it('aniq moslik, lekin vaqt 10 daqiqadan uzoq → TIME_MISMATCH', () => {
    const s = sale({ fm: 'LG420230613349', receiptNumber: '4495', closedAt: min(11) });
    expect(matchReceipt(receipt, [s]).kind).toBe('TIME_MISMATCH');
  });

  it('qaytarish cheki → REFUND', () => {
    const s = sale({ fm: 'LG420230613349', receiptNumber: '4495' });
    const r = sale({ fm: 'LG420230613349', receiptNumber: '4495', isRefund: true, amount: -8000 });
    expect(matchReceipt(receipt, [s, r])).toEqual({ kind: 'REFUND', sale: r });
  });

  it('fiskal raqamsiz: yagona nomzod → MATCH (exact=false)', () => {
    const s = sale({ closedAt: min(3) });
    expect(matchReceipt(receipt, [s, sale({ closedAt: min(15) }), sale({ branchId: 2 })])).toEqual({
      kind: 'MATCH',
      sale: s,
      exact: false,
    });
  });

  it('fiskal raqamsiz: ikki yaqin nomzod → AMBIGUOUS', () => {
    expect(matchReceipt(receipt, [sale({ closedAt: min(1) }), sale({ closedAt: min(-2) })])).toEqual({
      kind: 'AMBIGUOUS',
      count: 2,
    });
  });

  it('fiskal raqamsiz: eng yaqini aniq ajralib tursa → MATCH', () => {
    const s = sale({ closedAt: min(0.5) });
    expect(matchReceipt(receipt, [s, sale({ closedAt: min(8) })]).kind).toBe('MATCH');
  });

  it('boshqa chekka bog\'langan nomzod hisobga olinmaydi', () => {
    expect(matchReceipt(receipt, [sale({ takenByOther: true })]).kind).toBe('NONE');
  });

  it('filial noma\'lum va aniq moslik yo\'q → NONE', () => {
    expect(matchReceipt({ ...receipt, branchId: null }, [sale({})]).kind).toBe('NONE');
  });

  it('FM\'siz, lekin fiskal raqamli (iiko FiscalChequeNumber): filial + raqam + vaqt', () => {
    const s = sale({ receiptNumber: '4495', closedAt: new Date(T0.getTime() + 2000), amount: 8000 });
    const other = sale({ receiptNumber: '4496', closedAt: min(1) });
    expect(matchReceipt(receipt, [other, s])).toEqual({ kind: 'MATCH', sale: s, exact: true });
  });

  it('fiskal raqam bir xil, lekin vaqt uzoq (boshqa kun) → moslanmaydi', () => {
    expect(matchReceipt(receipt, [sale({ receiptNumber: '4495', closedAt: min(60 * 24) })]).kind).toBe('NONE');
  });

  it('fiskal raqamli boshqa filial yozuvi hisobga olinmaydi', () => {
    expect(matchReceipt(receipt, [sale({ receiptNumber: '4495', branchId: 2 })]).kind).toBe('NONE');
  });

  it('bir buyurtmada bir nechta fiskal chek → MULTI_FISCAL', () => {
    expect(matchReceipt(receipt, [sale({ receiptNumber: '4495', multiFiscal: true })]).kind).toBe('MULTI_FISCAL');
  });

  it('fiskal raqamli refund → REFUND', () => {
    const r = sale({ receiptNumber: '4495', isRefund: true });
    expect(matchReceipt(receipt, [sale({ receiptNumber: '4495' }), r])).toEqual({ kind: 'REFUND', sale: r });
  });

  it('raqamli yozuv vaqt bo\'yicha (fuzzy) moslashda ishlatilmaydi', () => {
    expect(matchReceipt(receipt, [sale({ receiptNumber: '9999', closedAt: min(1) })]).kind).toBe('NONE');
  });
});
