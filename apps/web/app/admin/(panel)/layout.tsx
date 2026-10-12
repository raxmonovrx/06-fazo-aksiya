'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cx } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { AdminContext, type AdminMe } from './admin-context';

const NAV: Array<{ href: string; label: string; adminOnly?: boolean }> = [
  { href: '/admin', label: '📊 Dashboard' },
  { href: '/admin/moderation', label: '👀 Moderatsiya' },
  { href: '/admin/receipts', label: '🧾 Cheklar' },
  { href: '/admin/participants', label: '👥 Ishtirokchilar' },
  { href: '/admin/branches', label: '🏢 Filiallar va FM', adminOnly: true },
  { href: '/admin/import', label: '📥 Import va solishtirish', adminOnly: true },
  { href: '/admin/staff', label: '🧑‍🍳 Xodimlar', adminOnly: true },
  { href: '/admin/export', label: '📤 Eksport', adminOnly: true },
  { href: '/admin/settings', label: '⚙️ Sozlamalar', adminOnly: true },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [open, setOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    adminApi<AdminMe>('/auth/me').then(setMe).catch(() => undefined);
  }, []);
  useEffect(() => setOpen(false), [path]);

  if (!me) return <div className="p-10 text-center text-neutral-400">Yuklanmoqda…</div>;

  const logout = async () => {
    await adminApi('/auth/logout', { method: 'POST' }).catch(() => undefined);
    window.location.href = '/admin/login';
  };

  return (
    <AdminContext.Provider value={me}>
      <div className="min-h-screen bg-neutral-50 text-neutral-900 md:flex">
        <aside
          className={cx(
            'fixed inset-y-0 left-0 z-20 w-60 shrink-0 border-r border-neutral-200 bg-white p-3 transition md:static md:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="mb-4 px-2">
            <p className="font-bold">Fazo Club</p>
            <p className="text-xs text-neutral-500">Omad Fazosi · admin</p>
          </div>
          <nav className="space-y-0.5">
            {NAV.filter((n) => !n.adminOnly || me.role === 'ADMIN').map((n) => {
              const active = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cx('block rounded-lg px-3 py-2 text-sm', active ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100')}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 border-t border-neutral-100 px-2 pt-3 text-xs text-neutral-500">
            <p>
              {me.login} · {me.role === 'ADMIN' ? 'Admin' : 'Operator'}
            </p>
            <button onClick={logout} className="mt-1 text-red-600 hover:underline">
              Chiqish
            </button>
          </div>
        </aside>
        {open && <div className="fixed inset-0 z-10 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 border-b border-neutral-200 bg-white p-3 md:hidden">
            <button onClick={() => setOpen(true)} className="rounded-lg px-2 py-1 text-xl">☰</button>
            <span className="font-semibold">Fazo Club</span>
          </div>
          <main className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
