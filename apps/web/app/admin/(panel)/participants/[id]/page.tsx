'use client';

import {
  RiCalendarLine,
  RiCheckLine,
  RiCoupon3Line,
  RiFileCopyLine,
  RiForbidLine,
  RiMore2Fill,
  RiReceiptLine,
  RiShieldCheckLine,
  RiTelegramLine,
  RiUserAddLine,
  RiUserForbidLine,
  RiUserStarLine,
} from '@remixicon/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { DataTableCard } from '@/components/admin/data-table';
import {
  ErrorAlert,
  InfoList,
  StatCard,
  StatusBadge,
  useLoad,
} from '@/components/admin/kit';
import { Dot, EmptyState, PageContainer } from '@/components/admin/layout';
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
import { adminApi, qs } from '@/lib/api';
import { fmtDate, fmtPhone, fmtShort, fmtSum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { can, useAdmin } from '../../admin-context';

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
    .map((w) => w!.trim()[0] ?? '')
    .join('');
  return (s || p.username?.[0] || p.phone?.slice(-2) || '#')
    .slice(0, 2)
    .toUpperCase();
}

/** Matnni nusxalash tugmasi (bosilgandan keyin bir lahza ✓) */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      className="text-muted-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          toast.success('Nusxalandi');
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Nusxalab bo'lmadi");
        }
      }}
    >
      {done ? <RiCheckLine /> : <RiFileCopyLine />}
    </Button>
  );
}

function DetailSkeleton() {
  return (
    <PageContainer size="wide">
      <Card>
        <CardContent className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <Skeleton className="hidden h-8 w-28 sm:block" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[86px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </PageContainer>
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
  const [blockOpen, setBlockOpen] = useState(false);

  const name = p ? [p.firstName, p.lastName].filter(Boolean).join(' ') : '';
  usePageHeader(
    p
      ? {
          title: p.phone ? fmtPhone(p.phone) : name || `#${p.id}`,
          backHref: '/admin/participants',
        }
      : null,
  );

  if (error)
    return (
      <PageContainer size="wide">
        <ErrorAlert error={error} />
      </PageContainer>
    );
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

  const isAdmin = can(me, 'participants.edit');
  const who = p.phone ?? (name || `#${p.id}`);
  const openReceipt = (rid: number) => router.push(`/admin/receipts/${rid}`);

  return (
    <PageContainer size="wide">
      {/* Profil sarlavhasi */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback
                className={cn(
                  'text-lg font-semibold',
                  p.isBlocked
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary',
                )}
              >
                {initials(p)}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-lg font-semibold tracking-tight">
                  {name || p.phone || `#${p.id}`}
                </span>
                {p.isStaff && <Badge variant="secondary">xodim</Badge>}
                {p.isBlocked && <Badge variant="destructive">bloklangan</Badge>}
                {!p.rulesAcceptedAt && (
                  <Badge variant="outline" className="gap-1.5 font-normal">
                    <Dot className="bg-amber-500" />
                    ro&apos;yxat tugallanmagan
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {p.phone ? (
                  <span className="inline-flex items-center gap-0.5 text-foreground tabular-nums">
                    {fmtPhone(p.phone)}
                    <CopyButton value={p.phone} label="Telefonni nusxalash" />
                  </span>
                ) : (
                  <span>kontakt yo&apos;q</span>
                )}
                {p.username && (
                  <span className="inline-flex items-center gap-1">
                    <RiTelegramLine className="size-3.5" />@{p.username}
                  </span>
                )}
                <span className="font-mono text-xs">#{p.id}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <RiCalendarLine className="size-3.5" />
                  {p.rulesAcceptedAt
                    ? `Ro'yxatdan o'tgan: ${fmtDate(p.rulesAcceptedAt)}`
                    : `Botga kirgan: ${fmtDate(p.createdAt)}`}
                </span>
                {(p.source || p.startPayload) && (
                  <span className="inline-flex items-center gap-1.5">
                    Manba:
                    {p.source && (
                      <Badge
                        variant="outline"
                        className="h-4.5 px-1.5 text-[11px] font-normal"
                      >
                        {p.source}
                      </Badge>
                    )}
                    {p.startPayload && (
                      <span className="font-mono">{p.startPayload}</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {p.phone && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link href={`/admin/receipts${qs({ phone: p.phone })}`} />
                }
              >
                <RiReceiptLine data-icon="inline-start" />
                Cheklari
              </Button>
            )}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={busy} />
                  }
                >
                  Amallar
                  <RiMore2Fill data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem
                    onClick={() =>
                      patch(
                        { isStaff: !p.isStaff },
                        p.isStaff
                          ? 'Xodim belgisi olib tashlandi'
                          : 'Xodim deb belgilandi',
                      )
                    }
                  >
                    <RiUserStarLine />
                    {p.isStaff
                      ? 'Xodim belgisini olib tashlash'
                      : 'Xodim deb belgilash'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant={p.isBlocked ? 'default' : 'destructive'}
                    onClick={() => setBlockOpen(true)}
                  >
                    {p.isBlocked ? <RiShieldCheckLine /> : <RiForbidLine />}
                    {p.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {p.isBlocked
                  ? 'Blokdan chiqarilsinmi?'
                  : 'Ishtirokchi bloklansinmi?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {who}
                {p.isBlocked
                  ? ' yana aksiyada qatnasha oladi.'
                  : ' aksiyada qatnasha olmaydi.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
              <AlertDialogAction
                render={
                  <Button variant={p.isBlocked ? 'default' : 'destructive'} />
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
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Kuponlar (o'yinda)"
          value={p.coupons.eligible}
          sub={p.isStaff ? "xodim — o'yinda emas" : "yutuq o'yinida"}
          icon={RiCoupon3Line}
        />
        <StatCard
          label="O'yindan tashqari"
          value={p.coupons.ineligible}
          sub="tasdiqlanmagan / xodim"
          icon={RiUserForbidLine}
        />
        <StatCard
          label="Cheklar"
          value={p.receipts.length}
          sub={p.receipts.length >= 100 ? 'oxirgi 100 tasi' : 'jami yuborilgan'}
          icon={RiReceiptLine}
        />
        <StatCard
          label="Taklif qilganlari"
          value={p._count.referrals}
          sub="referal orqali"
          icon={RiUserAddLine}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Cheklar */}
        <div className="grid min-w-0 gap-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-semibold">Cheklar</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {p.receipts.length} ta
            </span>
          </div>
          <DataTableCard>
            {!p.receipts.length ? (
              <EmptyState
                icon={RiReceiptLine}
                title="Cheklar yo'q"
                description="Bu ishtirokchi hali chek yubormagan."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Chek</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead className="pr-4 text-right">Kupon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.receipts.map((r) => (
                    <TableRow
                      key={r.id}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      onClick={() => openReceipt(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openReceipt(r.id);
                      }}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium tabular-nums">
                            #{r.id}
                          </span>
                          {r.receiptNumber && (
                            <span className="font-mono text-xs text-muted-foreground">
                              №{r.receiptNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {fmtShort(r.fiscalAt ?? r.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.branch?.name ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtSum(r.amount)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'pr-4 text-right font-semibold tabular-nums',
                          !r.couponsCount &&
                            'font-normal text-muted-foreground',
                        )}
                      >
                        {r.couponsCount || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DataTableCard>
        </div>

        {/* Profil */}
        <div className="grid gap-4 lg:pt-7">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Profil</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoList
                className="gap-y-3 sm:grid-cols-1"
                items={[
                  {
                    label: 'Referal kodi',
                    value: (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-mono">{p.refCode}</span>
                        <CopyButton
                          value={p.refCode}
                          label="Referal kodni nusxalash"
                        />
                      </span>
                    ),
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
                      <span className="text-muted-foreground">—</span>
                    ),
                  },
                  {
                    label: 'Botni bloklagan',
                    value: p.botBlockedAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Dot className="bg-red-500" />
                        {fmtDate(p.botBlockedAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Dot className="bg-emerald-500" />
                        yo&apos;q
                      </span>
                    ),
                  },
                  {
                    label: 'Botga kirgan',
                    value: (
                      <span className="tabular-nums">
                        {fmtDate(p.createdAt)}
                      </span>
                    ),
                  },
                  {
                    label: 'Telegram ID',
                    value: (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-mono text-xs">{p.tgId}</span>
                        <CopyButton
                          value={p.tgId}
                          label="Telegram ID ni nusxalash"
                        />
                      </span>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle>Kuponlar</CardTitle>
              <CardDescription>
                Xodim kuponlari o&apos;yinda qatnashmaydi.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <CouponBar
                eligible={p.coupons.eligible}
                ineligible={p.coupons.ineligible}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

/** O'yindagi / tashqaridagi kuponlar nisbati — ingichka chiziq */
function CouponBar({
  eligible,
  ineligible,
}: {
  eligible: number;
  ineligible: number;
}) {
  const total = eligible + ineligible;
  const pct = total ? (eligible / total) * 100 : 0;
  return (
    <>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid gap-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Dot className="bg-primary" />
            O&apos;yinda
          </span>
          <span className="font-medium tabular-nums">{eligible}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Dot className="bg-muted-foreground/40" />
            O&apos;yindan tashqari
          </span>
          <span className="font-medium tabular-nums">{ineligible}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-1.5">
          <span className="text-muted-foreground">Jami</span>
          <span className="font-semibold tabular-nums">{total}</span>
        </div>
      </div>
    </>
  );
}
