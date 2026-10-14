'use client';

import {
  RiCalendarLine,
  RiCheckLine,
  RiCoupon3Line,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiForbidLine,
  RiMore2Fill,
  RiShieldCheckLine,
  RiTelegramLine,
  RiUserAddLine,
  RiUserForbidLine,
  RiUserStarLine,
  RiQrCodeLine,
} from '@remixicon/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { DataTableCard } from '@/components/admin/data-table';
import { ErrorAlert, InfoList, StatCard, useLoad } from '@/components/admin/kit';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { adminApi } from '@/lib/api';
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
    source: 'VOUCHER' | 'REFERRAL' | string;
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
  const [deleteOpen, setDeleteOpen] = useState(false);

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
  // O'chirish qaytarib bo'lmaydi — faqat ADMIN roli
  const canDelete = me.role === 'ADMIN';

  const remove = async () => {
    setBusy(true);
    try {
      const r = await adminApi<{ coupons: number; receipts: number }>(`/participants/${p.id}`, { method: 'DELETE' });
      toast.success(`${who} o'chirildi (${r.coupons} kupon, ${r.receipts} chek)`);
      router.replace('/admin/participants');
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };
  const who = p.phone ?? (name || `#${p.id}`);

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
                  {canDelete && (
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                      <RiDeleteBinLine />
                      O&apos;chirish
                    </DropdownMenuItem>
                  )}
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

      {canDelete && (
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{who} butunlay o&apos;chirilsinmi?</AlertDialogTitle>
              <AlertDialogDescription>
                Barcha cheklari va {p.coupons.eligible + p.coupons.ineligible} ta kuponi o&apos;chadi, qaytarib bo&apos;lmaydi.
                U skanerlagan QR&apos;lar qayta ishlamaydi. Shu Telegram akkaunt botga /start bossa — yangidan ro&apos;yxatdan
                o&apos;tadi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
              <AlertDialogAction render={<Button variant="destructive" />} onClick={() => void remove()}>
                O&apos;chirish
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
          sub="xodim — o'yinda emas"
          icon={RiUserForbidLine}
        />
        <StatCard
          label="Skanerlangan QR"
          value={p.receipts.filter((r) => r.source === 'VOUCHER').length}
          sub={`taklif bonusi: ${p.receipts.filter((r) => r.source === 'REFERRAL').length}`}
          icon={RiQrCodeLine}
        />
        <StatCard
          label="Taklif qilganlari"
          value={p._count.referrals}
          sub="referal orqali"
          icon={RiUserAddLine}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Kuponlar tarixi: kassa QR'lari va taklif bonuslari */}
        <div className="grid min-w-0 gap-2">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-sm font-semibold">Kuponlar tarixi</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{p.receipts.length} ta</span>
          </div>
          <DataTableCard>
            {!p.receipts.length ? (
              <EmptyState icon={RiQrCodeLine} title="Hali kupon yo'q" description="Bu ishtirokchi hali QR skanerlamagan." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Manba</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead className="text-right">Summa</TableHead>
                    <TableHead className="pr-4 text-right">Kupon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium">{r.source === 'REFERRAL' ? 'Taklif bonusi' : 'Kassa QR'}</span>
                          {r.source === 'VOUCHER' && r.receiptNumber && (
                            <span className="font-mono text-xs text-muted-foreground">#{r.receiptNumber.replace(/^V/, '')}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">{fmtShort(r.createdAt)}</div>
                      </TableCell>
                      <TableCell>{r.branch?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.amount ? fmtSum(r.amount) : '—'}</TableCell>
                      <TableCell className="pr-4 text-right font-semibold tabular-nums">{r.couponsCount}</TableCell>
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
