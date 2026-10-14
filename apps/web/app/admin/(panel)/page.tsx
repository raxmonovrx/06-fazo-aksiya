'use client';

import {
  RiArrowRightLine,
  RiArrowRightUpLine,
  RiBillLine,
  RiCoupon3Line,
  RiGroupLine,
  RiInboxLine,
  RiStore2Line,
  RiTimeLine,
} from '@remixicon/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DataTableCard } from '@/components/admin/data-table';
import {
  ErrorAlert,
  STATUS_DOT,
  StatCard,
  StatusBadge,
  useLoad,
} from '@/components/admin/kit';
import { Dot, EmptyState, PageContainer } from '@/components/admin/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/lib/api';
import { fmtPhone, fmtShort, fmtSum, STATUS } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Dashboard {
  participants: { total: number; today: number; staff: number };
  receipts: { today: number; byStatus: Record<string, number> };
  coupons: { eligible: number; today: number };
  unknownFms: number;
  branches: Array<{
    id: number | null;
    name: string;
    receipts: number;
    approved: number;
    amount: number;
    coupons: number;
  }>;
}

interface RecentReceipt {
  id: number;
  status: string;
  amount: string | null;
  receiptNumber: string | null;
  createdAt: string;
  branch: { id: number; name: string } | null;
  participant: {
    id: number;
    phone: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

const num = (n: number) => n.toLocaleString('ru-RU').replace(/\s/g, ' ');

export default function DashboardPage() {
  const router = useRouter();
  const { data, error, reload } = useLoad(
    () => adminApi<Dashboard>('/dashboard'),
    [],
  );
  const recent = useLoad(
    () =>
      adminApi<{ items: RecentReceipt[] }>('/receipts?pageSize=8').then(
        (r) => r.items,
      ),
    [],
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

  const byStatus = data.receipts.byStatus;
  const review = (byStatus.NEEDS_REVIEW ?? 0) + (byStatus.NOT_FOUND ?? 0);
  const totalReceipts = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const branchTotals = data.branches.reduce(
    (t, b) => ({
      receipts: t.receipts + b.receipts,
      approved: t.approved + b.approved,
      amount: t.amount + b.amount,
      coupons: t.coupons + b.coupons,
    }),
    { receipts: 0, approved: 0, amount: 0, coupons: 0 },
  );
  // «Noma'lum» filial — faqat cheki bo'lsa ko'rsatiladi
  const branches = data.branches.filter((b) => b.id !== null || b.receipts);

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
          label="Cheklar"
          value={num(totalReceipts)}
          sub={`bugun +${num(data.receipts.today)}`}
          icon={RiBillLine}
        />
        <StatCard
          label="Kuponlar (o'yinda)"
          value={num(data.coupons.eligible)}
          sub={`bugun +${num(data.coupons.today)}`}
          icon={RiCoupon3Line}
        />
        {/* Moderatsiya — bosiladigan karta */}
        <Link
          href="/admin/moderation"
          aria-label="Moderatsiyaga o'tish"
          className="group/mod block rounded-xl outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 [&>[data-slot=card]]:transition-colors hover:[&>[data-slot=card]]:bg-muted/40"
        >
          <StatCard
            label="Moderatsiya kutmoqda"
            value={
              <span className="inline-flex items-center gap-1.5">
                {num(review)}
                <RiArrowRightUpLine className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/mod:opacity-100" />
              </span>
            }
            sub={
              <span className="inline-flex items-center gap-1.5">
                {review > 0 && <Dot className="bg-amber-500" />}
                {data.unknownFms
                  ? `noma'lum FM: ${num(data.unknownFms)}`
                  : review > 0
                    ? "ko'rib chiqish kerak"
                    : "navbat bo'sh"}
              </span>
            }
            icon={RiTimeLine}
          />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Statuslar */}
        <DataTableCard className="flex flex-col">
          <SectionHeader
            title="Statuslar bo'yicha"
            description={`Jami ${num(totalReceipts)} ta chek`}
          />
          <ul className="flex flex-col p-1.5">
            {Object.keys(STATUS).map((s) => {
              const count = byStatus[s] ?? 0;
              const pct = totalReceipts ? (count / totalReceipts) * 100 : 0;
              return (
                <li key={s}>
                  <Link
                    href={`/admin/receipts?status=${s}`}
                    className="flex flex-col gap-1.5 rounded-lg px-2.5 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Dot
                        className={cn(
                          'size-2',
                          STATUS_DOT[s] ?? 'bg-muted-foreground',
                        )}
                      />
                      <span className="flex-1 truncate">{STATUS[s].label}</span>
                      <span className="font-medium tabular-nums">
                        {num(count)}
                      </span>
                      <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">
                        {Math.round(pct)}%
                      </span>
                    </span>
                    <span className="h-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn(
                          'block h-full rounded-full opacity-80',
                          STATUS_DOT[s] ?? 'bg-muted-foreground',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </DataTableCard>

        {/* Filiallar */}
        <DataTableCard className="lg:col-span-2">
          <SectionHeader
            title="Filiallar kesimida"
            description="Summa va kuponlar — tasdiqlangan cheklar bo'yicha"
          />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Filial</TableHead>
                <TableHead className="text-right">Cheklar</TableHead>
                <TableHead className="text-right">Tasdiqlangan</TableHead>
                <TableHead className="text-right">Summa</TableHead>
                <TableHead className="text-right">Kuponlar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5}>
                    <EmptyState
                      icon={RiStore2Line}
                      title="Filiallar yo'q"
                      description="Filiallar qo'shilgach, natijalar shu yerda ko'rinadi"
                    />
                  </TableCell>
                </TableRow>
              )}
              {branches.map((b) => {
                const rate = b.receipts
                  ? Math.round((b.approved / b.receipts) * 100)
                  : null;
                return (
                  <TableRow
                    key={b.id ?? 'none'}
                    className={cn(b.id !== null && 'cursor-pointer')}
                    onClick={
                      b.id !== null
                        ? () => router.push(`/admin/receipts?branchId=${b.id}`)
                        : undefined
                    }
                  >
                    <TableCell
                      className={cn(
                        'font-medium',
                        b.id === null && 'font-normal text-muted-foreground',
                      )}
                    >
                      {b.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(b.receipts)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(b.approved)}
                      {rate !== null && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {rate}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {fmtSum(b.amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {num(b.coupons)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {branches.length > 1 && (
                <TableRow className="border-t bg-muted/30 font-medium hover:bg-muted/30">
                  <TableCell>Jami</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(branchTotals.receipts)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(branchTotals.approved)}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {fmtSum(branchTotals.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(branchTotals.coupons)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DataTableCard>
      </div>

      {/* So'nggi cheklar */}
      <DataTableCard>
        <SectionHeader
          title="So'nggi cheklar"
          description="Oxirgi yuborilgan 8 ta chek"
          action={
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/admin/receipts" />}
            >
              Barchasi
              <RiArrowRightLine data-icon="inline-end" />
            </Button>
          }
        />
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-20">ID</TableHead>
              <TableHead>Ishtirokchi</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead className="text-right">Summa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Vaqt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.loading && !recent.data && (
              <>
                {Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {Array.from({ length: 6 }, (_, j) => (
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
                <TableCell colSpan={6}>
                  <ErrorAlert error={recent.error} />
                </TableCell>
              </TableRow>
            )}
            {recent.data?.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={RiInboxLine}
                    title="Hali chek yo'q"
                    description="Ishtirokchilar chek yuborganda shu yerda paydo bo'ladi"
                  />
                </TableCell>
              </TableRow>
            )}
            {recent.data?.map((r) => {
              const name = [r.participant?.firstName, r.participant?.lastName]
                .filter(Boolean)
                .join(' ');
              const open = () => router.push(`/admin/receipts/${r.id}`);
              return (
                <TableRow
                  key={r.id}
                  tabIndex={0}
                  className="cursor-pointer outline-none focus-visible:bg-muted/50"
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') open();
                  }}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{r.id}
                  </TableCell>
                  <TableCell>
                    <div className="grid leading-tight">
                      <span className="whitespace-nowrap tabular-nums">
                        {r.participant ? fmtPhone(r.participant.phone) : '—'}
                      </span>
                      {name && (
                        <span className="truncate text-xs text-muted-foreground">
                          {name}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      'whitespace-nowrap',
                      !r.branch && 'text-muted-foreground',
                    )}
                  >
                    {r.branch?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {r.amount ? fmtSum(r.amount) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                    {fmtShort(r.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DataTableCard>
    </PageContainer>
  );
}

/** Jadval kartasining sarlavha qatori */
function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2.5">
      <div className="grid gap-0.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
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
          <div
            key={n}
            className={cn(
              'flex flex-col gap-4 rounded-xl border bg-card p-4',
              n === 2 && 'lg:col-span-2',
            )}
          >
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </PageContainer>
  );
}
