import { randomBytes } from 'node:crypto';

/**
 * Vaucher tokeni: 16 tasodifiy bayt (128 bit) base64url — 22 belgi [A-Za-z0-9_-].
 * Telegram /start parametri (≤64 belgi, shu alifbo) ichiga "v_" bilan sig'adi.
 * Taxmin qilib bo'lmaydi; summa va kupon soni QR'da emas, serverda.
 */
export const VOUCHER_PREFIX = 'v_';
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export function newVoucherToken(): string {
  return randomBytes(16).toString('base64url');
}

export function voucherStartParam(token: string): string {
  return `${VOUCHER_PREFIX}${token}`;
}

/**
 * Matndan vaucher tokenini ajratadi. Qabul qiladi:
 *  "v_<token>", "/start v_<token>", "https://t.me/<bot>?start=v_<token>", "tg://resolve?domain=<bot>&start=v_<token>"
 */
export function parseVoucherToken(input: string | null | undefined): string | null {
  const text = (input ?? '').trim();
  if (!text) return null;
  let candidate: string | null = null;
  if (text.startsWith(VOUCHER_PREFIX)) candidate = text.slice(VOUCHER_PREFIX.length);
  else if (text.startsWith('/start ')) candidate = text.slice(7).trim().replace(/^v_/, '');
  else {
    try {
      const url = new URL(text);
      const start = url.searchParams.get('start');
      const isTelegram = ['t.me', 'telegram.me', 'www.t.me'].includes(url.hostname.toLowerCase()) || url.protocol === 'tg:';
      if (isTelegram && start?.startsWith(VOUCHER_PREFIX)) candidate = start.slice(VOUCHER_PREFIX.length);
    } catch {
      return null;
    }
  }
  return candidate && TOKEN_RE.test(candidate) ? candidate : null;
}
