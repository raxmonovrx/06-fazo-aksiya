// Toshkent: UTC+5, yozgi vaqt yo'q. Shuning uchun oddiy siljish yetadi.
export const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
export const TZ = 'Asia/Tashkent';

/** Toshkent mahalliy vaqt komponentlaridan UTC Date. Noto'g'ri sana bo'lsa null. */
export function tashkentToUtc(
  y: number,
  mo: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
): Date | null {
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    check.getUTCHours() !== h ||
    check.getUTCMinutes() !== mi ||
    check.getUTCSeconds() !== s
  ) {
    return null;
  }
  return new Date(ms - TASHKENT_OFFSET_MS);
}

/** Toshkent bo'yicha kun boshi (UTC Date). */
export function tashkentDayStart(date: Date): Date {
  const local = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) -
      TASHKENT_OFFSET_MS,
  );
}

/** Toshkent bo'yicha oy boshi (UTC Date). */
export function tashkentMonthStart(date: Date): Date {
  const local = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - TASHKENT_OFFSET_MS);
}

/** "11.10.2026 20:52" ko'rinishida, Toshkent vaqtida. */
export function formatTashkent(date: Date, withTime = true): string {
  const l = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  const d = `${p(l.getUTCDate())}.${p(l.getUTCMonth() + 1)}.${l.getUTCFullYear()}`;
  return withTime ? `${d} ${p(l.getUTCHours())}:${p(l.getUTCMinutes())}` : d;
}
