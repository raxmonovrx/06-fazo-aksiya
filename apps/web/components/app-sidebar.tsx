'use client';

import Link from 'next/link';

import { useAdmin } from '@/app/(admin)/(panel)/admin-context';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

/** Brend belgisi — ko'k kvadratdagi «F» (yig'ilganda yolg'iz qoladi) */
function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={`grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-[15px] font-extrabold text-primary-foreground ${className ?? ''}`}
    >
      F
    </span>
  );
}

/**
 * Sidebar — restobrain superadmin bilan 1:1 (logo, ikonkagacha yig'iladi,
 * chekkada rail). Bo'limlar `nav-tree.ts` dan.
 */
export function AppSidebar() {
  const admin = useAdmin();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* `SidebarMenuButton` emas: u ichidagi belgini 16px ga siqadi */}
            <Link
              href="/dashboard"
              aria-label="Fazo Group — Dashboard"
              className="flex h-12 items-center gap-2 rounded-md pr-2 pl-[3px] ring-sidebar-ring outline-hidden focus-visible:ring-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
            >
              <BrandMark />
              <span className="truncate text-[15px] font-bold tracking-tight group-data-[collapsible=icon]:hidden">
                Fazo Group
              </span>
              {/* «admin» — bu ishtirokchilar sahifasi emasligi bir qarashda ko'rinsin */}
              <span className="rounded-md border border-sidebar-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
                admin
              </span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <NavUser login={admin.login} role={admin.role} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
