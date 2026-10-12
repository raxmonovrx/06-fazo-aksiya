import { createHmac, timingSafeEqual } from 'node:crypto';

export interface InitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export type InitDataResult =
  | { ok: true; user: InitDataUser; authDate: Date }
  | { ok: false; error: 'MISSING' | 'BAD_HASH' | 'EXPIRED' | 'NO_USER' };

function sign(dataCheckString: string, botToken: string) {
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secret).update(dataCheckString).digest('hex');
}

function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Telegram Mini App initData imzosini tekshiradi (HMAC-SHA256, kalit = HMAC("WebAppData", token)).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateInitData(
  raw: string | undefined | null,
  botToken: string,
  maxAgeSec = 24 * 60 * 60,
  now = Date.now(),
): InitDataResult {
  if (!raw) return { ok: false, error: 'MISSING' };
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) return { ok: false, error: 'MISSING' };

  const entries = [...params.entries()].filter(([k]) => k !== 'hash');
  const build = (list: [string, string][]) =>
    list
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

  // Rasmiy: faqat `hash` chiqariladi. Ehtiyot uchun `signature` siz variant ham sinaladi.
  const valid =
    safeEq(sign(build([...entries]), botToken), hash) ||
    safeEq(sign(build(entries.filter(([k]) => k !== 'signature')), botToken), hash);
  if (!valid) return { ok: false, error: 'BAD_HASH' };

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec) return { ok: false, error: 'EXPIRED' };

  let user: InitDataUser | null = null;
  try {
    user = JSON.parse(params.get('user') ?? 'null');
  } catch {
    user = null;
  }
  if (!user || typeof user.id !== 'number') return { ok: false, error: 'NO_USER' };
  return { ok: true, user, authDate: new Date(authDate * 1000) };
}

/** Testlar uchun: imzolangan initData yasaydi. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const params = new URLSearchParams(fields);
  params.set('hash', sign(dcs, botToken));
  return params.toString();
}
