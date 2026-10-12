import { tashkentToUtc } from './time.js';

/**
 * Fiskal chek QR'i: https://ofd.soliq.uz/check?t=<FM>&r=<chek>&c=<YYYYMMDDHHmmss>&s=<fiskal belgi>
 * QR ichida summa YO'Q — summa iiko ma'lumotidan olinadi.
 */
export interface ReceiptQr {
  fm: string;
  receiptNumber: string;
  fiscalAt: Date;
  fiscalSign: string;
  rawUrl: string;
}

export type QrParseError =
  | 'NOT_URL'
  | 'WRONG_HOST'
  | 'MISSING_PARAMS'
  | 'BAD_FM'
  | 'BAD_RECEIPT_NUMBER'
  | 'BAD_DATE'
  | 'BAD_SIGN';

export type QrParseResult = { ok: true; value: ReceiptQr } | { ok: false; error: QrParseError };

const ALLOWED_HOSTS = new Set(['ofd.soliq.uz', 'www.ofd.soliq.uz']);

export function parseReceiptQr(input: string): QrParseResult {
  const text = (input ?? '').trim();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: 'NOT_URL' };
  }
  if (!['http:', 'https:'].includes(url.protocol) || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: 'WRONG_HOST' };
  }

  const t = url.searchParams.get('t')?.trim();
  const r = url.searchParams.get('r')?.trim();
  const c = url.searchParams.get('c')?.trim();
  const s = url.searchParams.get('s')?.trim();
  if (!t || !r || !c || !s) return { ok: false, error: 'MISSING_PARAMS' };

  const fm = t.toUpperCase();
  if (!/^[A-Z0-9]{8,20}$/.test(fm)) return { ok: false, error: 'BAD_FM' };
  if (!/^\d{1,12}$/.test(r)) return { ok: false, error: 'BAD_RECEIPT_NUMBER' };
  if (!/^\d{6,30}$/.test(s)) return { ok: false, error: 'BAD_SIGN' };

  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(c);
  if (!m) return { ok: false, error: 'BAD_DATE' };
  const [y, mo, d, h, mi, sec] = m.slice(1).map(Number);
  const fiscalAt = tashkentToUtc(y, mo, d, h, mi, sec);
  if (!fiscalAt) return { ok: false, error: 'BAD_DATE' };

  return {
    ok: true,
    value: {
      fm,
      // "04495" va "4495" bitta chek — boshidagi nollar olib tashlanadi
      receiptNumber: String(Number(r)),
      fiscalAt,
      fiscalSign: s,
      rawUrl: text,
    },
  };
}
