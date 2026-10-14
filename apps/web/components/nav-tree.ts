import {
  RiArrowLeftRightLine,
  RiBuilding2Line,
  RiDashboardLine,
  RiDownload2Line,
  RiEyeLine,
  RiGroupLine,
  RiQrCodeLine,
  RiTicket2Line,
  RiReceiptLine,
  RiSettings3Line,
  RiUserStarLine,
  type RemixiconComponentType,
} from '@remixicon/react';

import type { AdminMe } from '@/app/admin/(panel)/admin-context';

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
  /** Faqat ADMIN ko'radi (OPERATOR — yo'q) */
  adminOnly?: boolean;
  /** Ko'radigan rollar (berilmasa: ADMIN va OPERATOR; adminOnly — faqat ADMIN) */
  roles?: AdminMe['role'][];
  /** Ichki sahifalar — sidebar'da bo'lim ostida daraxt bo'lib chiqadi */
  items?: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  { title: 'Dashboard', url: '/admin', icon: RiDashboardLine },
  { title: 'Kassa', url: '/admin/cashier', icon: RiQrCodeLine, roles: ['ADMIN', 'CASHIER'] },
  { title: 'Vaucherlar', url: '/admin/vouchers', icon: RiTicket2Line },
  { title: 'Moderatsiya', url: '/admin/moderation', icon: RiEyeLine },
  { title: 'Cheklar', url: '/admin/receipts', icon: RiReceiptLine },
  { title: 'Ishtirokchilar', url: '/admin/participants', icon: RiGroupLine },
  {
    title: 'Filiallar va FM',
    url: '/admin/branches',
    icon: RiBuilding2Line,
    adminOnly: true,
  },
  {
    title: 'Import va solishtirish',
    url: '/admin/import',
    icon: RiArrowLeftRightLine,
    adminOnly: true,
  },
  {
    title: 'Xodimlar',
    url: '/admin/staff',
    icon: RiUserStarLine,
    adminOnly: true,
  },
  {
    title: 'Eksport',
    url: '/admin/export',
    icon: RiDownload2Line,
    adminOnly: true,
  },
  {
    title: 'Sozlamalar',
    url: '/admin/settings',
    icon: RiSettings3Line,
    adminOnly: true,
  },
];

/** Rolga ko'ra ko'rinadigan bo'limlar */
export function sectionsFor(role: AdminMe['role']): NavSection[] {
  return NAV_SECTIONS.filter((s) => {
    const roles = s.roles ?? (s.adminOnly ? ['ADMIN'] : ['ADMIN', 'OPERATOR']);
    return roles.includes(role);
  });
}

/** Rol kira oladigan birinchi sahifa (kassir — faqat Kassa) */
export function homeFor(role: AdminMe['role']): string {
  return role === 'CASHIER' ? '/admin/cashier' : '/admin';
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
  return { title: 'Fazo Club' };
}
