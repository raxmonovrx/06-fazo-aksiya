'use client';

import {
  RiCoupon3Line,
  RiForbidLine,
  RiReceiptLine,
  RiShieldCheckLine,
  RiUserAddLine,
  RiUserStarLine,
} from '@remixicon/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  ErrorAlert,
  InfoList,
  StatCard,
  StatusBadge,
  TableEmpty,
  useLoad,
} from '@/components/admin/kit';
import { usePageHeader } from '@/components/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { fmtDate, fmtSum } from '@/lib/format';
import { useAdmin } from '../../admin-context';

interface Detail {
  id: number;
  tgId: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  refCode: string;
  source: string | null;
  startPayload: string | null;
  isStaff: boolean;
  isBlocked: boolean;
  botBlockedAt: string | null;
  rulesAcceptedAt: string | null;
  createdAt: string;
  referredBy: {
    id: number;
    phone: string | null;
    firstName: string | null;
  } | null;
  _count: { referrals: number };
  coupons: { eligible: number; ineligible: number };
  receipts: Array<{
    id: number;
    status: string;
    fiscalAt: string | null;
    receiptNumber: string | null;
    amount: string | null;
    couponsCount: number;
    createdAt: string;
    branch: { name: string } | null;
  }>;
}

/** Avatar uchun bosh harflar */
function initials(p: Detail) {
  const s = [p.firstName, p.lastName]
    .filter(Boolean)
    .map((w) => w!.trim()[0])
    .join('');
  return (s || p.username?.[0] || '#').slice(0, 2).toUpperCase();
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default function ParticipantPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useAdmin();
  const {
    data: p,
    error,
    reload,
  } = useLoad(() => adminApi<Detail>(`/participants/${id}`), [id]);
  const [busy, setBusy] = useState(false);

  const name = p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : '';
  usePageHeader(
    p
      ? {
          title: p.phone ?? (name || `#${p.id}`),
          backHref: '/admin/participants',
        }
      : null,
  );

  if (error) return <ErrorAlert error={error} />;
  if (!p) return <DetailSkeleton />;

  const patch = async (
    data: Partial<Pick<Detail, 'isBlocked' | 'isStaff'>>,
    ok: string,
  ) => {
    setBusy(true);
    try {
      await adminApi(`/participants/${p.id}`, { method: 'PATCH', json: data });
      await reload();
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const isAdmin = me.role === 'ADMIN';

  return (
    <div className="flex flex-col gap-4">
      {/* Profil sarlavhasi */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
              {initials(p)}
            </AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-lg font-semibold">
                {name || p.phone || `#${p.id}`}
              </span>
              {p.isStaff && <Badge variant="secondary">xodim</Badge>}
              {p.isBlocked && <Badge variant="destructive">bloklangan</Badge>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="tabular-nums">{p.phone ?? "kontakt yo'q"}</span>
              {p.username && <span>@{p.username}</span>}
              <span className="tabular-nums">#{p.id}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Kuponlar"
          value={p.coupons.eligible}
          sub={`o'yindan tashqari: ${p.coupons.ineligible}`}
          icon={RiCoupon3Line}
        />
        <StatCard
          label="Cheklar"
          value={p.receipts.length}
          icon={RiReceiptLine}
        />
        <StatCard
          label="Taklif qilganlari"
          value={p._count.referrals}
          icon={RiUserAddLine}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList
              className="lg:grid-cols-3"
              items={[
                { label: 'Ism', value: name || '—' },
                {
                  label: 'Telegram',
                  value: (
                    <>
                      {p.username ? `@${p.username}` : '—'}{' '}
                      <Muted>{p.tgId}</Muted>
                    </>
                  ),
                },
                {
                  label: 'Manba',
                  value: (
                    <>
                      {p.source ?? '—'} <Muted>{p.startPayload}</Muted>
                    </>
                  ),
                },
                {
                  label: 'Referal kodi',
                  value: <span className="font-mono">{p.refCode}</span>,
                },
                {
                  label: 'Kim taklif qilgan',
                  value: p.referredBy ? (
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/admin/participants/${p.referredBy.id}`}
                    >
                      {p.referredBy.phone ??
                        p.referredBy.firstName ??
                        `#${p.referredBy.id}`}
                    </Link>
                  ) : (
                    '—'
                  ),
                },
                {
                  label: "Ro'yxatdan o'tgan",
                  value: p.rulesAcceptedAt ? (
                    fmtDate(p.rulesAcceptedAt)
                  ) : (
                    <Muted>tugallanmagan</Muted>
                  ),
                },
                {
                  label: 'Botni bloklagan',
                  value: p.botBlockedAt ? fmtDate(p.botBlockedAt) : "yo'q",
                },
              ]}
            />
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Amallar</CardTitle>
              <CardDescription>
                Xodim kuponlari o&apos;yinda qatnashmaydi.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  patch(
                    { isStaff: !p.isStaff },
                    p.isStaff
                      ? 'Xodim belgisi olib tashlandi'
                      : 'Xodim deb belgilandi',
                  )
                }
              >
                <RiUserStarLine data-icon="inline-start" />
                {p.isStaff
                  ? 'Xodim belgisini olib tashlash'
                  : 'Xodim deb belgilash'}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant={p.isBlocked ? 'outline' : 'destructive'}
                      disabled={busy}
                    />
                  }
                >
                  {p.isBlocked ? (
                    <RiShieldCheckLine data-icon="inline-start" />
                  ) : (
                    <RiForbidLine data-icon="inline-start" />
                  )}
                  {p.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {p.isBlocked
                        ? 'Blokdan chiqarilsinmi?'
                        : 'Ishtirokchi bloklansinmi?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {p.phone ?? (name || `#${p.id}`)}
                      {p.isBlocked
                        ? ' yana aksiyada qatnasha oladi.'
                        : ' aksiyada qatnasha olmaydi.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                    <AlertDialogAction
                      render={
                        <Button
                          variant={p.isBlocked ? 'default' : 'destructive'}
                        />
                      }
                      onClick={() =>
                        patch(
                          { isBlocked: !p.isBlocked },
                          p.isBlocked
                            ? 'Blokdan chiqarildi'
                            : 'Ishtirokchi bloklandi',
                        )
                      }
                    >
                      {p.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Cheklar</CardTitle>
          <CardDescription>Jami: {p.receipts.length}</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">ID</TableHead>
              <TableHead>Qo&apos;shilgan</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Chek</TableHead>
              <TableHead>Chek vaqti</TableHead>
              <TableHead className="text-right">Summa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Kupon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!p.receipts.length ? (
              <TableEmpty colSpan={8}>Cheklar yo&apos;q</TableEmpty>
            ) : (
              p.receipts.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/receipts/${r.id}`)}
                >
                  <TableCell className="pl-4">
                    <Link
                      className="font-medium text-primary tabular-nums hover:underline"
                      href={`/admin/receipts/${r.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      #{r.id}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmtDate(r.createdAt)}
                  </TableCell>
                  <TableCell>{r.branch?.name ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.receiptNumber ?? '—'}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmtDate(r.fiscalAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtSum(r.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="pr-4 text-right font-semibold tabular-nums">
                    {r.couponsCount || ''}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
