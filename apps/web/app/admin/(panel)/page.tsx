'use client';

import {
  RiArrowRightUpLine,
  RiBillLine,
  RiCoupon3Line,
  RiGroupLine,
  RiTimeLine,
} from '@remixicon/react';
import Link from 'next/link';

import {
  ErrorAlert,
  StatCard,
  StatusBadge,
  TableEmpty,
  useLoad,
} from '@/components/admin/kit';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { fmtSum, STATUS } from '@/lib/format';
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

const num = (n: number) => n.toLocaleString('ru-RU').replace(/ /g, ' ');

export default function DashboardPage() {
  const { data, error } = useLoad(() => adminApi<Dashboard>('/dashboard'), []);
  if (error) return <ErrorAlert error={error} />;
  if (!data) return <DashboardSkeleton />;

  const byStatus = data.receipts.byStatus;
  const review = (byStatus.NEEDS_REVIEW ?? 0) + (byStatus.NOT_FOUND ?? 0);
  const totalReceipts = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ishtirokchilar"
          value={num(data.participants.total)}
          sub={`bugun +${data.participants.today} · xodim ${data.participants.staff}`}
          icon={RiGroupLine}
        />
        <StatCard
          label="Cheklar"
          value={num(totalReceipts)}
          sub={`bugun +${data.receipts.today}`}
          icon={RiBillLine}
        />
        <StatCard
          label="Kuponlar (o'yinda)"
          value={num(data.coupons.eligible)}
          sub={`bugun +${data.coupons.today}`}
          icon={RiCoupon3Line}
        />
        {/* Moderatsiya — bosiladigan karta; kutayotgan bo'lsa ajralib turadi */}
        <Link
          href="/admin/moderation"
          className={cn(
            'group/mod block rounded-xl outline-none transition-shadow',
            'hover:ring-2 hover:ring-primary/40',
            'focus-visible:ring-3 focus-visible:ring-ring/50',
            review > 0 && 'ring-2 ring-primary',
          )}
        >
          <StatCard
            label="Moderatsiya kutmoqda"
            value={
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  review > 0 && 'text-primary',
                )}
              >
                {num(review)}
                <RiArrowRightUpLine className="size-4 opacity-0 transition-opacity group-hover/mod:opacity-70" />
              </span>
            }
            sub={
              data.unknownFms
                ? `noma'lum FM: ${data.unknownFms}`
                : review > 0
                  ? "ko'rib chiqish kerak"
                  : "navbat bo'sh"
            }
            icon={RiTimeLine}
          />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Cheklar statuslar bo&apos;yicha</CardTitle>
            <CardDescription>Jami: {num(totalReceipts)}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1">
              {Object.keys(STATUS).map((s) => {
                const count = byStatus[s] ?? 0;
                const pct = totalReceipts ? (count / totalReceipts) * 100 : 0;
                return (
                  <li key={s}>
                    <Link
                      href={`/admin/receipts?status=${s}`}
                      className="-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <StatusBadge status={s} />
                        <span className="text-sm font-semibold tabular-nums">
                          {num(count)}
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            {Math.round(pct)}%
                          </span>
                        </span>
                      </span>
                      <span className="h-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary/60"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Filiallar kesimida</CardTitle>
            <CardDescription>
              Cheklar, tasdiqlanganlar, summa va kuponlar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filial</TableHead>
                  <TableHead className="text-right">Cheklar</TableHead>
                  <TableHead className="text-right">Tasdiqlangan</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                  <TableHead className="text-right">Kuponlar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.branches.length === 0 && <TableEmpty colSpan={5} />}
                {data.branches.map((b) => (
                  <TableRow key={b.id ?? 'none'}>
                    <TableCell
                      className={cn(
                        'font-medium',
                        b.id === null && 'text-muted-foreground',
                      )}
                    >
                      {b.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(b.receipts)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(b.approved)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      {fmtSum(b.amount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {num(b.coupons)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
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
        <Card>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
