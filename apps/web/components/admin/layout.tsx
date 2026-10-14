'use client';

import { cn } from '@/lib/utils';

/*
 * Sahifa tuzilishi bo'laklari: kenglik cheklovi, bo'sh holat, sozlamalar
 * bo'limi. Kontent hech qachon ekran kengligiga cho'zilib ketmasin —
 * ro'yxatlar `wide` (1400px), formalar/sozlamalar `narrow` (960px).
 */

export function PageContainer({
  size = 'wide',
  className,
  children,
}: {
  size?: 'wide' | 'narrow';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-4',
        size === 'wide' ? 'max-w-[1400px]' : 'max-w-[960px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Sahifa ichidagi sarlavha (ixtiyoriy) — sarlavha qatorida nom bor, bu yerda
 * faqat qisqa izoh + asosiy amal. Izoh bitta qator, uzun matn yozilmaydi.
 */
export function PageIntro({
  description,
  actions,
}: {
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : (
        <span />
      )}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bo'sh holat — ikonka, sarlavha, izoh va (ixtiyoriy) amal */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-2 grid size-11 place-items-center rounded-xl border bg-muted/50 text-muted-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/**
 * Sozlamalar bo'limi — Vercel/Linear uslubi: chapda sarlavha va izoh,
 * o'ngda forma kartasi. Telefonda ustma-ust.
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b pb-8 last:border-b-0 md:grid-cols-[260px_minmax(0,1fr)] md:gap-10">
      <div className="grid content-start gap-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Kichik status nuqtasi (badge ichida yoki matn yonida) */
export function Dot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-1.5 shrink-0 rounded-full', className)}
    />
  );
}
