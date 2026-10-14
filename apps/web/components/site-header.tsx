'use client';

import { RiArrowLeftLine, RiLayoutGridLine } from '@remixicon/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/header-tools';
import { pageTrail } from '@/components/nav-tree';
import { usePageHeaderOverride } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

/**
 * Qobiq sarlavhasi — restobrain bilan 1:1: bo'lim ikonkasi (brend
 * rangida), ustida kichik ota bo'g'in (havola), pastda qalin sahifa nomi.
 * Nomlar `nav-tree.ts` dan — sidebar bilan bir manba. Tafsilot sahifasi
 * o'z nomini `usePageHeader` bilan beradi.
 */
export function SiteHeader({ actions }: { actions?: React.ReactNode }) {
  const pathname = usePathname();
  const override = usePageHeaderOverride();
  const backHref = override?.backHref;

  const trail = pageTrail(pathname);
  const title = override?.title ?? trail.title;
  // Bo'lim boshida ota bo'g'in yo'q — nomning o'zi bo'lim
  const parent =
    trail.section && title !== trail.section.title ? trail.section : undefined;
  const Icon = trail.section?.icon ?? RiLayoutGridLine;

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
        {backHref && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-1"
            nativeButton={false}
            render={<Link href={backHref} aria-label="Orqaga" />}
          >
            <RiArrowLeftLine />
          </Button>
        )}
        <SidebarTrigger className={backHref ? undefined : '-ml-1'} />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />

        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sidebar-primary/12 text-sidebar-primary max-sm:hidden">
            <Icon className="size-[18px]" />
          </span>
          <div className="grid min-w-0 leading-tight">
            {parent && (
              <nav
                aria-label="breadcrumb"
                className="flex min-w-0 text-xs text-muted-foreground max-md:hidden"
              >
                <Link
                  href={parent.url}
                  className="truncate transition-colors hover:text-foreground"
                >
                  {parent.title}
                </Link>
              </nav>
            )}
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]">
              {title}
            </h1>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          <ThemeToggle />
          {actions}
        </div>
      </div>
    </header>
  );
}
