import type { AdminRole, AdminUser } from '@prisma/client';

/**
 * Panel ruxsatlari. Har biri bitta bo'lim (yoki undagi amal) — sidebar ham,
 * API ham shu ro'yxatga qaraydi. Web nusxasi: apps/web/lib/permissions.ts
 */
export const PERMISSIONS = [
  'dashboard',
  'cashier',
  'vouchers',
  'vouchers.cancel',
  'moderation',
  'receipts',
  'participants',
  'participants.edit',
  'branches',
  'import',
  'staff',
  'export',
  'settings',
  'users',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Rol tanlanganda beriladigan boshlang'ich ruxsatlar (keyin har biri alohida o'zgartiriladi) */
export const ROLE_TEMPLATES: Record<AdminRole, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  OPERATOR: ['dashboard', 'vouchers', 'moderation', 'receipts', 'participants'],
  MANAGER: ['cashier', 'vouchers', 'vouchers.cancel'],
  CASHIER: ['cashier'],
};

/** Filialsiz ishlay olmaydigan rollar */
export const BRANCH_ROLES: readonly AdminRole[] = ['CASHIER', 'MANAGER'];

export const isPermission = (s: string): s is Permission => (PERMISSIONS as readonly string[]).includes(s);

/** ADMIN — hammasi; boshqalar — saqlangan ruxsatlar (noma'lumlari tashlanadi) */
export function permissionsOf(u: Pick<AdminUser, 'role' | 'permissions'>): Permission[] {
  if (u.role === 'ADMIN') return [...PERMISSIONS];
  return (u.permissions ?? []).filter(isPermission);
}

export const can = (u: Pick<AdminUser, 'role' | 'permissions'>, p: Permission) => permissionsOf(u).includes(p);
