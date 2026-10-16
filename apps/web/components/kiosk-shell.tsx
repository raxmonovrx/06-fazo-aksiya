'use client';

import { RiLogoutBoxRLine, RiMoonLine, RiSunLine } from '@remixicon/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import type { ReactNode } from 'react';

import { useAdmin } from '@/app/(admin)/(panel)/admin-context';
import { inSection, sectionsFor } from '@/components/nav-tree';
import { handleLogout } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import { roleLabel } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/**
 * Kassa rejimi (kassir, filial menejeri): sidebar yo'q, tepada filial va
 * bir-ikki bo'lim, qolgan hamma joy — ish ekrani. Sunmi va kassa kompyuteri uchun.
 */
export function KioskShell({ children }: { children: ReactNode }) {
  const me = useAdmin();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const sections = sectionsFor(me);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="flex h-16 items-center gap-3 px-4 md:px-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-lg font-extrabold text-primary-foreground">
            F
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-base font-bold">{me.branch?.name ?? 'Fazo Group'}</div>
            <div className="truncate text-xs text-muted-foreground">
              {me.login} · {roleLabel(me.role)}
            </div>
          </div>

          {sections.length > 1 && (
            <nav className="ml-4 hidden gap-1 md:flex">
              {sections.map((s) => (
                <Link
                  key={s.url}
                  href={s.url}
                  className={cn(
                    'flex h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                    inSection(pathname, s.url) && 'bg-muted text-foreground',
                  )}
                >
                  <s.icon className="size-5" />
                  {s.title}
                </Link>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-lg"
              className="size-11"
              aria-label="Mavzu"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <RiSunLine /> : <RiMoonLine />}
            </Button>
            <Button variant="ghost" size="lg" className="h-11 gap-2 px-3" onClick={handleLogout}>
              <RiLogoutBoxRLine />
              <span className="hidden sm:inline">Chiqish</span>
            </Button>
          </div>
        </div>

        {sections.length > 1 && (
          <nav className="flex gap-1 px-3 pb-2 md:hidden">
            {sections.map((s) => (
              <Link
                key={s.url}
                href={s.url}
                className={cn(
                  'flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium text-muted-foreground',
                  inSection(pathname, s.url) && 'bg-muted text-foreground',
                )}
              >
                <s.icon className="size-4" />
                {s.title}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex flex-1 flex-col gap-4 p-3 md:p-6">{children}</main>
    </div>
  );
}
