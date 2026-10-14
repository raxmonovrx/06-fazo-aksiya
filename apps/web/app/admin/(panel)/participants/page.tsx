'use client';

import { RiArrowRightUpLine, RiMore2Fill, RiUserSearchLine } from '@remixicon/react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import {
  DataTableCard,
  DataTablePagination,
  DataTableToolbar,
  FacetFilter,
  ResetFilters,
  SearchInput,
  useDebounced,
} from '@/components/admin/data-table';
import { ErrorAlert, useLoad } from '@/components/admin/kit';
import { Dot, EmptyState, PageContainer } from '@/components/admin/layout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { adminApi, qs } from '@/lib/api';
import { fmtPhone, fmtShort } from '@/lib/format';
import { cn } from '@/lib/utils';

interface P {
  id: number;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  source: string | null;
  isStaff: boolean;
  isBlocked: boolean;
  rulesAcceptedAt: string | null;
  createdAt: string;
  _count: { receipts: number; coupons: number };
}

const STAFF_OPTIONS = [
  {
    value: 'false',
    label: 'Mijoz',
    icon: <Dot className="bg-emerald-500" />,
  },
  { value: 'true', label: 'Xodim', icon: <Dot className="bg-sky-500" /> },
];

const BLOCKED_OPTIONS = [
  { value: 'false', label: 'Faol', icon: <Dot className="bg-emerald-500" /> },
  {
    value: 'true',
    label: 'Bloklangan',
    icon: <Dot className="bg-red-500" />,
  },
];

const COLS = 6;
const PAGE_SIZES = [25, 50, 100];

/** Avatar uchun bosh harflar (ism bo'lmasa — username yoki telefon) */
function initials(p: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
}) {
  const s = [p.firstName, p.lastName]
    .filter(Boolean)
    .map((w) => w!.trim()[0] ?? '')
    .join('');
  return (s || p.username?.[0] || p.phone?.slice(-2) || '#')
    .slice(0, 2)
    .toUpperCase();
}

function fullName(p: P) {
  return [p.firstName, p.lastName].filter(Boolean).join(' ');
}

function ParticipantsTable() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get('q') ?? '');
  const [staff, setStaff] = useState(sp.get('staff') ?? '');
  const [blocked, setBlocked] = useState(sp.get('blocked') ?? '');
  const [page, setPage] = useState(Number(sp.get('page')) || 1);
  const [pageSize, setPageSize] = useState(
    PAGE_SIZES.includes(Number(sp.get('pageSize')))
      ? Number(sp.get('pageSize'))
      : 50,
  );
  const dq = useDebounced(q.trim());

  // Filtrlar URL'da — havola va yangilashda holat saqlanadi
  useEffect(() => {
    const params = qs({
      q: dq,
      staff,
      blocked,
      page: page > 1 ? page : '',
      pageSize: pageSize !== 50 ? pageSize : '',
    });
    router.replace(`${pathname}${params}`, { scroll: false });
  }, [dq, staff, blocked, page, pageSize, pathname, router]);

  const { data, error, loading } = useLoad(
    () =>
      adminApi<{ total: number; page: number; pageSize: number; items: P[] }>(
        `/participants${qs({ q: dq, staff, blocked, page, pageSize })}`,
      ),
    [dq, staff, blocked, page, pageSize],
  );

  const anyFilter = !!(q || staff || blocked);
  const reset = () => {
    setQ('');
    setStaff('');
    setBlocked('');
    setPage(1);
  };
  const open = (id: number) => router.push(`/admin/participants/${id}`);

  return (
    <>
      <DataTableToolbar>
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="Telefon, ism, @username, kod"
        />
        <FacetFilter
          title="Turi"
          value={staff}
          onChange={(v) => {
            setStaff(v);
            setPage(1);
          }}
          options={STAFF_OPTIONS}
        />
        <FacetFilter
          title="Holat"
          value={blocked}
          onChange={(v) => {
            setBlocked(v);
            setPage(1);
          }}
          options={BLOCKED_OPTIONS}
        />
        <ResetFilters show={anyFilter} onReset={reset} />
      </DataTableToolbar>

      <ErrorAlert error={error} />

      <DataTableCard
        footer={
          data && data.total > 0 ? (
            <DataTablePagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              pageSizes={PAGE_SIZES}
              noun="ta ishtirokchi"
            />
          ) : undefined
        }
      >
        <Table className={cn(loading && data && 'opacity-60')}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Ishtirokchi</TableHead>
              <TableHead className="hidden md:table-cell">Telegram</TableHead>
              <TableHead>Ro&apos;yxatdan o&apos;tgan</TableHead>
              <TableHead className="text-right">QR</TableHead>
              <TableHead className="text-right">Kuponlar</TableHead>
              <TableHead className="w-12 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              Array.from({ length: 8 }, (_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full" />
                      <div className="grid gap-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Skeleton className="h-3.5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-3.5 w-6" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-3.5 w-6" />
                  </TableCell>
                  <TableCell className="pr-4" />
                </TableRow>
              ))
            ) : !data?.items.length ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLS} className="p-0">
                  <EmptyState
                    icon={RiUserSearchLine}
                    title={
                      anyFilter
                        ? 'Hech kim topilmadi'
                        : "Hali ishtirokchilar yo'q"
                    }
                    description={
                      anyFilter
                        ? "Qidiruv yoki filtrlarni o'zgartirib ko'ring."
                        : "Botda ro'yxatdan o'tganlar shu yerda ko'rinadi."
                    }
                    action={
                      anyFilter ? (
                        <Button variant="outline" size="sm" onClick={reset}>
                          Filtrlarni tozalash
                        </Button>
                      ) : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((p) => {
                const name = fullName(p);
                return (
                  <TableRow
                    key={p.id}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => open(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') open(p.id);
                    }}
                  >
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback
                            className={cn(
                              'text-xs font-medium',
                              p.isBlocked
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-primary/10 text-primary',
                            )}
                          >
                            {initials(p)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0 gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'truncate font-medium',
                                !name && 'tabular-nums',
                              )}
                            >
                              {name ||
                                (p.phone ? fmtPhone(p.phone) : `#${p.id}`)}
                            </span>
                            {p.isStaff && (
                              <Badge
                                variant="secondary"
                                className="h-4.5 px-1.5 text-[11px] font-normal"
                              >
                                xodim
                              </Badge>
                            )}
                            {p.isBlocked && (
                              <Badge
                                variant="destructive"
                                className="h-4.5 px-1.5 text-[11px] font-normal"
                              >
                                bloklangan
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {name
                              ? p.phone
                                ? fmtPhone(p.phone)
                                : "kontakt yo'q"
                              : `#${p.id}`}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        {p.username ? (
                          <span className="text-muted-foreground">
                            @{p.username}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                        {p.source && (
                          <Badge
                            variant="outline"
                            className="h-4.5 px-1.5 text-[11px] font-normal text-muted-foreground"
                          >
                            {p.source}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {p.rulesAcceptedAt ? (
                        fmtShort(p.rulesAcceptedAt)
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Dot className="bg-amber-500" />
                          tugallanmagan
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        !p._count.receipts && 'text-muted-foreground',
                      )}
                    >
                      {p._count.receipts}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-semibold tabular-nums',
                        !p._count.coupons &&
                          'font-normal text-muted-foreground',
                      )}
                    >
                      {p._count.coupons}
                    </TableCell>
                    <TableCell
                      className="pr-4 text-right"
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
                              className="text-muted-foreground"
                            />
                          }
                        >
                          <RiMore2Fill />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => open(p.id)}>
                            <RiArrowRightUpLine />
                            Ochish
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
    </>
  );
}

export default function ParticipantsPage() {
  return (
    <PageContainer size="wide">
      <Suspense>
        <ParticipantsTable />
      </Suspense>
    </PageContainer>
  );
}
