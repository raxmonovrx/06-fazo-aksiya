/**
 * Chekni savdo yozuvi (iiko) bilan moslash — sof funksiya.
 *
 * 1. Aniq moslik: (fm, receiptNumber) bir xil. Vaqt ±10 daqiqa bo'lishi kerak.
 * 1b. Manbada FM yo'q, lekin fiskal chek raqami bor (iiko: FiscalChequeNumber,
 *    "Серийный номер ФР" bo'sh) — filial + chek raqami bir xil, vaqt ±10 daqiqa.
 * 2. Manbada fiskal raqam umuman bo'lmasa: shu filialdagi, ±10 daqiqa ichida yopilgan,
 *    boshqa chekka bog'lanmagan yozuvlar. Faqat bitta nomzod bo'lsa yoki eng
 *    yaqini aniq ajralib tursa — moslanadi; aks holda AMBIGUOUS.
 */
export interface SaleCandidate {
  id: number;
  fm: string | null;
  receiptNumber: string | null;
  branchId: number | null;
  closedAt: Date;
  amount: number;
  isRefund: boolean;
  /** Bu yozuv allaqachon boshqa chekka bog'langan */
  takenByOther: boolean;
  /** Bitta buyurtmada bir nechta fiskal chek — summa ishonchsiz */
  multiFiscal?: boolean;
}

export interface ReceiptForMatch {
  fm: string;
  receiptNumber: string;
  branchId: number | null;
  fiscalAt: Date;
}

export type MatchResult =
  | { kind: 'MATCH'; sale: SaleCandidate; exact: boolean }
  | { kind: 'REFUND'; sale: SaleCandidate }
  | { kind: 'TIME_MISMATCH'; sale: SaleCandidate }
  | { kind: 'AMBIGUOUS'; count: number }
  | { kind: 'MULTI_FISCAL'; sale: SaleCandidate }
  | { kind: 'NONE' };

export const MATCH_WINDOW_MS = 10 * 60 * 1000;
/** Fiskal raqamsiz moslashda eng yaqin nomzod keyingisidan kamida shuncha yaqin bo'lsin */
const FUZZY_SEPARATION_MS = 2 * 60 * 1000;

const diff = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime());

export function matchReceipt(r: ReceiptForMatch, candidates: SaleCandidate[]): MatchResult {
  const exact = candidates.filter((c) => c.fm === r.fm && c.receiptNumber === r.receiptNumber);
  if (exact.length) {
    const refund = exact.find((c) => c.isRefund);
    if (refund) return { kind: 'REFUND', sale: refund };
    const sale = exact.sort((a, b) => diff(a.closedAt, r.fiscalAt) - diff(b.closedAt, r.fiscalAt))[0];
    if (diff(sale.closedAt, r.fiscalAt) > MATCH_WINDOW_MS) return { kind: 'TIME_MISMATCH', sale };
    return { kind: 'MATCH', sale, exact: true };
  }

  if (r.branchId === null) return { kind: 'NONE' };

  const byNumber = candidates.filter((c) => !c.fm && c.receiptNumber === r.receiptNumber && c.branchId === r.branchId);
  if (byNumber.length) {
    const refund = byNumber.find((c) => c.isRefund && diff(c.closedAt, r.fiscalAt) <= MATCH_WINDOW_MS);
    if (refund) return { kind: 'REFUND', sale: refund };
    const sale = byNumber.filter((c) => !c.isRefund).sort((a, b) => diff(a.closedAt, r.fiscalAt) - diff(b.closedAt, r.fiscalAt))[0];
    // Fiskal raqam kassa bo'yicha qaytalanishi mumkin — vaqt mos kelmasa, bu boshqa chek
    if (sale && diff(sale.closedAt, r.fiscalAt) <= MATCH_WINDOW_MS) {
      if (sale.multiFiscal) return { kind: 'MULTI_FISCAL', sale };
      return { kind: 'MATCH', sale, exact: true };
    }
  }

  const fuzzy = candidates
    .filter(
      (c) =>
        !c.fm &&
        !c.receiptNumber &&
        !c.isRefund &&
        !c.takenByOther &&
        c.branchId === r.branchId &&
        diff(c.closedAt, r.fiscalAt) <= MATCH_WINDOW_MS,
    )
    .sort((a, b) => diff(a.closedAt, r.fiscalAt) - diff(b.closedAt, r.fiscalAt));
  if (!fuzzy.length) return { kind: 'NONE' };
  if (fuzzy.length === 1) return { kind: 'MATCH', sale: fuzzy[0], exact: false };
  const [best, next] = fuzzy;
  if (diff(next.closedAt, r.fiscalAt) - diff(best.closedAt, r.fiscalAt) >= FUZZY_SEPARATION_MS) {
    return { kind: 'MATCH', sale: best, exact: false };
  }
  return { kind: 'AMBIGUOUS', count: fuzzy.length };
}
