'use client';

import {
  RiAddLine,
  RiCloseCircleLine,
  RiLoader4Line,
  RiPrinterLine,
  RiQrCodeLine,
} from '@remixicon/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ErrorAlert, useLoad } from '@/components/admin/kit';
import { PageContainer } from '@/components/admin/layout';
import { VoucherStatusBadge, type VoucherRow } from '@/components/admin/voucher-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminApi, qs } from '@/lib/api';
import { fmtPhone, fmtShort, fmtSum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { printVoucher, type PaperWidth, type PrintableVoucher } from '@/lib/voucher-print';
import { useAdmin, type AdminBranch } from '../admin-context';

interface Issued extends PrintableVoucher {
  link: string;
  customerName: string | null;
  customerPhone: string | null;
}

const onlyDigits = (s: string) => s.replace(/\D/g, '');
const groupDigits = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Kupon soni — serverdagi formula bilan bir xil (oldindan ko'rsatish uchun) */
function couponsFor(sum: number, b: Pick<AdminBranch, 'minSum' | 'couponPrice' | 'maxPerReceipt'> | null) {
  if (!b || !sum || sum < b.minSum || b.couponPrice <= 0) return 0;
  return Math.min(Math.max(1, Math.floor(sum / b.couponPrice)), b.maxPerReceipt);
}

/** Bugun 00:00 (Toshkent) — ro'yxat filtri uchun */
function todayStartIso() {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  return `${ymd}T00:00:00+05:00`;
}

const readPref = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const writePref = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* saqlanmasa ham ishlayveradi */
  }
};

export default function CashierPage() {
  const me = useAdmin();
  const isCashier = me.role === 'CASHIER';
  const amountRef = useRef<HTMLInputElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [branchId, setBranchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<Issued | null>(null);
  const [paper, setPaper] = useState<PaperWidth>(80);
  const [autoPrint, setAutoPrint] = useState(false);
  const [cancelling, setCancelling] = useState<VoucherRow | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    setPaper(readPref<PaperWidth>('fc.paper', 80));
    setAutoPrint(readPref('fc.autoPrint', false));
  }, []);

  const branches = useLoad(
    () => (isCashier ? Promise.resolve([] as AdminBranch[]) : adminApi<AdminBranch[]>('/branches')),
    [isCashier],
  );
  const branch: AdminBranch | null = isCashier
    ? me.branch
    : (branches.data?.find((b) => String(b.id) === branchId) ?? null);
  const branchRule = branch && { ...branch, minSum: Number(branch.minSum), couponPrice: Number(branch.couponPrice) };

  const today = useLoad(
    () => adminApi<{ items: VoucherRow[] }>(`/vouchers${qs({ from: todayStartIso(), pageSize: 100 })}`),
    [],
  );

  const sum = Number(onlyDigits(amount) || 0);
  const coupons = useMemo(() => couponsFor(sum, branchRule), [sum, branchRule]);
  const belowMin = Boolean(sum && branchRule && sum < branchRule.minSum);

  const reset = useCallback(() => {
    setAmount('');
    setPhone('');
    setName('');
    setError(null);
    setCurrent(null);
    setTimeout(() => amountRef.current?.focus(), 0);
  }, []);

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupons || busy) return;
    setBusy(true);
    setError(null);
    try {
      const v = await adminApi<Issued>('/vouchers', {
        method: 'POST',
        json: {
          amount: sum,
          ...(!isCashier && { branchId: Number(branchId) }),
          ...(phone.trim() && { customerPhone: phone }),
          ...(name.trim() && { customerName: name }),
        },
      });
      setCurrent(v);
      toast.success(`QR #${v.id} tayyor — ${v.couponsCount} kupon`);
      // Telefonda (Sunmi) QR formadan pastda — mijoz skanerlashi uchun ko'rinishga suramiz
      setTimeout(() => qrRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      if (autoPrint) printVoucher(v, paper);
      void today.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reprint = async (row: VoucherRow) => {
    try {
      const v = await adminApi<Issued>(`/vouchers/${row.id}/reprint`, { method: 'POST' });
      setCurrent(v);
      printVoucher(v, paper);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await adminApi(`/vouchers/${cancelling.id}/cancel`, { method: 'POST', json: { reason } });
      toast.success(`QR #${cancelling.id} bekor qilindi`);
      if (current?.id === cancelling.id) setCurrent(null);
      setCancelling(null);
      setReason('');
      void today.reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const setPaperPref = (v: PaperWidth) => {
    setPaper(v);
    writePref('fc.paper', v);
  };

  return (
    <PageContainer>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Yangi QR</CardTitle>
            <CardDescription>
              {isCashier
                ? me.branch
                  ? `${me.branch.name} · kupon: har ${fmtSum(me.branch.couponPrice)}, kamida ${fmtSum(me.branch.minSum)}`
                  : "Sizga filial biriktirilmagan — adminga murojaat qiling"
                : 'Summani kiriting — QR mijoz uchun chiqadi'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={issue}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="amount">Chek summasi (so&apos;m)</FieldLabel>
                  <Input
                    id="amount"
                    ref={amountRef}
                    autoFocus
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    className="h-14 text-3xl font-semibold tabular-nums md:text-3xl"
                    value={groupDigits(onlyDigits(amount))}
                    onChange={(e) => setAmount(onlyDigits(e.target.value).slice(0, 10))}
                  />
                  <FieldDescription className={cn(belowMin && 'text-destructive')}>
                    {!branchRule
                      ? 'Filialni tanlang'
                      : belowMin
                        ? `Summa kam — kupon uchun kamida ${fmtSum(branchRule.minSum)}`
                        : coupons
                          ? `${coupons} ta kupon beriladi`
                          : ' '}
                  </FieldDescription>
                </Field>

                {!isCashier && (
                  <Field>
                    <FieldLabel>Filial</FieldLabel>
                    <Select
                      items={(branches.data ?? []).filter((b) => b).map((b) => ({ value: String(b.id), label: b.name }))}
                      value={branchId || null}
                      onValueChange={(v) => setBranchId((v as string | null) ?? '')}
                    >
                      <SelectTrigger className="h-10! w-full">
                        <SelectValue placeholder="Filialni tanlang" />
                      </SelectTrigger>
                      <SelectContent>
                        {(branches.data ?? []).map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="phone">Mijoz telefoni</FieldLabel>
                    <Input
                      id="phone"
                      inputMode="tel"
                      autoComplete="off"
                      placeholder="+998 90 123 45 67"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="name">Ism familiya</FieldLabel>
                    <Input id="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                </div>

                <ErrorAlert error={error} />

                <Button type="submit" size="lg" className="h-12 text-base" disabled={busy || !coupons}>
                  {busy ? <RiLoader4Line className="animate-spin" /> : <RiQrCodeLine />}
                  QR yaratish
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="min-h-[420px]" ref={qrRef}>
          <CardHeader>
            <CardTitle>QR</CardTitle>
            <CardDescription>Mijoz telefon kamerasi bilan skanerlaydi — bot ochiladi va kuponlar qo&apos;shiladi</CardDescription>
          </CardHeader>
          <CardContent>
            {current ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <div
                  className="w-full max-w-[300px] rounded-xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
                  // Server yaratgan SVG (qrcode kutubxonasi) — tashqi kiritma emas
                  dangerouslySetInnerHTML={{ __html: current.qrSvg }}
                />
                <div>
                  <p className="text-3xl font-bold tabular-nums">{current.couponsCount} kupon</p>
                  <p className="text-sm text-muted-foreground">
                    {current.branchName} · {fmtSum(current.amount)} · #{current.id}
                  </p>
                  <p className="text-xs text-muted-foreground">Amal qiladi: {fmtShort(current.expiresAt)} gacha · bir martalik</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="lg" onClick={() => printVoucher(current, paper)}>
                    <RiPrinterLine /> Chop etish
                  </Button>
                  <Button size="lg" variant="outline" onClick={reset}>
                    <RiAddLine /> Yangi QR
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <RiQrCodeLine className="size-10 opacity-40" />
                Summani kiritib, «QR yaratish»ni bosing
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Printer:</span>
                {([58, 80] as const).map((w) => (
                  <Button key={w} size="sm" variant={paper === w ? 'secondary' : 'ghost'} onClick={() => setPaperPref(w)}>
                    {w} mm
                  </Button>
                ))}
              </div>
              <label className="flex items-center gap-2">
                <Switch
                  checked={autoPrint}
                  onCheckedChange={(v) => {
                    setAutoPrint(Boolean(v));
                    writePref('fc.autoPrint', Boolean(v));
                  }}
                />
                Yaratilganda darhol chop etish
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bugungi QR&apos;lar</CardTitle>
          <CardDescription>{isCashier ? 'Siz chiqargan' : 'Barcha kassalar'} · skanerlanmaganini qayta chop etish yoki bekor qilish mumkin</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">#</TableHead>
                <TableHead>Vaqt</TableHead>
                {!isCashier && <TableHead>Kassa</TableHead>}
                <TableHead className="text-right">Summa</TableHead>
                <TableHead className="text-right">Kupon</TableHead>
                <TableHead>Mijoz</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead className="pr-6 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {today.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Bugun hali QR chiqarilmagan
                  </TableCell>
                </TableRow>
              )}
              {today.data?.items.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="pl-6 text-muted-foreground">#{v.id}</TableCell>
                  <TableCell className="tabular-nums">{fmtShort(v.issuedAt).split(' ')[1]}</TableCell>
                  {!isCashier && (
                    <TableCell>
                      {v.issuedBy.login}
                      <div className="text-xs text-muted-foreground">{v.branch.name}</div>
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{fmtSum(v.amount)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{v.couponsCount}</TableCell>
                  <TableCell>
                    {v.customerName || '—'}
                    {v.customerPhone && <div className="text-xs text-muted-foreground">{fmtPhone(v.customerPhone)}</div>}
                  </TableCell>
                  <TableCell>
                    <VoucherStatusBadge v={v} />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {v.status === 'ISSUED' && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => reprint(v)}>
                          <RiPrinterLine /> Qayta
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelling(v)}>
                          <RiCloseCircleLine /> Bekor
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={cancelling !== null} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR #{cancelling?.id} ni bekor qilish</DialogTitle>
            <DialogDescription>Bekor qilingan QR skanerlansa, kupon berilmaydi.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reason">Sabab</FieldLabel>
            <Input id="reason" placeholder="Masalan: summa noto'g'ri kiritildi" value={reason} onChange={(e) => setReason(e.target.value)} />
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
