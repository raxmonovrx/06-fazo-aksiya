'use client';

import { RiAlertLine, RiCloseCircleLine, RiTicket2Line } from '@remixicon/react';
import { useState } from 'react';
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
import { ErrorAlert, StatCard, useLoad } from '@/components/admin/kit';
import { EmptyState, PageContainer, PageIntro } from '@/components/admin/layout';
import { VoucherStatusBadge, type VoucherRow } from '@/components/admin/voucher-status';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminApi, qs } from '@/lib/api';
import { fmtPhone, fmtShort, fmtSum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { can, useAdmin } from '../admin-context';

interface Page {
  total: number;
  page: number;
  pageSize: number;
  summary: Partial<Record<'ISSUED' | 'REDEEMED' | 'CANCELLED', { count: number; amount: number; coupons: number }>>;
  items: VoucherRow[];
}

const STATUS_OPTIONS = [
  { value: 'ISSUED', label: 'Kutilmoqda' },
  { value: 'REDEEMED', label: 'Skanerlandi' },
  { value: 'CANCELLED', label: 'Bekor qilingan' },
];

export default function VouchersPage() {
  const me = useAdmin();
  const canCancel = can(me, 'vouchers.cancel');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [flagged, setFlagged] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [cancelling, setCancelling] = useState<VoucherRow | null>(null);
  const [reason, setReason] = useState('');
  const dq = useDebounced(q.trim());

  const branches = useLoad(() => adminApi<Array<{ id: number; name: string }>>('/branches'), []);
  const { data, error, loading, reload } = useLoad(
    () =>
      adminApi<Page>(
        `/vouchers${qs({
          q: dq,
          status,
          branchId,
          from: range.from && `${range.from}T00:00:00+05:00`,
          to: range.to && `${range.to}T23:59:59+05:00`,
          flagged: flagged ? 'true' : '',
          page,
          pageSize,
        })}`,
      ),
    [dq, status, branchId, range, flagged, page, pageSize],
  );

  const anyFilter = Boolean(q || status || branchId || range.from || range.to || flagged);
  const reset = () => {
    setQ('');
    setStatus('');
    setBranchId('');
    setRange({ from: '', to: '' });
    setFlagged(false);
    setPage(1);
  };
  const s = data?.summary ?? {};
  const issuedTotal = (s.ISSUED?.count ?? 0) + (s.REDEEMED?.count ?? 0) + (s.CANCELLED?.count ?? 0);

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await adminApi(`/vouchers/${cancelling.id}/cancel`, { method: 'POST', json: { reason } });
      toast.success(`QR #${cancelling.id} bekor qilindi`);
      setCancelling(null);
      setReason('');
      void reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <PageContainer>
      <PageIntro description="Kassalar chiqargan QR'lar: kim chiqardi, kim skanerladi va qaysi raqam bilan." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Chiqarilgan" value={issuedTotal} />
        <StatCard label="Skanerlangan" value={s.REDEEMED?.count ?? 0} />
        <StatCard label="Berilgan kupon" value={s.REDEEMED?.coupons ?? 0} />
        <StatCard label="Skanerlangan summa" value={fmtSum(s.REDEEMED?.amount ?? 0)} />
      </div>

      <DataTableToolbar>
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder="#, telefon yoki ism"
        />
        <FacetFilter title="Holat" value={status} onChange={(v) => (setStatus(v), setPage(1))} options={STATUS_OPTIONS} />
        {!me.branch && (
        <FacetFilter
          title="Filial"
          value={branchId}
          onChange={(v) => (setBranchId(v), setPage(1))}
          options={(branches.data ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
        />
        )}
        <DateRangeFilter from={range.from} to={range.to} onChange={(r) => (setRange(r), setPage(1))} />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={flagged} onCheckedChange={(v) => (setFlagged(Boolean(v)), setPage(1))} />
          <RiAlertLine className="size-4 text-amber-600" /> Faqat shubhali
        </label>
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
              onPageSize={(n) => (setPageSize(n), setPage(1))}
              noun="ta QR"
            />
          ) : undefined
        }
      >
        {!data && loading ? (
          <p className="p-6 text-sm text-muted-foreground">Yuklanmoqda…</p>
        ) : data?.items.length === 0 ? (
          <EmptyState icon={RiTicket2Line} title="QR topilmadi" description={anyFilter ? "Filtrlarni o'zgartirib ko'ring" : "Kassalar hali QR chiqarmagan"} />
        ) : (
          <Table className={cn(loading && 'opacity-60')}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">#</TableHead>
                <TableHead>Chiqarilgan</TableHead>
                <TableHead>Kassa</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead className="text-right">Kupon</TableHead>
                <TableHead>Mijoz (kassir yozgan)</TableHead>
                <TableHead>Kim skanerladi</TableHead>
                <TableHead>Holat</TableHead>
                {canCancel && <TableHead className="pr-4" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((v) => (
                <TableRow key={v.id} className={cn((v.phoneMismatch || v.redeemedByStaff) && 'bg-amber-500/5')}>
                  <TableCell className="pl-4 text-muted-foreground">#{v.id}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{fmtShort(v.issuedAt)}</TableCell>
                  <TableCell>
                    {v.issuedBy.login}
                    <div className="text-xs text-muted-foreground">
                      {v.branch.name}
                      {v.terminal && ` · ${v.terminal.name}`}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtSum(v.amount)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{v.couponsCount}</TableCell>
                  <TableCell>
                    {v.customerName || '—'}
                    {v.customerPhone && <div className="text-xs text-muted-foreground">{fmtPhone(v.customerPhone)}</div>}
                  </TableCell>
                  <TableCell>
                    {v.status === 'REDEEMED' ? (
                      <>
                        {v.redeemedName || '—'}
                        <div className="text-xs text-muted-foreground">
                          {fmtPhone(v.redeemedPhone)} · tg {v.redeemedTgId}
                        </div>
                        {v.redeemedAt && <div className="text-xs text-muted-foreground">{fmtShort(v.redeemedAt)}</div>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <VoucherStatusBadge v={v} detail={v.status !== 'REDEEMED'} />
                    {(v.phoneMismatch || v.redeemedByStaff) && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <RiAlertLine className="size-3" />
                        {v.redeemedByStaff ? 'Xodim skanerlagan' : 'Boshqa raqam'}
                      </div>
                    )}
                  </TableCell>
                  {canCancel && (
                    <TableCell className="pr-4 text-right">
                      {v.status === 'ISSUED' && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling(v)}>
                          <RiCloseCircleLine /> Bekor
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableCard>

      <Dialog open={cancelling !== null} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR #{cancelling?.id} ni bekor qilish</DialogTitle>
            <DialogDescription>Bekor qilingan QR skanerlansa, kupon berilmaydi.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reason">Sabab</FieldLabel>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Yopish
            </Button>
            <Button variant="destructive" disabled={reason.trim().length < 2} onClick={confirmCancel}>
              Bekor qilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
