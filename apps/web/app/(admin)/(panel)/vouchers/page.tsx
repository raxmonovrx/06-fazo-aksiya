'use client';

import { RiAlertLine, RiArrowGoBackLine, RiCloseCircleLine, RiForbidLine, RiMore2Fill, RiTicket2Line } from '@remixicon/react';
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  summary: Partial<Record<'ISSUED' | 'REDEEMED' | 'CANCELLED' | 'REVOKED', { count: number; amount: number; coupons: number }>>;
  items: VoucherRow[];
}

const STATUS_OPTIONS = [
  { value: 'ISSUED', label: 'Kutilmoqda' },
  { value: 'REDEEMED', label: 'Skanerlandi' },
  { value: 'REVOKED', label: 'Kuponlari olib tashlangan' },
  { value: 'CANCELLED', label: 'Bekor qilingan' },
];

export default function VouchersPage() {
  const me = useAdmin();
  const canCancel = can(me, 'vouchers.cancel');
  const canRevoke = can(me, 'vouchers.revoke');
  const canBlock = can(me, 'participants.edit');
  const showActions = canCancel || canRevoke || canBlock;
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [branchId, setBranchId] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [flagged, setFlagged] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  // Sabab so'raladigan amal: skanerlanmagan QR'ni bekor qilish yoki skanerlanganning kuponlarini qaytarib olish
  const [cancelling, setCancelling] = useState<{ kind: 'cancel' | 'revoke'; v: VoucherRow } | null>(null);
  const [blocking, setBlocking] = useState<VoucherRow | null>(null);
  const [busy, setBusy] = useState(false);
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

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      void reload();
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    const { kind, v } = cancelling;
    const ok = await run(
      () => adminApi(`/vouchers/${v.id}/${kind === 'revoke' ? 'revoke' : 'cancel'}`, { method: 'POST', json: { reason } }),
      kind === 'revoke' ? `QR #${v.id}: ${v.couponsCount} kupon o'yindan chiqarildi` : `QR #${v.id} bekor qilindi`,
    );
    if (ok) {
      setCancelling(null);
      setReason('');
    }
  };

  const restore = (v: VoucherRow) =>
    run(() => adminApi(`/vouchers/${v.id}/restore`, { method: 'POST' }), `QR #${v.id}: kuponlar qaytarildi`);

  const confirmBlock = async () => {
    const v = blocking;
    if (!v?.redeemedBy) return;
    const ok = await run(
      () => adminApi(`/participants/${v.redeemedBy!.id}`, { method: 'PATCH', json: { isBlocked: true } }),
      `${fmtPhone(v.redeemedBy.phone)} bloklandi, kuponlari o'yindan chiqdi`,
    );
    if (ok) setBlocking(null);
  };

  return (
    <PageContainer>
      <PageIntro description="Kassalar chiqargan QR'lar: kim chiqardi, kassada qaysi raqam aytildi va botda kim skanerladi." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Chiqarilgan" value={issuedTotal} />
        <StatCard
          label="Skanerlangan"
          value={s.REDEEMED?.count ?? 0}
          sub={s.REVOKED?.count ? `kuponi olib tashlangan: ${s.REVOKED.count}` : undefined}
        />
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
          <RiAlertLine className="size-4 text-amber-600" /> Faqat xodim skanerlagan
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
                <TableHead>Kassada aytgan</TableHead>
                <TableHead>Botda (skanerlagan)</TableHead>
                <TableHead>Holat</TableHead>
                {showActions && <TableHead className="pr-4" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((v) => (
                <TableRow key={v.id} className={cn(v.redeemedByStaff && 'bg-amber-500/5', v.revokedAt && 'bg-red-500/5 text-muted-foreground')}>
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
                        {v.redeemedBy?.isBlocked && (
                          <Badge variant="destructive" className="mt-1 h-4.5 px-1.5 text-[11px] font-normal">
                            bloklangan
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <VoucherStatusBadge v={v} detail={v.status !== 'REDEEMED' || Boolean(v.revokedAt)} />
                    {v.redeemedByStaff && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <RiAlertLine className="size-3" />
                        Xodim skanerlagan
                      </div>
                    )}
                  </TableCell>
                  {showActions && (
                    <TableCell className="pr-4 text-right">
                      {v.status === 'ISSUED' && canCancel && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling({ kind: 'cancel', v })}>
                          <RiCloseCircleLine /> Bekor
                        </Button>
                      )}
                      {v.status === 'REDEEMED' && v.revokedAt && canRevoke && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void restore(v)}>
                          <RiArrowGoBackLine /> Tiklash
                        </Button>
                      )}
                      {v.status === 'REDEEMED' && !v.revokedAt && (canRevoke || (canBlock && v.redeemedBy && !v.redeemedBy.isBlocked)) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`QR #${v.id} amallari`} />}>
                            <RiMore2Fill />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            {canRevoke && (
                              <DropdownMenuItem variant="destructive" onClick={() => setCancelling({ kind: 'revoke', v })}>
                                <RiCloseCircleLine />
                                Kuponlarni bekor qilish
                              </DropdownMenuItem>
                            )}
                            {canRevoke && canBlock && v.redeemedBy && !v.redeemedBy.isBlocked && <DropdownMenuSeparator />}
                            {canBlock && v.redeemedBy && !v.redeemedBy.isBlocked && (
                              <DropdownMenuItem variant="destructive" onClick={() => setBlocking(v)}>
                                <RiForbidLine />
                                Skanerlagan odamni bloklash
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableCard>

      <Dialog
        open={cancelling !== null}
        onOpenChange={(o) => {
          if (!o) {
            setCancelling(null);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cancelling?.kind === 'revoke' ? `QR #${cancelling.v.id} kuponlarini bekor qilish` : `QR #${cancelling?.v.id} ni bekor qilish`}
            </DialogTitle>
            <DialogDescription>
              {cancelling?.kind === 'revoke'
                ? `${cancelling.v.couponsCount} ta kupon o'yindan chiqariladi (${fmtPhone(cancelling.v.redeemedPhone)}). Yozuv va sabab saqlanadi, keyin "Tiklash" bilan qaytarish mumkin. Admin guruhiga xabar boradi.`
                : 'Bekor qilingan QR skanerlansa, kupon berilmaydi.'}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reason">Sabab</FieldLabel>
            <Input
              id="reason"
              autoFocus
              placeholder={cancelling?.kind === 'revoke' ? "Masalan: xodim o'ziga chiqargan" : "Masalan: summa noto'g'ri kiritildi"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Yopish
            </Button>
            <Button variant="destructive" disabled={busy || reason.trim().length < 2} onClick={() => void confirmCancel()}>
              {cancelling?.kind === 'revoke' ? 'Kuponlarni bekor qilish' : 'Bekor qilish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={blocking !== null} onOpenChange={(o) => !o && setBlocking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{blocking && fmtPhone(blocking.redeemedPhone)} bloklansinmi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu odamning barcha kuponlari o&apos;yindan chiqadi va u yangi QR skanerlay olmaydi. Blokni ishtirokchi sahifasidan olib tashlash mumkin,
              shunda kuponlar qaytadi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => void confirmBlock()}>
              Bloklash
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
