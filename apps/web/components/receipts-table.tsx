'use client';

import {
  RiArrowRightUpLine,
  RiFileCopyLine,
  RiFilterOffLine,
  RiImageLine,
  RiMore2Fill,
  RiReceiptLine,
  RiUserLine,
} from '@remixicon/react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  DataTableCard,
  DataTablePagination,
  DataTableToolbar,
  DateRangeFilter,
  FacetFilter,
  ResetFilters,
  SearchInput,
  useDebounced,
} from '@/components/admin/data-table';
import {
  ErrorAlert,
  STATUS_DOT,
  StatusBadge,
  useLoad,
} from '@/components/admin/kit';
import { Dot, EmptyState } from '@/components/admin/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { adminApi, qs } from '@/lib/api';
import { fmtPhone, fmtShort, fmtSum, STATUS } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ReceiptItem {
  id: number;
  status: string;
  source: string;
  fm: string | null;
  receiptNumber: string | null;
  fiscalAt: string | null;
  amount: string | null;
  couponsCount: number;
  rejectCode: string | null;
  rejectReason: string | null;
  photoFileId: string | null;
  createdAt: string;
  branch: { id: number; name: string } | null;
  participant: {
    id: number;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    isStaff: boolean;
  };
}

interface Page {
  total: number;
  page: number;
  pageSize: number;
  items: ReceiptItem[];
}

export interface Filters {
  status: string;
  branchId: string;
  phone: string;
  q: string;
  /** YYYY-MM-DD (qo'shilgan sana, dan) */
  from: string;
  /** YYYY-MM-DD (qo'shilgan sana, gacha) */
  to: string;
}

export interface ReceiptsTableState {
  filters: Filters;
  page: number;
  pageSize: number;
}

export const PAGE_SIZES = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Bitta qidiruv maydoni → API'ning `phone` yoki `q` parametri.
 * API: `q` — chek raqami (aniq), FM (qism) yoki ID; `phone` — raqamlar (qism).
 * Harf bor → `q` (FM). `+`, bo'sh joy, tire, qavs yoki 7+ raqam → telefon.
 * Qisqa raqam → `q` (chek № yoki ID).
 */
export function splitSearch(raw: string): { phone: string; q: string } {
  const s = raw.trim();
  if (!s) return { phone: '', q: '' };
  if (/[a-z]/i.test(s)) return { phone: '', q: s };
  const digits = s.replace(/\D/g, '');
  if (/^\+|[\s()-]/.test(s) || digits.length >= 7) {
    return { phone: digits, q: '' };
  }
  return { phone: '', q: s };
}

const fullName = (p: ReceiptItem['participant']) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ');

export function ReceiptsTable({
  initial,
  initialPage = 1,
  initialPageSize = DEFAULT_PAGE_SIZE,
  lockStatus,
  showPhoto,
  actions,
  reloadKey = 0,
  onStateChange,
}: {
  initial: Filters;
  initialPage?: number;
  initialPageSize?: number;
  /** Status filtri yashiriladi va `initial.status` doim qo'llanadi */
  lockStatus?: boolean;
  /** Chek rasmi kichik ko'rinishi uchun ustun */
  showPhoto?: boolean;
  /** Toolbar o'ng tomonidagi tugmalar */
  actions?: React.ReactNode;
  /** O'zgarsa — ro'yxat qayta yuklanadi (filtrlar saqlanadi) */
  reloadKey?: number;
  /** Filtr/sahifa o'zgarganda (masalan URL'ga yozish uchun) */
  onStateChange?: (s: ReceiptsTableState) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initial.phone || initial.q);
  const [status, setStatus] = useState(initial.status);
  const [branchId, setBranchId] = useState(initial.branchId);
  const [range, setRange] = useState({ from: initial.from, to: initial.to });
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const debounced = useDebounced(search);

  // Qidiruv matni o'zgarganda 1-sahifaga qaytamiz (shu renderning o'zida,
  // aks holda eski sahifa bilan ortiqcha so'rov ketadi)
  const [prevSearch, setPrevSearch] = useState(debounced);
  if (debounced !== prevSearch) {
    setPrevSearch(debounced);
    setPage(1);
  }

  const filters = useMemo<Filters>(
    () => ({
      status: lockStatus ? initial.status : status,
      branchId,
      ...splitSearch(debounced),
      from: range.from,
      to: range.to,
    }),
    [lockStatus, initial.status, status, branchId, debounced, range],
  );

  const onStateRef = useRef(onStateChange);
  useEffect(() => {
    onStateRef.current = onStateChange;
  });
  useEffect(() => {
    onStateRef.current?.({ filters, page, pageSize });
  }, [filters, page, pageSize]);

  const branches = useLoad(
    () => adminApi<Array<{ id: number; name: string }>>('/branches'),
    [],
  );
  const { data, error, loading, reload } = useLoad(
    () =>
      adminApi<Page>(
        `/receipts${qs({
          status: filters.status,
          branchId: filters.branchId,
          phone: filters.phone,
          q: filters.q,
          from: filters.from && `${filters.from} 00:00`,
          to: filters.to && `${filters.to} 23:59`,
          page,
          pageSize,
        })}`,
      ),
    [filters, page, pageSize, reloadKey],
  );

  const statusOptions = Object.entries(STATUS).map(([value, s]) => ({
    value,
    label: s.label,
    icon: <Dot className={STATUS_DOT[value] ?? 'bg-muted-foreground'} />,
  }));
  const branchOptions = (branches.data ?? []).map((b) => ({
    value: String(b.id),
    label: b.name,
  }));

  const isFiltered = Boolean(
    search || (!lockStatus && status) || branchId || range.from || range.to,
  );
  const reset = () => {
    setSearch('');
    setStatus('');
    setBranchId('');
    setRange({ from: '', to: '' });
    setPage(1);
  };
  const withPageReset =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setPage(1);
    };

  const open = (id: number) => router.push(`/admin/receipts/${id}`);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Nusxa olindi');
    } catch {
      toast.error("Nusxa olib bo'lmadi");
    }
  };

  const items = data?.items ?? [];
  const colSpan = showPhoto ? 11 : 10;

  return (
    <div className="flex flex-col gap-3">
      <DataTableToolbar actions={actions}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Telefon, chek № yoki FM"
        />
        {!lockStatus && (
          <FacetFilter
            title="Status"
            value={status}
            onChange={withPageReset(setStatus)}
            options={statusOptions}
          />
        )}
        <FacetFilter
          title="Filial"
          value={branchId}
          onChange={withPageReset(setBranchId)}
          options={branchOptions}
        />
        <DateRangeFilter
          title="Qo'shilgan"
          from={range.from}
          to={range.to}
          onChange={withPageReset(setRange)}
        />
        <ResetFilters show={isFiltered} onReset={reset} />
      </DataTableToolbar>

      {error && (
        <div className="flex flex-col gap-2">
          <ErrorAlert error={error} />
          <div>
            <Button variant="outline" size="sm" onClick={() => void reload()}>
              Qayta urinish
            </Button>
          </div>
        </div>
      )}

      <DataTableCard
        footer={
          data && data.total > 0 ? (
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              pageSizes={PAGE_SIZES}
              noun="ta chek"
            />
          ) : undefined
        }
      >
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16">ID</TableHead>
              {showPhoto && <TableHead className="w-14">Rasm</TableHead>}
              <TableHead>Ishtirokchi</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Chek</TableHead>
              <TableHead>Chek vaqti</TableHead>
              <TableHead className="text-right">Summa</TableHead>
              <TableHead className="text-right">Kupon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Qo&apos;shilgan</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Amallar</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              <SkeletonRows showPhoto={showPhoto} rows={8} />
            ) : items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="p-0">
                  {isFiltered ? (
                    <EmptyState
                      icon={RiFilterOffLine}
                      title="Hech narsa topilmadi"
                      description="Bu filtrlarga mos chek yo'q — filtrlarni tozalang."
                      action={
                        <Button variant="outline" size="sm" onClick={reset}>
                          Filtrlarni tozalash
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={RiReceiptLine}
                      title="Hozircha cheklar yo'q"
                      description="Ishtirokchilar bot orqali yuborgan cheklar shu yerda ko'rinadi."
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              items.map((r) => {
                const name = fullName(r.participant);
                return (
                  <TableRow
                    key={r.id}
                    tabIndex={0}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none',
                      loading && 'opacity-60',
                    )}
                    onClick={() => open(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target === e.currentTarget) {
                        open(r.id);
                      }
                    }}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                      #{r.id}
                    </TableCell>
                    {showPhoto && (
                      <TableCell className="py-1.5">
                        {r.photoFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/admin/photos/${r.photoFileId}`}
                            alt=""
                            className="h-10 w-8 rounded-md object-cover ring-1 ring-foreground/10"
                            loading="lazy"
                          />
                        ) : (
                          <span className="grid h-10 w-8 place-items-center rounded-md bg-muted text-muted-foreground">
                            <RiImageLine className="size-3.5" />
                          </span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums">
                          {fmtPhone(r.participant.phone)}
                        </span>
                        {r.participant.isStaff && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1.5 text-[10px] font-normal"
                          >
                            xodim
                          </Badge>
                        )}
                      </div>
                      {name && (
                        <div className="max-w-48 truncate text-xs text-muted-foreground">
                          {name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.branch?.name ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="tabular-nums">
                          {r.receiptNumber ? (
                            `№ ${r.receiptNumber}`
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </span>
                        {r.source === 'PHOTO' && (
                          <Badge
                            variant="outline"
                            className="h-4 gap-1 px-1.5 text-[10px] font-normal text-muted-foreground"
                          >
                            <RiImageLine className="size-2.5!" />
                            Rasm
                          </Badge>
                        )}
                        {r.source === 'MANUAL' && (
                          <Badge
                            variant="outline"
                            className="h-4 px-1.5 text-[10px] font-normal text-muted-foreground"
                          >
                            Qo&apos;lda
                          </Badge>
                        )}
                      </div>
                      {r.fm && (
                        <div className="font-mono text-xs text-muted-foreground">
                          {r.fm}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.fiscalAt ? (
                        fmtShort(r.fiscalAt)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.amount !== null ? (
                        fmtSum(r.amount)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.couponsCount ? (
                        <span className="font-medium">{r.couponsCount}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                      {r.rejectReason && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <div className="mt-1 max-w-44 truncate text-xs text-muted-foreground" />
                            }
                          >
                            {r.rejectReason}
                          </TooltipTrigger>
                          <TooltipContent className="max-w-72 whitespace-normal">
                            {r.rejectReason}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {fmtShort(r.createdAt)}
                    </TableCell>
                    <TableCell
                      className="py-0 text-right"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Amallar"
                              className="text-muted-foreground data-popup-open:bg-muted"
                            />
                          }
                        >
                          <RiMore2Fill />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => open(r.id)}>
                            <RiArrowRightUpLine />
                            Ochish
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(
                                `/admin/participants/${r.participant.id}`,
                              )
                            }
                          >
                            <RiUserLine />
                            Ishtirokchini ochish
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={!r.receiptNumber}
                            onClick={() =>
                              r.receiptNumber && void copy(r.receiptNumber)
                            }
                          >
                            <RiFileCopyLine />
                            Nusxa: chek №
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </DataTableCard>
    </div>
  );
}

/** Yuklanish — yakuniy qator tuzilishiga mos skeletlar */
function SkeletonRows({
  rows,
  showPhoto,
}: {
  rows: number;
  showPhoto?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-3 w-10" />
          </TableCell>
          {showPhoto && (
            <TableCell className="py-1.5">
              <Skeleton className="h-10 w-8 rounded-md" />
            </TableCell>
          )}
          <TableCell>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-1.5 h-3 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto h-4 w-6" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3 w-16" />
          </TableCell>
          <TableCell />
        </TableRow>
      ))}
    </>
  );
}
