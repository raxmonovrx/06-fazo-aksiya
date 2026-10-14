'use client';

import { createContext, useContext } from 'react';

import type { AdminRole, Permission } from '@/lib/permissions';

export type { AdminRole, Permission };

export interface AdminBranch {
  id: number;
  name: string;
  minSum: number;
  couponPrice: number;
  maxPerReceipt: number;
}

export interface AdminMe {
  id: number;
  login: string;
  role: AdminRole;
  permissions: Permission[];
  /** Xodim biriktirilgan filial (qoidasi bilan) — kassa va vaucherlar shu filialda */
  branch: AdminBranch | null;
}

export const AdminContext = createContext<AdminMe | null>(null);
export const useAdmin = () => useContext(AdminContext)!;

export const can = (me: Pick<AdminMe, 'permissions'>, p: Permission) => (me.permissions ?? []).includes(p);
