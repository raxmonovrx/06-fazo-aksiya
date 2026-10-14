import {
  RiBuilding2Line,
  RiDashboardLine,
  RiDownload2Line,
  RiGroupLine,
  RiQrCodeLine,
  RiTicket2Line,
  RiSettings3Line,
  RiUserSettingsLine,
  RiUserStarLine,
  type RemixiconComponentType,
} from '@remixicon/react';

import type { AdminMe } from '@/app/admin/(panel)/admin-context';
import type { Permission } from '@/lib/permissions';

/**
 * Panel bo'limlari — sidebar va sarlavha uchun YAGONA manba
 * (restobrain superadmin `nav-tree.ts` dan ko'chirilgan).
 */
export interface NavItem {
  title: string;
  url: string;
  icon?: RemixiconComponentType;
}

export interface NavSection extends NavItem {
  icon: RemixiconComponentType;
  /** Shu ruxsatlardan biri bo'lsa ko'rinadi */
  perm: Permission[];
  /** Ichki sahifalar — sidebar'da bo'lim ostida daraxt bo'lib chiqadi */
  items?: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  { title: 'Dashboard', url: '/admin', icon: RiDashboardLine, perm: ['dashboard'] },
  { title: 'Kassa', url: '/admin/cashier', icon: RiQrCodeLine, perm: ['cashier'] },
  { title: 'Vaucherlar', url: '/admin/vouchers', icon: RiTicket2Line, perm: ['vouchers'] },
  { title: 'Ishtirokchilar', url: '/admin/participants', icon: RiGroupLine, perm: ['participants'] },
  { title: 'Filiallar va kassalar', url: '/admin/branches', icon: RiBuilding2Line, perm: ['branches'] },
  { title: 'Xodimlar', url: '/admin/staff', icon: RiUserStarLine, perm: ['staff'] },
  { title: 'Eksport', url: '/admin/export', icon: RiDownload2Line, perm: ['export'] },
  { title: 'Foydalanuvchilar', url: '/admin/users', icon: RiUserSettingsLine, perm: ['users'] },
  { title: 'Sozlamalar', url: '/admin/settings', icon: RiSettings3Line, perm: ['settings'] },
];

/** Xodimga ochiq bo'limlar */
export function sectionsFor(me: Pick<AdminMe, 'permissions'>): NavSection[] {
  // Eski API javobida ruxsatlar bo'lmasligi mumkin (deploy oralig'i)
  const perms = me.permissions ?? [];
  return NAV_SECTIONS.filter((s) => s.perm.some((p) => perms.includes(p)));
}

/** Kira oladigan birinchi sahifa (kassir — Kassa) */
export function homeFor(me: Pick<AdminMe, 'permissions'>): string | null {
  return sectionsFor(me)[0]?.url ?? null;
}

/**
 * Kassa rejimi: dashboard'i yo'q, kassasi bor xodim (kassir, filial menejeri) —
 * sidebar o'rniga katta, sodda ekran.
 */
export function isKiosk(me: Pick<AdminMe, 'permissions'>): boolean {
  const perms = me.permissions ?? [];
  return perms.includes('cashier') && !perms.includes('dashboard');
}

/**
 * Manzil bo'limga tegishlimi. Dashboard (`/admin`) — boshqa hamma
 * bo'limlarning otasi, shuning uchun u faqat aniq moslikda yonadi.
 */
export function inSection(pathname: string, url: string): boolean {
  return url === '/admin' ? pathname === url : isUnder(pathname, url);
}

/**
 * Manzil qaysi bo'limga tegishli. Chegara bilan solishtiriladi
 * (`/admin/receipts` yoki `/admin/receipts/…`), oddiy `startsWith` emas.
 */
export function sectionFor(pathname: string): NavSection | undefined {
  return NAV_SECTIONS.find((s) => inSection(pathname, s.url));
}

/** `url` ning o'zi yoki uning ichidagi sahifa (chegara bilan) */
export function isUnder(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * Bo'lim ichida faol band. Aniq moslik birinchi, bo'lmasa — eng uzun
 * prefiks.
 */
export function activeItemIndex(items: NavItem[], pathname: string): number {
  const exact = items.findIndex((i) => i.url === pathname);
  if (exact >= 0) return exact;
  let best = -1;
  items.forEach((i, index) => {
    if (
      isUnder(pathname, i.url) &&
      (best < 0 || i.url.length > items[best].url.length)
    )
      best = index;
  });
  return best;
}

/** Sarlavha uchun: bo'lim va sahifa nomi */
export function pageTrail(pathname: string): {
  section?: NavSection;
  title: string;
} {
  const section = sectionFor(pathname);
  const sub = section?.items?.find((i) => i.url === pathname)?.title;
  if (sub) return { section, title: sub };
  if (section) return { section, title: section.title };
  return { title: 'Fazo Group' };
}
