'use client';

import {
  RiComputerLine,
  RiExpandUpDownLine,
  RiLogoutBoxLine,
  RiMoonLine,
  RiShieldStarLine,
  RiSunLine,
} from '@remixicon/react';
import { useTheme } from 'next-themes';

import type { AdminMe } from '@/app/admin/(panel)/admin-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { adminApi } from '@/lib/api';
import { roleLabel } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export async function handleLogout() {
  try {
    await adminApi('/auth/logout', { method: 'POST' });
  } catch {
    // Sessiya baribir tugaydi — login sahifasiga o'tamiz
  }
  // To'liq sahifa almashinuvi — xotiradagi hamma narsa tozalanadi
  window.location.replace('/admin/login');
}

/** Avatar — brend rangidagi doira */
const AVATAR_FILL =
  'bg-linear-to-br from-sidebar-primary to-primary text-primary-foreground';

/** «farrux.admin» → «FA», «operator» → «OP» */
export function initialsFrom(login: string): string {
  const words = login
    .split(/[\s._-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return '?';
  return (
    words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
  ).toUpperCase();
}


/** Menyu bandi — blokdagidan balandroq, ikonka xiraroq */
const MENU_ITEM =
  'gap-2.5 px-2.5 py-2 not-data-[variant=destructive]:[&_svg]:text-muted-foreground';

export function NavUser({ login, role }: Pick<AdminMe, 'login' | 'role'>) {
  const { isMobile } = useSidebar();
  const { setTheme } = useTheme();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          {/* Oddiy native trigger — yig'ilganda 32px ga qisqaradi, faqat avatar qoladi */}
          <DropdownMenuTrigger className="peer/menu-button group/menu-button flex h-14 w-full items-center gap-2.5 overflow-hidden rounded-xl px-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding,background-color] duration-200 hover:bg-sidebar-accent focus-visible:ring-2 aria-expanded:bg-sidebar-accent group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 [&_svg]:shrink-0">
            <Avatar className="size-9 rounded-full after:hidden group-data-[collapsible=icon]:size-8">
              <AvatarFallback
                className={cn(
                  'rounded-full text-[13px] font-semibold tracking-wide',
                  AVATAR_FILL,
                )}
              >
                {initialsFrom(login)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 gap-0.5 text-left leading-tight">
              <span className="truncate text-sm font-medium">{login}</span>
              <span className="truncate text-xs text-muted-foreground">
                {roleLabel(role)}
              </span>
            </div>
            <RiExpandUpDownLine className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60 rounded-xl p-1.5 shadow-xl ring-foreground/[0.07]"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={8}
          >
            {/* Tepada — QAYERDA va QAYSI huquq bilan */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="mb-1 flex items-center gap-2.5 rounded-lg bg-muted/60 p-2.5 font-normal text-foreground">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-background/70 text-muted-foreground">
                  <RiShieldStarLine className="size-[18px]" />
                </span>
                <div className="grid min-w-0 flex-1 gap-0.5 leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      Fazo Group
                    </span>
                    <span className="ml-auto shrink-0 rounded-md bg-sidebar-primary/15 px-1.5 py-0.5 text-[11px] leading-none font-medium text-sidebar-primary">
                      {roleLabel(role)}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {window.location.host}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuItem
                className={MENU_ITEM}
                onClick={() => setTheme('light')}
              >
                <RiSunLine />
                Yorug&apos;
              </DropdownMenuItem>
              <DropdownMenuItem
                className={MENU_ITEM}
                onClick={() => setTheme('dark')}
              >
                <RiMoonLine />
                Qorong&apos;i
              </DropdownMenuItem>
              <DropdownMenuItem
                className={MENU_ITEM}
                onClick={() => setTheme('system')}
              >
                <RiComputerLine />
                Tizim bo&apos;yicha
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="mx-1.5 my-1.5 bg-foreground/[0.07]" />
            <DropdownMenuItem
              className={MENU_ITEM}
              onClick={handleLogout}
              variant="destructive"
            >
              <RiLogoutBoxLine />
              Chiqish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
