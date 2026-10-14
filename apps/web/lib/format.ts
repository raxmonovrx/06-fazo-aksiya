const TZ = 'Asia/Tashkent';

export function fmtDate(v: string | Date | null | undefined, withTime = true) {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime && { hour: '2-digit', minute: '2-digit' }),
  }).format(d);
  return parts.replace(',', '');
}

/** "12.10 13:04" — joriy yil bo'lsa yilsiz (mobil ro'yxatlar uchun). */
export function fmtShort(v: string | Date | null | undefined) {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  const sameYear = new Date().getFullYear() === d.getFullYear();
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    ...(!sameYear && { year: '2-digit' }),
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(d)
    .replace(',', '');
}

export function fmtSum(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return '—';
  return `${Math.round(Number(v)).toLocaleString('ru-RU').replace(/ /g, ' ')} so'm`;
}

export const STATUS: Record<
  string,
  { label: string; cls: string; emoji: string }
> = {
  PENDING: {
    label: 'Tekshirilmoqda',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    emoji: '⏳',
  },
  APPROVED: {
    label: 'Tasdiqlandi',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    emoji: '✅',
  },
  BELOW_MIN: {
    label: 'Summa kam',
    cls: 'bg-secondary text-secondary-foreground',
    emoji: '➖',
  },
  REJECTED: {
    label: 'Rad etildi',
    cls: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
    emoji: '❌',
  },
  NOT_FOUND: {
    label: 'Topilmadi',
    cls: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
    emoji: '🔎',
  },
  NEEDS_REVIEW: {
    label: 'Moderatsiyada',
    cls: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    emoji: '👀',
  },
};

/** 998901234567 → "+998 90 123 45 67"; boshqa format bo'lsa o'zgarmaydi */
export function fmtPhone(p: string | null | undefined) {
  if (!p) return '—';
  const m = /^998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(p.replace(/\D/g, ''));
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : p;
}
