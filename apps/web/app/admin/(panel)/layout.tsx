'use client';

import { RiLoader4Line } from '@remixicon/react';
import { useEffect, useState } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { DashboardShell } from '@/components/dashboard-shell';
import { adminApi } from '@/lib/api';
import { AdminContext, type AdminMe } from './admin-context';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl border bg-card p-6 text-xs text-muted-foreground shadow-sm">
        <RiLoader4Line className="size-3.5 animate-spin" />
        Ma&apos;lumotlar yuklanmoqda...
      </div>
    </div>
  );
}

// Shell shu yerda, har sahifada emas: sidebar va sarlavha sahifa
// almashganda joyida qoladi, faqat kontent maydoni yangilanadi.
export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [me, setMe] = useState<AdminMe | null>(null);

  useEffect(() => {
    let cancelled = false;

    adminApi<AdminMe>('/auth/me')
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch(() => {
        if (!cancelled) window.location.replace('/admin/login');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!me) return <LoadingScreen />;

  return (
    <AdminContext.Provider value={me}>
      <DashboardShell sidebar={<AppSidebar />}>
        {children}
        <footer className="mt-auto pt-4 text-[11px] text-muted-foreground">
          Fazo Club <span className="mx-1.5">·</span>
          <a
            href="https://raxmonovrx.uz"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            raxmonovrx.uz
          </a>
        </footer>
      </DashboardShell>
    </AdminContext.Provider>
  );
}
