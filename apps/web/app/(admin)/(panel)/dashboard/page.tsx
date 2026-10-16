'use client';

import { RiArrowRightLine, RiCoupon3Line, RiGroupLine, RiInboxLine, RiQrCodeLine, RiStore2Line, RiTimeLine } from '@remixicon/react';
import Link from 'next/link';

import { DataTableCard } from '@/components/admin/data-table';
import { ErrorAlert, StatCard, useLoad } from '@/components/admin/kit';
import { Dot, EmptyState, PageContainer } from '@/components/admin/layout';
import { VoucherStatusBadge, type VoucherRow } from '@/components/admin/voucher-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminApi } from '@/lib/api';
import { fmtPhone, fmtShort, fmtSum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { can, useAdmin } from '../admin-context';

type VoucherState = 'ISSUED' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED' | 'REVOKED';

interface Dashboard {
  participants: { total: number; today: number; staff: number };
  coupons: { eligible: number; today: number; referral: number };
  vouchers: { issuedToday: number; redeemedToday: number; byState: Partial<Record<VoucherState, number>> };
  branches: Array<{ id: number; name: string; issued: number; redeemed: number; amount: number; coupons: number }>;
}

const STATES: Array<{ key: VoucherState; label: string; dot: string }> = [
  { key: 'REDEEMED', label: 'Skanerlandi', dot: 'bg-emerald-500' },
  { key: 'ISSUED', label: 'Kutilmoqda', dot: 'bg-amber-500' },
  { key: 'EXPIRED', label: "Muddati o'tgan", dot: 'bg-zinc-400' },
  { key: 'CANCELLED', label: 'Bekor qilingan', dot: 'bg-red-400' },
  { key: 'REVOKED', label: 'Kuponlari olib tashlangan', dot: 'bg-red-600' },
];

const num = (n: number) => n.toLocaleString('ru-RU').replace(/\s/g, ' ');

export default function DashboardPage() {
  const me = useAdmin();
  const seesVouchers = can(me, 'vouchers');
  const { data, error, reload } = useLoad(() => adminApi<Dashboard>('/dashboard'), []);
  const recent = useLoad(
    () => (seesVouchers ? adminApi<{ items: VoucherRow[] }>('/vouchers?pageSize=8').then((r) => r.items) : Promise.resolve(null)),
    [seesVouchers],
  );

  if (error)
    return (
      <PageContainer size="wide">
        <ErrorAlert error={error} />
        <div>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Qayta urinish
          </Button>
        </div>
      </PageContainer>
    );
  if (!data) return <DashboardSkeleton />;

  const byState = data.vouchers.byState;
  const totalVouchers = STATES.reduce((n, s) => n + (byState[s.key] ?? 0), 0);
  const totals = data.branches.reduce(
    (t, b) => ({ issued: t.issued + b.issued, redeemed: t.redeemed + b.redeemed, amount: t.amount + b.amount, coupons: t.coupons + b.coupons }),
    { issued: 0, redeemed: 0, amount: 0, coupons: 0 },
  );

  return (
    <PageContainer size="wide">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ishtirokchilar"
          value={num(data.participants.total)}
          sub={`bugun +${num(data.participants.today)} · xodim ${num(data.participants.staff)}`}
          icon={RiGroupLine}
        />
        <StatCard
          label="Bugun QR"
          value={num(data.vouchers.issuedToday)}
          sub={`skanerlangan: ${num(data.vouchers.redeemedToday)}`}
          icon={RiQrCodeLine}
        />
        <StatCard
          label="Kuponlar (o'yinda)"
          value={num(data.coupons.eligible)}
          sub={`bugun +${num(data.coupons.today)} · taklif bonusi ${num(data.coupons.referral)}`}
          icon={RiCoupon3Line}
        />
        <StatCard
          label="Skanerlanmagan QR"
          value={num(byState.ISSUED ?? 0)}
          sub={
            <span className="inline-flex items-center gap-1.5">
              {(byState.ISSUED ?? 0) > 0 && <Dot className="bg-amber-500" />}
              mijoz hali skanerlamagan
            </span>
          }
          icon={RiTimeLine}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DataTableCard className="flex flex-col">
          <SectionHeader title="QR holati" description={`Jami ${num(totalVouchers)} ta QR`} />
          <ul className="flex flex-col p-1.5">
            {STATES.map((s) => {
              const count = byState[s.key] ?? 0;
              const pct = totalVouchers ? (count / totalVouchers) * 100 : 0;
              return (
                <li key={s.key} className="flex flex-col gap-1.5 rounded-lg px-2.5 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <Dot className={cn('size-2', s.dot)} />
                    <span className="flex-1 truncate">{s.label}</span>
                    <span className="font-medium tabular-nums">{num(count)}</span>
                    <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{Math.round(pct)}%</span>
                  </span>
                  <span className="h-1 overflow-hidden rounded-full bg-muted">
                    <span className={cn('block h-full rounded-full opacity-80', s.dot)} style={{ width: `${pct}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </DataTableCard>

        <DataTableCard className="lg:col-span-2">
          <SectionHeader title="Filiallar kesimida" description="Summa va kuponlar — skanerlangan QR'lar bo'yicha" />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Filial</TableHead>
                <TableHead className="text-right">Chiqarilgan QR</TableHead>
                <TableHead className="text-right">Skanerlangan</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead className="text-right">Kuponlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.branches.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5}>
                    <EmptyState icon={RiStore2Line} title="Filiallar yo'q" description="Filiallar qo'shilgach, natijalar shu yerda ko'rinadi" />
                  </TableCell>
                </TableRow>
              )}
              {data.branches.map((b) => {
                const rate = b.issued ? Math.round((b.redeemed / b.issued) * 100) : null;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(b.issued)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(b.redeemed)}
                      {rate !== null && <span className="ml-1.5 text-xs text-muted-foreground">{rate}%</span>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtSum(b.amount)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{num(b.coupons)}</TableCell>
                  </TableRow>
                );
              })}
              {data.branches.length > 1 && (
                <TableRow className="border-t bg-muted/30 font-medium hover:bg-muted/30">
                  <TableCell>Jami</TableCell>
                  <TableCell className="text-right tabular-nums">{num(totals.issued)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(totals.redeemed)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtSum(totals.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(totals.coupons)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </div>

      {seesVouchers && (
        <DataTableCard>
          <SectionHeader
            title="So'nggi QR'lar"
            description="Kassalar chiqargan oxirgi 8 ta QR"
            action={
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/vouchers" />}>
                Barchasi
                <RiArrowRightLine data-icon="inline-end" />
              </Button>
            }
          />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">#</TableHead>
                <TableHead>Kassa</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead className="text-right">Kupon</TableHead>
                <TableHead>Kim skanerladi</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead className="text-right">Vaqt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.loading && !recent.data && (
                <>
                  {Array.from({ length: 4 }, (_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {Array.from({ length: 7 }, (_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full max-w-28" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </>
              )}
              {recent.error && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <ErrorAlert error={recent.error} />
                  </TableCell>
                </TableRow>
              )}
              {recent.data?.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7}>
                    <EmptyState icon={RiInboxLine} title="Hali QR yo'q" description="Kassir QR chiqarganda shu yerda paydo bo'ladi" />
                  </TableCell>
                </TableRow>
              )}
              {recent.data?.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">#{v.id}</TableCell>
                  <TableCell>
                    <div className="grid leading-tight">
                      <span>{v.branch.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.issuedBy.login}
                        {v.terminal && ` · ${v.terminal.name}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{fmtSum(v.amount)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{v.couponsCount}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{v.redeemedPhone ? fmtPhone(v.redeemedPhone) : '—'}</TableCell>
                  <TableCell>
                    <VoucherStatusBadge v={v} detail={false} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">{fmtShort(v.issuedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableCard>
      )}
    </PageContainer>
  );
}

/** Jadval kartasining sarlavha qatori */
function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2.5">
      <div className="grid gap-0.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <PageContainer size="wide">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} size="sm">
            <CardContent className="flex items-start justify-between gap-3">
              <div className="grid gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="size-9 rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2].map((n) => (
          <div key={n} className={cn('flex flex-col gap-4 rounded-xl border bg-card p-4', n === 2 && 'lg:col-span-2')}>
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
