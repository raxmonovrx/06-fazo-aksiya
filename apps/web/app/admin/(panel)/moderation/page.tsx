'use client';

import {
  RiCamera3Line,
  RiCheckDoubleLine,
  RiEditBoxLine,
  RiInboxLine,
  RiLoader4Line,
  RiQrCodeLine,
  RiRefreshLine,
  RiSearchLine,
} from '@remixicon/react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { ErrorAlert, STATUS_DOT, useLoad } from '@/components/admin/kit';
import {
  FacetFilter,
  ResetFilters,
  SearchInput,
  useDebounced,
} from '@/components/admin/data-table';
import { Dot, EmptyState, PageContainer } from '@/components/admin/layout';
import {
  ReceiptReview,
  type BranchRule,
  type ResolvedReceipt,
} from '@/components/receipt-review';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { adminApi, qs } from '@/lib/api';
import { fmtPhone, fmtShort, fmtSum, STATUS } from '@/lib/format';
import { cn } from '@/lib/utils';

/*
 * Moderatsiya — moderator ish stoli (Linear triage uslubida): chapda
 * navbat, o'ngda tanlangan chekni ko'rib chiqish. Navbat: rasm orqali
 * kelgan, noma'lum FM, iiko'da topilmagan yoki shubhali cheklar.
 */

// Navbatga kiradigan statuslar (avvalgi ReceiptsTable lockStatus bilan bir xil)
const QUEUE_STATUS = 'NEEDS_REVIEW,NOT_FOUND';
const PAGE_SIZE = 50;

interface QueueItem {
  id: number;
  status: string;
  source: string;
  amount: string | null;
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
  items: QueueItem[];
}

/* lg (1024px) va undan keng — ikki panelli ko'rinish */
const LG = '(min-width: 1024px)';
function subscribeLg(cb: () => void) {
  const m = window.matchMedia(LG);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeLg,
    () => window.matchMedia(LG).matches,
    () => true,
  );
}

/** "5 daq", "2 soat", "3 kun" — bir haftadan eskisi sana bilan */
function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'hozir';
  if (s < 3600) return `${Math.floor(s / 60)} daq`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} kun`;
  return fmtShort(iso).split(' ')[0]!;
}

/** Qidiruv: 9+ raqamli telefon → `phone`, qolgani (chek №, FM, ID) → `q` */
function splitSearch(v: string) {
  const s = v.trim();
  if (!s) return { phone: '', q: '' };
  const digits = s.replace(/\D/g, '');
  const phoneLike = /^\+?[\d\s()-]+$/.test(s) && digits.length >= 9;
  return phoneLike ? { phone: digits, q: '' } : { phone: '', q: s };
}

const SOURCE_ICON: Record<string, typeof RiQrCodeLine> = {
  QR: RiQrCodeLine,
  PHOTO: RiCamera3Line,
  MANUAL: RiEditBoxLine,
};

export default function ModerationPage() {
  return (
    <Suspense fallback={null}>
      <Workbench />
    </Suspense>
  );
}

function Workbench() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isDesktop = useIsDesktop();

  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const anyFilter = !!(q || branchId || status);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const branches = useLoad(() => adminApi<BranchRule[]>('/branches'), []);

  const selectedParam = params.get('id');
  const selected = selectedParam ? Number(selectedParam) : null;

  const select = useCallback(
    (id: number | null) => {
      const next = new URLSearchParams(params.toString());
      if (id === null) next.delete('id');
      else next.set('id', String(id));
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const fetchPage = useCallback(
    async (p: number) => {
      const { phone, q: query } = splitSearch(dq);
      return adminApi<Page>(
        `/receipts${qs({
          status: status || QUEUE_STATUS,
          branchId,
          phone,
          q: query,
          page: p,
          pageSize: PAGE_SIZE,
        })}`,
      );
    },
    [dq, branchId, status],
  );

  const load = useCallback(async () => {
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPage(1);
      if (my !== reqId.current) return;
      setItems(res.items);
      setTotal(res.total);
      setPage(1);
    } catch (e) {
      if (my === reqId.current) setError((e as Error).message);
    } finally {
      if (my === reqId.current) setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetchPage(page + 1);
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setTotal(res.total);
      setPage(page + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  // Katta ekranda hech narsa tanlanmagan bo'lsa — navbatdagi birinchisi
  useEffect(() => {
    if (isDesktop && !loading && selected === null && items.length > 0)
      select(items[0]!.id);
  }, [isDesktop, loading, selected, items, select]);

  // Klaviatura: ↑/↓ yoki J/K — navbat bo'ylab
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) ||
          t.closest(
            '[role=dialog],[role=alertdialog],[role=listbox]:not([data-queue]),[role=menu]',
          ))
      )
        return;
      const down = e.key === 'ArrowDown' || e.key === 'j';
      const up = e.key === 'ArrowUp' || e.key === 'k';
      if (!down && !up) return;
      if (!items.length) return;
      e.preventDefault();
      const idx = items.findIndex((i) => i.id === selected);
      const next =
        idx === -1
          ? 0
          : Math.min(items.length - 1, Math.max(0, idx + (down ? 1 : -1)));
      select(items[next]!.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, selected, select]);

  // Tanlangan element ko'rinib tursin
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected === null) return;
    listRef.current
      ?.querySelector(`[data-id="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected, items]);

  const onResolved = (r: ResolvedReceipt) => {
    const idx = items.findIndex((i) => i.id === r.id);
    const rest = items.filter((i) => i.id !== r.id);
    setItems(rest);
    if (idx !== -1) setTotal((t) => Math.max(0, t - 1));
    const next = rest[idx] ?? rest[idx - 1] ?? null;
    select(next?.id ?? null);
    // Ro'yxat tugadi, lekin serverda yana bor — keyingi qismni olamiz
    if (rest.length === 0 && total - 1 > 0) void load();
  };

  const resetFilters = () => {
    setQ('');
    setBranchId('');
    setStatus('');
  };

  const branchOptions = (branches.data ?? []).map((b) => ({
    value: String(b.id),
    label: b.name,
  }));
  const statusOptions = QUEUE_STATUS.split(',').map((s) => ({
    value: s,
    label: STATUS[s]?.label ?? s,
    icon: <Dot className={STATUS_DOT[s]} />,
  }));

  const queueEmpty = !loading && !error && total === 0 && !anyFilter;

  const heightCls =
    'h-[calc(100dvh-var(--header-height)-5rem)] min-h-[520px] md:h-[calc(100dvh-var(--header-height)-6rem)]';

  if (queueEmpty) {
    return (
      <PageContainer size="wide">
        <div
          className={cn(
            'grid place-items-center rounded-xl border bg-card',
            heightCls,
          )}
        >
          <EmptyState
            icon={RiCheckDoubleLine}
            title="Navbat bo'sh — barcha cheklar ko'rib chiqilgan"
            description="Yangi shubhali yoki rasm orqali kelgan cheklar shu yerda paydo bo'ladi."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => load()}>
                  <RiRefreshLine data-icon="inline-start" />
                  Yangilash
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/admin/receipts" />}
                >
                  Barcha cheklar
                </Button>
              </div>
            }
          />
        </div>
      </PageContainer>
    );
  }

  const list = (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-card lg:h-full lg:min-h-0',
      )}
    >
      {/* Navbat sarlavhasi va filtrlar */}
      <div className="flex flex-col gap-2.5 border-b p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Navbat</span>
          <Badge variant="secondary" className="tabular-nums">
            {loading ? '…' : total}
          </Badge>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label="Yangilash"
                  onClick={() => load()}
                />
              }
            >
              <RiRefreshLine className={cn(loading && 'animate-spin')} />
            </TooltipTrigger>
            <TooltipContent>Yangilash</TooltipContent>
          </Tooltip>
        </div>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Telefon, chek № yoki FM"
          className="sm:w-full"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FacetFilter
            title="Filial"
            value={branchId}
            onChange={setBranchId}
            options={branchOptions}
          />
          <FacetFilter
            title="Holat"
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
          <ResetFilters show={anyFilter} onReset={resetFilters} />
        </div>
      </div>

      {/* Ro'yxat */}
      <div
        ref={listRef}
        role="listbox"
        data-queue
        aria-label="Moderatsiya navbati"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {error && (
          <div className="p-3">
            <ErrorAlert error={error} />
          </div>
        )}
        {loading && items.length === 0 ? (
          <QueueSkeleton />
        ) : items.length === 0 && !error ? (
          <EmptyState
            icon={anyFilter ? RiSearchLine : RiInboxLine}
            title="Mos chek topilmadi"
            description="Filtrlarni o'zgartiring yoki tozalang."
            action={
              anyFilter && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Filtrlarni tozalash
                </Button>
              )
            }
          />
        ) : (
          <div className={cn(loading && 'opacity-60 transition-opacity')}>
            {items.map((it) => (
              <QueueRow
                key={it.id}
                item={it}
                active={it.id === selected}
                onSelect={() => select(it.id)}
              />
            ))}
            {items.length < total && (
              <div className="p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore && (
                    <RiLoader4Line
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  )}
                  Yana yuklash ({total - items.length})
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="hidden items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground lg:flex">
        <span className="tabular-nums">
          {items.length} / {total}
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span className="ml-1">navbat bo&apos;ylab</span>
        </span>
      </div>
    </section>
  );

  const reviewTarget = selected;

  return (
    <PageContainer size="wide">
      <div
        className={cn(
          'grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]',
          isDesktop && heightCls,
        )}
      >
        {list}

        {isDesktop && (
          <div className="-m-1 min-h-0 overflow-y-auto p-1 [scrollbar-gutter:stable]">
            {reviewTarget !== null ? (
              <ReceiptReview
                id={reviewTarget}
                variant="pane"
                branches={branches.data}
                onResolved={onResolved}
              />
            ) : loading ? (
              <Skeleton className="h-full rounded-xl" />
            ) : (
              <div className="grid h-full place-items-center rounded-xl border border-dashed">
                <EmptyState
                  icon={RiInboxLine}
                  title="Chekni tanlang"
                  description="Chapdagi navbatdan chekni tanlang."
                />
              </div>
            )}
          </div>
        )}
      </div>

      {!isDesktop && (
        <Sheet
          open={reviewTarget !== null}
          onOpenChange={(o) => !o && select(null)}
        >
          <SheetContent
            side="right"
            className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
          >
            <SheetHeader className="border-b pr-12">
              <SheetTitle>Chek #{reviewTarget}</SheetTitle>
              <SheetDescription>
                {total > 0 ? `Navbatda ${total} ta chek` : 'Navbat'}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {reviewTarget !== null && (
                <ReceiptReview
                  id={reviewTarget}
                  variant="pane"
                  branches={branches.data}
                  onResolved={onResolved}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </PageContainer>
  );
}

function QueueRow({
  item: it,
  active,
  onSelect,
}: {
  item: QueueItem;
  active: boolean;
  onSelect: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const name = [it.participant.firstName, it.participant.lastName]
    .filter(Boolean)
    .join(' ');
  const SrcIcon = SOURCE_ICON[it.source] ?? RiQrCodeLine;
  return (
    <div
      role="option"
      aria-selected={active}
      tabIndex={0}
      data-id={it.id}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'relative flex cursor-pointer gap-3 border-b px-3 py-2.5 outline-none last:border-b-0 hover:bg-muted/50 focus-visible:bg-muted/60',
        active &&
          'bg-primary/[0.06] hover:bg-primary/[0.08] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary',
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
        {it.photoFileId && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/admin/photos/${it.photoFileId}`}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <SrcIcon className="size-4" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium tabular-nums">
            {fmtPhone(it.participant.phone)}
          </span>
          <span
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
            title={fmtShort(it.createdAt)}
          >
            {ago(it.createdAt)}
          </span>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {name || "Ism yo'q"}
          {' · '}
          {it.branch?.name ?? "Filial yo'q"}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs">
          <Dot className={STATUS_DOT[it.status] ?? 'bg-muted-foreground'} />
          <span className="truncate text-foreground/80">
            {it.rejectReason ?? STATUS[it.status]?.label ?? it.status}
          </span>
          {it.amount && (
            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
              {fmtSum(it.amount)}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded border bg-muted px-1 font-sans text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function QueueSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex gap-3 border-b px-3 py-2.5">
          <Skeleton className="size-11 rounded-md" />
          <div className="flex flex-1 flex-col gap-1.5 py-0.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
