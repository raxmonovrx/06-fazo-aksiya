'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { SiteHeader } from '@/components/site-header';
import { PageHeaderProvider } from '@/components/page-header';

/**
 * shadcn sidebar holatni cookie'ga yozadi-yu, o'qimaydi (u server
 * render'ni kutadi, panel esa mijozda chiziladi) — shu yerda o'qiymiz,
 * aks holda yig'ib qo'yilgan sidebar har yangilashda ochilib ketardi.
 */
function initialSidebarOpen(): boolean {
  return !document.cookie.split('; ').includes('sidebar_state=false');
}

export function DashboardShell({
  sidebar,
  headerActions,
  children,
}: {
  sidebar: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  // Bir marta — keyin foydalanuvchi ⌘B yoki tugma bilan o'zi boshqaradi
  const [defaultOpen] = useState(initialSidebarOpen);
  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 64)',
          // Mijoz paneli bilan bir xil: ikki qatorli sarlavha 3rem da yopishib qolardi
          '--header-height': 'calc(var(--spacing) * 16)',
        } as CSSProperties
      }
    >
      {sidebar}
      {/* Sarlavha ham, sahifa ham shu provider ichida — tafsilot sahifasi
          o'z nomini yuqoriga uzatishi uchun. */}
      <PageHeaderProvider>
        <SidebarInset>
          <SiteHeader actions={headerActions} />
          <div className="@container/main flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </PageHeaderProvider>
    </SidebarProvider>
  );
}
