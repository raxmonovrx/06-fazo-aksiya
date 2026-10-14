'use client';

import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiErrorWarningLine,
  RiInboxLine,
} from '@remixicon/react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { STATUS } from '@/lib/format';
import { cn } from '@/lib/utils';

/*
 * Admin sahifalari uchun umumiy bo'laklar. Sahifa nomi sarlavhada
 * (site-header) — sahifaning o'zida <h1> YO'Q, tepada faqat `PageToolbar`.
 */

/** Sahifa tepasi: chapda qisqa izoh, o'ngda amallar (tugmalar) */
export function PageToolbar({
  description,
  children,
  className,
}: {
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3',
        className,
      )}
    >
      {description ? (
        <p className="max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      ) : (
        <span />
      )}
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}

/** Chek statusi — rangli belgi (lib/format STATUS) */
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status];
  return (
    <Badge
      variant="secondary"
      className={cn('border-transparent font-medium', s?.cls)}
    >
      {s?.label ?? status}
    </Badge>
  );
}

/** Statistika kartasi — Dashboard va tafsilot sahifalarida */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-[18px]" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}

/** Sahifalash: «Jami: N» va ‹ 1 / 5 › */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        Jami: <span className="font-medium text-foreground">{total}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Oldingi sahifa"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          <RiArrowLeftSLine />
        </Button>
        <span className="min-w-14 text-center tabular-nums">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Keyingi sahifa"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          <RiArrowRightSLine />
        </Button>
      </div>
    </div>
  );
}

/** Jadval bo'sh — butun qator bo'ylab */
export function TableEmpty({
  colSpan,
  children = "Ma'lumot yo'q",
}: {
  colSpan: number;
  children?: React.ReactNode;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-32 text-center">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <RiInboxLine className="size-6 opacity-60" />
          {children}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Jadval yuklanmoqda — skeleton qatorlar */
export function TableLoading({
  colSpan,
  rows = 5,
}: {
  colSpan: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          {Array.from({ length: colSpan }, (_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full max-w-32" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Xato xabari (API xatosi va h.k.). Muvaffaqiyat uchun — `toast.success` */
export function ErrorAlert({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
    >
      <RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

/** «Kalit — qiymat» ro'yxati (tafsilot sahifalari) */
export function InfoList({
  items,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-2', className)}>
      {items.map((i) => (
        <div key={i.label} className="grid gap-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {i.label}
          </dt>
          <dd className="text-sm">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Oddiy ma'lumot yuklash hook'i */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [run]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}
