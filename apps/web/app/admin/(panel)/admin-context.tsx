'use client';

import { createContext, useContext } from 'react';

export interface AdminMe {
  id: number;
  login: string;
  role: 'ADMIN' | 'OPERATOR';
}

export const AdminContext = createContext<AdminMe | null>(null);
export const useAdmin = () => useContext(AdminContext)!;
