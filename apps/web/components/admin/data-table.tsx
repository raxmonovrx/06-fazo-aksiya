'use client';

import {
  RiAddCircleLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCalendarLine,
  RiCheckLine,
  RiCloseLine,
  RiSearchLine,
} from '@remixicon/react';
import { useEffect, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { uz } from 'react-day-picker/locale';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/*
 * Ro'yxat sahifalari uchun data-table naqshi (shadcn «tasks» namunasi
 * uslubida):
 *
 *   <DataTableToolbar>            ← qidiruv + filtr tugmalari + o'ngda amallar
 *   <DataTableCard>               ← chegarali jadval + pastki qator (pager)
 *
 * Filtrlar darhol qo'llanadi (qidiruv — 300ms kechikish bilan), «Qidirish»
 * tugmasi yo'q. Filtr tugmasi bo'sh holatda punktir chegarali, tanlanganda
 * qiymat belgisi bilan.
 */

/** Qiymat o'zgarishini `ms` kechiktirib qaytaradi (qidiruv maydoni uchun) */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Jadval ustidagi qator: chapda filtrlar, o'ngda (`actions`) tugmalar */
export function DataTableToolbar({
  children,
  actions,
  className,
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2',
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Qidiruv maydoni — ixcham (w-64), ichida ikonka va tozalash tugmasi */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Qidirish…',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <InputGroup className={cn('h-8 w-full sm:w-64', className)}>
      <InputGroupAddon>
        <RiSearchLine />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) onChange('');
        }}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label="Tozalash"
            onClick={() => {
              onChange('');
              ref.current?.focus();
            }}
          >
            <RiCloseLine />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

export interface FacetOption {
  value: string;
  label: string;
  /** Ixtiyoriy rangli nuqta / ikonka (masalan status rangi) */
  icon?: React.ReactNode;
  count?: number;
}

/**
 * Bitta qiymatli filtr — punktir chegarali tugma, bosilganda ro'yxat.
 * Qiymat "" = tanlanmagan.
 */
export function FacetFilter({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: FacetOption[];
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 gap-1.5', !selected && 'border-dashed')}
          />
        }
      >
        <RiAddCircleLine
          className={cn('size-3.5', selected && 'rotate-45')}
          onClick={(e) => {
            // Ikonka bosilsa — tozalash (menyuni ochmasdan)
            if (selected) {
              e.stopPropagation();
              e.preventDefault();
              onChange('');
            }
          }}
        />
        {title}
        {selected && (
          <>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <Badge variant="secondary" className="rounded-sm px-1.5 font-normal">
              {selected.label}
            </Badge>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{title}</DropdownMenuLabel>
          {options.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onClick={() => onChange(o.value === value ? '' : o.value)}
            >
              <span
                className={cn(
                  'grid size-4 place-items-center rounded-[4px] border',
                  o.value === value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input',
                )}
              >
                {o.value === value && <RiCheckLine className="size-3" />}
              </span>
              {o.icon}
              <span className="flex-1 truncate">{o.label}</span>
              {o.count !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {o.count}
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {selected && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center"
              onClick={() => onChange('')}
            >
              Filtrni tozalash
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined;
};
const short = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentyabr',
  'Oktyabr',
  'Noyabr',
  'Dekabr',
];
const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

/** Tezkor oraliqlar */
function preset(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days + 1);
  return { from: toKey(from), to: toKey(to) };
}

/**
 * Sana oralig'i filtri — bitta tugma, ochilganda tezkor oraliqlar va
 * ikki oylik kalendar. Qiymatlar `YYYY-MM-DD` yoki "".
 */
export function DateRangeFilter({
  title = 'Sana',
  from,
  to,
  onChange,
}: {
  title?: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const range: DateRange | undefined =
    from || to ? { from: fromKey(from), to: fromKey(to) } : undefined;
  const label =
    range?.from && range.to
      ? range.from.getTime() === range.to.getTime()
        ? short(range.from)
        : `${short(range.from)} – ${short(range.to)}`
      : range?.from
        ? `${short(range.from)} dan`
        : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn('h-8 gap-1.5', !label && 'border-dashed')}
          />
        }
      >
        <RiCalendarLine className="size-3.5" />
        {title}
        {label && (
          <>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <Badge
              variant="secondary"
              className="rounded-sm px-1.5 font-normal tabular-nums"
            >
              {label}
            </Badge>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <div className="flex gap-1 border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
            {[
              { label: 'Bugun', days: 1 },
              { label: '7 kun', days: 7 },
              { label: '30 kun', days: 30 },
              { label: '90 kun', days: 90 },
            ].map((p) => (
              <Button
                key={p.days}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  onChange(preset(p.days));
                  setOpen(false);
                }}
              >
                {p.label}
              </Button>
            ))}
            {label && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground"
                onClick={() => {
                  onChange({ from: '', to: '' });
                  setOpen(false);
                }}
              >
                Tozalash
              </Button>
            )}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={range}
            defaultMonth={range?.from ?? new Date(new Date().getFullYear(), new Date().getMonth() - 1)}
            onSelect={(r) =>
              onChange({
                from: r?.from ? toKey(r.from) : '',
                to: r?.to ? toKey(r.to) : '',
              })
            }
            weekStartsOn={1}
            locale={uz}
            formatters={{
              formatCaption: (m) => `${MONTHS[m.getMonth()]} ${m.getFullYear()}`,
              formatWeekdayName: (d) => WEEKDAYS[d.getDay()]!,
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** «Tozalash» — biror filtr faol bo'lsa ko'rinadi */
export function ResetFilters({
  show,
  onReset,
}: {
  show: boolean;
  onReset: () => void;
}) {
  if (!show) return null;
  return (
    <Button variant="ghost" size="sm" className="h-8" onClick={onReset}>
      Tozalash
      <RiCloseLine data-icon="inline-end" />
    </Button>
  );
}

/**
 * Jadval qobig'i — chegarali, yumaloq; pastda `footer` (odatda
 * `DataTablePagination`). Jadvalni `@/components/ui/table` bilan yozing.
 */
export function DataTableCard({
  children,
  footer,
  className,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card [&_[data-slot=table-container]]:overflow-x-auto [&_thead_tr]:bg-muted/40 [&_th]:h-10 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground [&_td]:px-3 [&_td]:py-2.5',
        className,
      )}
    >
      {children}
      {footer && <div className="border-t px-3 py-2">{footer}</div>}
    </div>
  );
}

/** Sahifalash: «N ta natija» · sahifa hajmi · ‹ 2 / 5 › */
export function DataTablePagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizes = [25, 50, 100],
  noun = 'ta',
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
  pageSizes?: number[];
  /** «12 ta chek» — `noun="ta chek"` */
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const fromN = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toN = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {total > 0 ? (
          <>
            {fromN}–{toN} / <span className="text-foreground">{total}</span>{' '}
            {noun}
          </>
        ) : (
          <>0 {noun}</>
        )}
      </span>
      <div className="flex items-center gap-4">
        {onPageSize && (
          <div className="hidden items-center gap-2 sm:flex">
            <span>Sahifada</span>
            <Select
              items={pageSizes.map((n) => ({ value: String(n), label: String(n) }))}
              value={String(pageSize)}
              onValueChange={(v) => onPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Oldingi sahifa"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <RiArrowLeftSLine />
          </Button>
          <span className="min-w-16 text-center tabular-nums">
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
    </div>
  );
}
