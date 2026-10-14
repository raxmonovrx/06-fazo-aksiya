'use client';

import { createContext, useContext } from 'react';

export type AdminRole = 'ADMIN' | 'OPERATOR' | 'CASHIER';

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
  /** Kassir biriktirilgan filial (qoidasi bilan) */
  branch: AdminBranch | null;
}

export const AdminContext = createContext<AdminMe | null>(null);
export const useAdmin = () => useContext(AdminContext)!;
