'use client';

import { RiLoader4Line } from '@remixicon/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { DashboardShell } from '@/components/dashboard-shell';
import { KioskShell } from '@/components/kiosk-shell';
import { homeFor, inSection, isKiosk, sectionsFor } from '@/components/nav-tree';
import { handleLogout } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
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

function NoAccess({ login }: { login: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="grid w-full max-w-sm gap-3 rounded-2xl border bg-card p-6 text-center shadow-sm">
        <p className="font-medium">{login}: hech qaysi bo&apos;lim ochilmagan</p>
        <p className="text-sm text-muted-foreground">Adminga murojaat qiling — u sizga ruxsat beradi.</p>
        <Button variant="outline" onClick={handleLogout}>
          Chiqish
        </Button>
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
  const pathname = usePathname();
  const router = useRouter();
  // Ruxsat berilmagan sahifa ochilsa (masalan kassir /admin) — o'z sahifasiga
  const allowed = !me || sectionsFor(me).some((s) => inSection(pathname, s.url));
  const home = me && homeFor(me);
  useEffect(() => {
    if (me && !allowed && home) router.replace(home);
  }, [me, allowed, home, router]);

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

  if (me && !home) return <NoAccess login={me.login} />;
  if (!me || !allowed) return <LoadingScreen />;

  if (isKiosk(me)) {
    return (
      <AdminContext.Provider value={me}>
        <KioskShell>{children}</KioskShell>
      </AdminContext.Provider>
    );
  }

  return (
    <AdminContext.Provider value={me}>
      <DashboardShell sidebar={<AppSidebar />}>
        {children}
        <footer className="mt-auto pt-4 text-[11px] text-muted-foreground">
          Fazo Group <span className="mx-1.5">·</span>
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
