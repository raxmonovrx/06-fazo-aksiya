'use client';

import {
  RiArrowDownSLine,
  RiCamera3Line,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiCloseCircleLine,
  RiEditBoxLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiHistoryLine,
  RiImageLine,
  RiInformationLine,
  RiLink,
  RiLoader4Line,
  RiQrCodeLine,
  RiQrScan2Line,
  RiStore2Line,
  RiTicket2Line,
  RiUser3Line,
  RiZoomInLine,
  RiZoomOutLine,
  RiUserAddLine,
} from '@remixicon/react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  ErrorAlert,
  InfoList,
  StatusBadge,
  useLoad,
} from '@/components/admin/kit';
import { EmptyState } from '@/components/admin/layout';
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
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/api';
import { fmtDate, fmtPhone, fmtShort, fmtSum } from '@/lib/format';
import { cn } from '@/lib/utils';

/*
 * Chekni ko'rib chiqish — tafsilot sahifasi (`variant="page"`) va
 * moderatsiya navbatining o'ng paneli (`variant="pane"`) uchun bitta
 * komponent. Endpoint'lar: GET /receipts/:id, POST /receipts/:id/approve,
 * POST /receipts/:id/reject.
 */

interface Detail {
  id: number;
  status: string;
  source: string;
  fm: string | null;
  receiptNumber: string | null;
  fiscalSign: string | null;
  fiscalAt: string | null;
  rawUrl: string | null;
  amount: string | null;
  couponsCount: number;
  rejectCode: string | null;
  rejectReason: string | null;
  photoFileId: string | null;
  createdAt: string;
  decidedAt: string | null;
  branch: { id: number; name: string } | null;
  participant: {
    id: number;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    isStaff: boolean;
  };
  saleRecord: SaleRec | null;
  reviewedBy: { login: string } | null;
  coupons: Array<{ id: number; eligible: boolean }>;
  audit: Array<{
    id: number;
    action: string;
    createdAt: string;
    data: unknown;
    actor: { login: string } | null;
  }>;
  scans: Array<{
    id: number;
    result: string;
    channel: string;
    createdAt: string;
  }>;
  candidates: SaleRec[];
}

interface SaleRec {
  id: number;
  source: string;
  fm: string | null;
  receiptNumber: string | null;
  closedAt: string;
  amount: string;
  isRefund: boolean;
  branchHint: string | null;
}

/** `/branches` javobidan kerakli qism (kupon qoidalari bilan) */
export interface BranchRule {
  id: number;
  name: string;
  minSum?: string | number;
  couponPrice?: string | number;
  maxPerReceipt?: number;
}

export interface ResolvedReceipt {
  id: number;
  status: 'APPROVED' | 'BELOW_MIN' | 'REJECTED' | string;
}

const REJECT_PRESETS = [
  "Chek o'qilmaydi / QR yo'q",
  'Fiskal chek emas (prechek)',
  'Aksiyadagi filialga tegishli emas',
  "Chek muddati o'tgan",
  'Soxta yoki takroriy chek',
];

const SOURCE: Record<string, { label: string; icon: typeof RiQrCodeLine }> = {
  QR: { label: 'QR kod', icon: RiQrCodeLine },
  PHOTO: { label: 'Rasm', icon: RiCamera3Line },
  MANUAL: { label: "Qo'lda", icon: RiEditBoxLine },
  VOUCHER: { label: 'Kassa QR', icon: RiQrCodeLine },
  REFERRAL: { label: 'Taklif bonusi', icon: RiUserAddLine },
};

const AUDIT_ACTION: Record<string, string> = {
  'receipt.approve': 'Tasdiqladi',
  'receipt.reject': 'Rad etdi',
  'receipt.manual': "Qo'lda qo'shdi",
};

const photoUrl = (id: string) => `/api/admin/photos/${id}`;
const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, 10);
const groupDigits = (d: string) =>
  d ? Number(d).toLocaleString('ru-RU').replace(/\s/g, ' ') : '';

/** Server bilan bir xil formula (api/src/core/coupons.ts) */
function calcCoupons(sum: number, b: BranchRule): number | null {
  if (b.minSum === undefined || b.couponPrice === undefined) return null;
  const minSum = Number(b.minSum);
  const price = Number(b.couponPrice);
  const max = b.maxPerReceipt ?? 0;
  if (!Number.isFinite(sum) || sum <= 0) return 0;
  if (sum < minSum) return 0;
  if (price <= 0 || max <= 0) return 0;
  return Math.min(Math.max(1, Math.floor(sum / price)), max);
}

function initials(first: string | null, last: string | null) {
  const s = [first, last]
    .filter(Boolean)
    .map((x) => x!.trim()[0])
    .join('');
  return s ? s.toUpperCase() : null;
}

export function ReceiptReview(props: {
  id: number;
  variant?: 'page' | 'pane';
  onResolved?: (r: ResolvedReceipt) => void;
  /** Filiallar ro'yxati oldindan yuklangan bo'lsa (navbat sahifasi) */
  branches?: BranchRule[] | null;
}) {
  // Chek almashganda forma holati ham yangidan boshlanadi
  return <Review key={props.id} {...props} />;
}

function Review({
  id,
  variant = 'page',
  onResolved,
  branches: branchesProp,
}: {
  id: number;
  variant?: 'page' | 'pane';
  onResolved?: (r: ResolvedReceipt) => void;
  branches?: BranchRule[] | null;
}) {
  const {
    data: r,
    error,
    reload,
  } = useLoad(() => adminApi<Detail>(`/receipts/${id}`), [id]);
  const branchesLoad = useLoad(
    () =>
      branchesProp
        ? Promise.resolve(branchesProp)
        : adminApi<BranchRule[]>('/branches'),
    [branchesProp],
  );
  const branches = branchesLoad.data ?? [];

  const [amount, setAmount] = useState('');
  const [branchId, setBranchId] = useState('');
  const [fm, setFm] = useState('');
  const [num, setNum] = useState('');
  const [fiscalAt, setFiscalAt] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  if (error)
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorAlert error={error} />
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          Qayta urinish
        </Button>
      </div>
    );
  if (!r) return <ReviewSkeleton variant={variant} />;

  const pane = variant === 'pane';
  const canApprove = r.status !== 'APPROVED' && r.coupons.length === 0;
  const canReject = r.status !== 'REJECTED';
  const needIds = !r.fm || !r.receiptNumber;
  const branchValue = branchId || String(r.branch?.id ?? '');
  const branchItems = branches.map((b) => ({
    value: String(b.id),
    label: b.name,
  }));
  const rule = branches.find((b) => String(b.id) === branchValue);
  const preview = rule && amount ? calcCoupons(Number(amount), rule) : null;

  const act = async (
    kind: 'approve' | 'reject',
    fn: () => Promise<{ status?: string } | unknown>,
    ok: string,
  ) => {
    setBusy(kind);
    setActionError(null);
    try {
      const res = (await fn()) as { status?: string } | undefined;
      toast.success(ok, { description: `Chek #${r.id}` });
      if (onResolved) {
        onResolved({
          id: r.id,
          status: res?.status ?? (kind === 'reject' ? 'REJECTED' : 'APPROVED'),
        });
      } else {
        await reload();
      }
    } catch (e) {
      const msg = (e as Error).message;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const approve = () =>
    act(
      'approve',
      () =>
        adminApi(`/receipts/${r.id}/approve`, {
          method: 'POST',
          json: {
            amount: Number(amount.replace(/\s/g, '')),
            branchId: Number(branchId || r.branch?.id),
            ...(fm && { fm }),
            ...(num && { receiptNumber: num }),
            ...(fiscalAt && { fiscalAt }),
          },
        }),
      'Chek tasdiqlandi',
    );
  const reject = () =>
    act(
      'reject',
      () =>
        adminApi(`/receipts/${r.id}/reject`, {
          method: 'POST',
          json: { reason },
        }),
      'Chek rad etildi',
    );

  const pickCandidate = (c: SaleRec) =>
    setAmount(String(Math.round(Number(c.amount))));

  const approveDisabled = !!busy || !amount || !(branchId || r.branch);
  const rejectDisabled = !!busy || reason.trim().length < 2;
  // Tasdiqlangan chekni rad etish kuponlarni bekor qiladi — faqat shunda
  // tasdiq so'raymiz; navbatdagi cheklar uchun ortiqcha qadam yo'q.
  const onRejectClick = () =>
    r.status === 'APPROVED' ? setConfirmReject(true) : void reject();

  /* ---------- Bo'laklar ---------- */

  const header = <HeaderStrip r={r} />;

  const photo = <PhotoCard r={r} pane={pane} />;

  const decision = (
    <Card className={cn('@container/decision', !pane && 'lg:sticky lg:top-20')}>
      <CardHeader className="border-b">
        <CardTitle>Qaror</CardTitle>
        <CardDescription>
          {canApprove && canReject
            ? 'Summa va filialni tekshirib tasdiqlang yoki sababi bilan rad eting.'
            : canReject
              ? "Chek tasdiqlangan. Kerak bo'lsa rad etish mumkin — kuponlar bekor qilinadi."
              : canApprove
                ? "Chek rad etilgan. Qayta ko'rib, tasdiqlash mumkin."
                : "Bu chek bo'yicha amal talab qilinmaydi."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!canApprove && !canReject ? (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <RiInformationLine className="mt-0.5 size-4 shrink-0" />
            Amal yo&apos;q.
          </div>
        ) : (
          <Tabs defaultValue={canApprove ? 'approve' : 'reject'}>
            {canApprove && canReject && (
              <TabsList className="mb-2 w-full">
                <TabsTrigger value="approve">
                  <RiCheckboxCircleLine />
                  Tasdiqlash
                </TabsTrigger>
                <TabsTrigger value="reject">
                  <RiCloseCircleLine />
                  Rad etish
                </TabsTrigger>
              </TabsList>
            )}

            {canApprove && (
              <TabsContent value="approve">
                <FieldGroup className="gap-4">
                  <div className={cn('grid gap-4', '@md/decision:grid-cols-2')}>
                    <Field>
                      <FieldLabel htmlFor={`amount-${r.id}`}>Summa</FieldLabel>
                      <InputGroup className="h-10">
                        <InputGroupInput
                          id={`amount-${r.id}`}
                          value={groupDigits(amount)}
                          onChange={(e) =>
                            setAmount(onlyDigits(e.target.value))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !approveDisabled)
                              void approve();
                          }}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="0"
                          className="text-base font-medium tabular-nums"
                        />
                        <InputGroupAddon align="inline-end">
                          so&apos;m
                        </InputGroupAddon>
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`branch-${r.id}`}>Filial</FieldLabel>
                      <Select
                        items={branchItems}
                        value={branchValue || null}
                        onValueChange={(v) =>
                          setBranchId((v as string | null) ?? '')
                        }
                      >
                        <SelectTrigger
                          id={`branch-${r.id}`}
                          className="h-10! w-full"
                        >
                          <SelectValue placeholder="Filialni tanlang" />
                        </SelectTrigger>
                        <SelectContent>
                          {branchItems.map((b) => (
                            <SelectItem key={b.value} value={b.value}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {preview !== null && (
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                        preview > 0
                          ? 'bg-primary/5 text-foreground ring-1 ring-primary/15'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <RiTicket2Line
                        className={cn(
                          'size-4 shrink-0',
                          preview > 0 ? 'text-primary' : '',
                        )}
                      />
                      {preview > 0 ? (
                        <span>
                          <span className="font-semibold tabular-nums">
                            {preview} ta kupon
                          </span>{' '}
                          beriladi
                          {rule?.maxPerReceipt &&
                            preview === rule.maxPerReceipt && (
                              <span className="text-muted-foreground">
                                {' '}
                                (chek uchun maksimum)
                              </span>
                            )}
                        </span>
                      ) : (
                        <span>
                          Minimal summa {fmtSum(rule?.minSum)} — chek «Summa
                          kam» bo&apos;ladi
                        </span>
                      )}
                    </div>
                  )}

                  {needIds && (
                    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <RiErrorWarningLine className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        Chekda FM yoki raqam yo&apos;q — rasmdan kiriting
                        (takror ishlatilmasligi uchun).
                      </div>
                      <div className="grid gap-3 @sm/decision:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor={`fm-${r.id}`}>FM</FieldLabel>
                          <Input
                            id={`fm-${r.id}`}
                            value={fm}
                            onChange={(e) => setFm(e.target.value)}
                            placeholder={r.fm ?? 'UZ…'}
                            className="font-mono"
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`num-${r.id}`}>
                            Chek raqami
                          </FieldLabel>
                          <Input
                            id={`num-${r.id}`}
                            value={num}
                            onChange={(e) => setNum(e.target.value)}
                            placeholder={r.receiptNumber ?? ''}
                            inputMode="numeric"
                            className="font-mono"
                          />
                        </Field>
                        <Field className="@sm/decision:col-span-2">
                          <FieldLabel htmlFor={`fiscalAt-${r.id}`}>
                            Chek vaqti
                          </FieldLabel>
                          <DateTimePicker
                            id={`fiscalAt-${r.id}`}
                            value={fiscalAt}
                            onChange={setFiscalAt}
                            clearable
                          />
                        </Field>
                      </div>
                    </div>
                  )}

                  <Button
                    size="lg"
                    className="w-full"
                    disabled={approveDisabled}
                    onClick={approve}
                  >
                    {busy === 'approve' ? (
                      <RiLoader4Line
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <RiCheckLine data-icon="inline-start" />
                    )}
                    Tasdiqlash va kupon berish
                  </Button>
                </FieldGroup>
              </TabsContent>
            )}

            {canReject && (
              <TabsContent value="reject">
                <FieldGroup className="gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Tayyor sabablar
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {REJECT_PRESETS.map((p) => {
                        const on = reason === p;
                        return (
                          <Button
                            key={p}
                            variant="outline"
                            size="xs"
                            aria-pressed={on}
                            className={cn(
                              'h-auto min-h-7 rounded-full px-2.5 py-1 text-left font-normal whitespace-normal',
                              on &&
                                'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive',
                            )}
                            onClick={() => setReason(on ? '' : p)}
                          >
                            {on && <RiCheckLine data-icon="inline-start" />}
                            {p}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  <Field>
                    <FieldLabel htmlFor={`reason-${r.id}`}>Sabab</FieldLabel>
                    <Textarea
                      id={`reason-${r.id}`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="Sababni yozing…"
                    />
                    <FieldDescription>
                      Ishtirokchiga botda yuboriladi.
                    </FieldDescription>
                  </Field>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="w-full"
                    disabled={rejectDisabled}
                    onClick={onRejectClick}
                  >
                    {busy === 'reject' ? (
                      <RiLoader4Line
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <RiCloseCircleLine data-icon="inline-start" />
                    )}
                    Rad etish
                  </Button>
                </FieldGroup>
              </TabsContent>
            )}
          </Tabs>
        )}
        <ErrorAlert error={actionError} />
      </CardContent>

      <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Tasdiqlangan chekni rad etasizmi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bu chek uchun berilgan {r.coupons.length} ta kupon bekor qilinadi
              va ishtirokchiga xabar yuboriladi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              render={<Button variant="destructive" />}
              onClick={() => void reject()}
            >
              Rad etish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );

  const iiko = (
    <IikoCard
      r={r}
      amount={amount}
      canPick={canApprove}
      onPick={pickCandidate}
    />
  );

  const details = <DetailsCard r={r} />;
  const history = <HistoryCard r={r} />;

  if (pane) {
    return (
      <div className="@container/review flex flex-col gap-4">
        {header}
        {r.photoFileId ? (
          <div className="grid items-start gap-4 @2xl/review:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {photo}
            {decision}
          </div>
        ) : (
          <>
            {photo}
            {decision}
          </>
        )}
        {iiko}
        <div className="grid items-start gap-4 @3xl/review:grid-cols-2">
          {details}
          {history}
        </div>
      </div>
    );
  }

  return (
    <div className="@container/review flex flex-col gap-4">
      {header}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4 lg:order-2">{decision}</div>
        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          {photo}
          {iiko}
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {details}
            {history}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HeaderStrip({ r }: { r: Detail }) {
  const src = SOURCE[r.source];
  const SrcIcon = src?.icon ?? RiQrCodeLine;
  const name = [r.participant.firstName, r.participant.lastName]
    .filter(Boolean)
    .join(' ');
  const ini = initials(r.participant.firstName, r.participant.lastName);
  const rejected = r.status === 'REJECTED';

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={r.status} />
          <Badge variant="outline" className="gap-1 font-normal">
            <SrcIcon />
            {src?.label ?? r.source}
          </Badge>
          {r.participant.isStaff && (
            <Badge variant="secondary" className="font-normal">
              xodim
            </Badge>
          )}
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            #{r.id} · {fmtShort(r.createdAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              Summa
            </span>
            <div className="flex items-baseline gap-3">
              <span
                className={cn(
                  'text-3xl font-semibold tracking-tight tabular-nums',
                  !r.amount && 'text-xl font-medium text-muted-foreground',
                )}
              >
                {r.amount ? fmtSum(r.amount) : 'Kiritilmagan'}
              </span>
              {r.coupons.length > 0 && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                  <RiTicket2Line className="size-4" />
                  {r.coupons.length} kupon
                </span>
              )}
            </div>
          </div>

          <Link
            href={`/admin/participants/${r.participant.id}`}
            className="group flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-muted"
          >
            <Avatar>
              <AvatarFallback className="text-xs font-medium">
                {ini ?? <RiUser3Line className="size-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium tabular-nums group-hover:underline">
                {fmtPhone(r.participant.phone)}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {name ||
                  (r.participant.username && `@${r.participant.username}`) ||
                  "Ism yo'q"}
              </span>
            </span>
          </Link>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 @2xl/review:grid-cols-4">
          <Meta label="Chek №">
            <span
              className={cn(
                'font-mono',
                !r.receiptNumber && 'text-muted-foreground',
              )}
            >
              {r.receiptNumber ?? '—'}
            </span>
          </Meta>
          <Meta label="FM">
            <span
              className={cn(
                'font-mono text-xs',
                !r.fm && 'text-muted-foreground',
              )}
            >
              {r.fm ?? '—'}
            </span>
          </Meta>
          <Meta label="Filial">{r.branch?.name ?? '—'}</Meta>
          <Meta label="Chek vaqti">
            <span className="tabular-nums">{fmtDate(r.fiscalAt)}</span>
          </Meta>
        </dl>

        {r.rejectReason && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
              rejected
                ? 'border-destructive/30 bg-destructive/5 text-destructive'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
            )}
          >
            {rejected ? (
              <RiCloseCircleLine className="mt-0.5 size-4 shrink-0" />
            ) : (
              <RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                {rejected ? 'Rad etish sababi' : 'Tekshiruv sababi'}
              </span>
              <span className="text-foreground/80">{r.rejectReason}</span>
              {r.rejectCode && (
                <span className="font-mono text-xs opacity-70">
                  {r.rejectCode}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{children}</dd>
    </div>
  );
}

function PhotoCard({ r, pane }: { r: Detail; pane: boolean }) {
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  if (!r.photoFileId || failed) {
    const qr = r.source === 'QR';
    const Icon = qr ? RiQrScan2Line : RiImageLine;
    const title = failed ? 'Rasm yuklanmadi' : "Rasm yo'q";
    const text = failed
      ? "Telegram faylini olib bo'lmadi — keyinroq qayta urining."
      : qr
        ? 'Chek QR kod orqali kelgan, rasm yuborilmagan.'
        : 'Bu chek uchun rasm saqlanmagan.';
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-3 py-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-card text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{text}</span>
        </div>
      </div>
    );
  }

  const src = photoUrl(r.photoFileId);
  return (
    <Dialog onOpenChange={(o) => !o && setZoom(false)}>
      <Card size="sm" className="gap-0 p-0">
        <DialogTrigger
          aria-label="Rasmni kattalashtirish"
          className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Chek rasmi"
            onError={() => setFailed(true)}
            className={cn(
              'w-full object-contain',
              pane ? 'max-h-[360px]' : 'max-h-[460px]',
            )}
          />
          <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
            <RiZoomInLine className="size-3.5" />
            Kattalashtirish
          </span>
        </DialogTrigger>
      </Card>
      <DialogContent size="lg" className="gap-3 md:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Chek #{r.id} rasmi</DialogTitle>
          <DialogDescription>
            {fmtPhone(r.participant.phone)} · {fmtShort(r.createdAt)}
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            'overflow-auto rounded-lg bg-muted',
            zoom ? 'max-h-[72dvh] cursor-zoom-out' : 'cursor-zoom-in',
          )}
          onClick={() => setZoom((z) => !z)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Chek rasmi"
            className={cn(
              zoom
                ? 'max-w-none'
                : 'mx-auto max-h-[72dvh] w-full object-contain',
            )}
            style={zoom ? { width: '180%' } : undefined}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom((z) => !z)}
          >
            {zoom ? (
              <RiZoomOutLine data-icon="inline-start" />
            ) : (
              <RiZoomInLine data-icon="inline-start" />
            )}
            {zoom ? "Sig'dirish" : 'Kattalashtirish'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<a href={src} target="_blank" rel="noreferrer" />}
          >
            Yangi oynada
            <RiExternalLinkLine data-icon="inline-end" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IikoCard({
  r,
  amount,
  canPick,
  onPick,
}: {
  r: Detail;
  amount: string;
  canPick: boolean;
  onPick: (c: SaleRec) => void;
}) {
  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiStore2Line className="size-4 text-muted-foreground" />
          iiko savdo yozuvlari
          {r.candidates.length > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {r.candidates.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Shu chek raqami yoki filialda ±30 daqiqa ichida yopilgan cheklar.
          {canPick &&
            r.candidates.length > 0 &&
            ' Qatorni bosing — summa formaga tushadi.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {r.saleRecord && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-primary/5 px-3 py-2 text-sm ring-1 ring-primary/20">
            <RiLink className="size-4 text-primary" />
            <span className="font-medium text-primary">Bog&apos;langan</span>
            <span className="font-mono text-xs text-muted-foreground">
              #{r.saleRecord.id}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {fmtShort(r.saleRecord.closedAt)}
            </span>
            <span className="ml-auto font-medium tabular-nums">
              {fmtSum(r.saleRecord.amount)}
            </span>
            {r.saleRecord.isRefund && (
              <Badge variant="destructive">qaytarish</Badge>
            )}
          </div>
        )}
        {r.candidates.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
            <RiInformationLine className="size-4 shrink-0" />
            {r.fiscalAt
              ? 'Mos iiko yozuvi topilmadi.'
              : "Chek vaqti noma'lum — iiko bo'yicha qidirilmadi."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border [&_[data-slot=table-container]]:overflow-x-auto [&_td]:px-3 [&_td]:py-2 [&_th]:h-9 [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Yopilgan</TableHead>
                  <TableHead>Chek № · FM</TableHead>
                  <TableHead className="text-right">Summa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.candidates.map((c) => {
                  const picked =
                    amount !== '' &&
                    amount === String(Math.round(Number(c.amount)));
                  const match =
                    !!r.fm &&
                    !!r.receiptNumber &&
                    c.fm === r.fm &&
                    c.receiptNumber === r.receiptNumber;
                  return (
                    <TableRow
                      key={c.id}
                      tabIndex={canPick ? 0 : undefined}
                      data-state={picked ? 'selected' : undefined}
                      className={cn(
                        canPick && 'cursor-pointer',
                        match && !picked && 'bg-emerald-500/5',
                      )}
                      onClick={() => canPick && onPick(c)}
                      onKeyDown={(e) => {
                        if (canPick && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onPick(c);
                        }
                      }}
                    >
                      <TableCell className="whitespace-nowrap tabular-nums">
                        <span className="flex items-center gap-2">
                          {picked ? (
                            <RiCheckLine className="size-3.5 text-primary" />
                          ) : (
                            <span
                              className={cn(
                                'size-1.5 rounded-full',
                                match ? 'bg-emerald-500' : 'bg-border',
                              )}
                            />
                          )}
                          {fmtShort(c.closedAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-mono text-xs">
                            {c.receiptNumber ?? '—'}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.fm ?? ''}
                          </span>
                          {match && (
                            <Badge
                              variant="outline"
                              className="font-normal text-emerald-600 dark:text-emerald-400"
                            >
                              mos
                            </Badge>
                          )}
                          {c.isRefund && (
                            <Badge variant="destructive">qaytarish</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                        {fmtSum(c.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailsCard({ r }: { r: Detail }) {
  return (
    <Card size="sm" className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RiFileList3Line className="size-4 text-muted-foreground" />
          Tafsilotlar
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InfoList
          items={[
            { label: "Qo'shilgan", value: fmtDate(r.createdAt) },
            {
              label: 'Hal qilingan',
              value: (
                <>
                  {fmtDate(r.decidedAt)}
                  {r.reviewedBy && (
                    <span className="block text-xs text-muted-foreground">
                      {r.reviewedBy.login}
                    </span>
                  )}
                </>
              ),
            },
            {
              label: 'Fiskal belgi',
              value: (
                <span className="font-mono text-xs break-all">
                  {r.fiscalSign ?? '—'}
                </span>
              ),
            },
            {
              label: 'Kuponlar',
              value: r.coupons.length ? (
                <span className="flex flex-wrap gap-1">
                  {r.coupons.map((c) => (
                    <Badge
                      key={c.id}
                      variant={c.eligible ? 'secondary' : 'outline'}
                      className={cn(
                        'tabular-nums',
                        !c.eligible && 'text-muted-foreground line-through',
                      )}
                    >
                      <RiTicket2Line />№{c.id}
                    </Badge>
                  ))}
                </span>
              ) : (
                '—'
              ),
            },
          ]}
        />
        {r.rawUrl && (
          <a
            href={r.rawUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all text-primary hover:underline"
          >
            <RiExternalLinkLine className="mt-0.5 size-3.5 shrink-0" />
            {r.rawUrl}
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryCard({ r }: { r: Detail }) {
  return (
    <Card size="sm" className="gap-3">
      <Tabs defaultValue="audit" className="gap-3">
        <CardHeader className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="audit">
              <RiHistoryLine />
              Tarix
              <span className="text-xs text-muted-foreground tabular-nums">
                {r.audit.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="scans">
              <RiQrScan2Line />
              Skanerlash
              <span className="text-xs text-muted-foreground tabular-nums">
                {r.scans.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="audit">
            {r.audit.length === 0 ? (
              <EmptyState
                icon={RiHistoryLine}
                title="Tarix bo'sh"
                description="Moderator amallari shu yerda ko'rinadi."
                className="py-6"
              />
            ) : (
              <ol className="flex flex-col">
                {r.audit.map((a, i) => (
                  <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < r.audit.length - 1 && (
                      <span className="absolute top-5 bottom-0 left-[5px] w-px bg-border" />
                    )}
                    <span
                      className={cn(
                        'mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-card ring-1',
                        a.action === 'receipt.reject'
                          ? 'bg-red-500 ring-red-500/30'
                          : a.action === 'receipt.approve'
                            ? 'bg-emerald-500 ring-emerald-500/30'
                            : 'bg-primary ring-primary/30',
                      )}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                        <span className="font-medium">
                          {a.actor?.login ?? 'tizim'}
                        </span>
                        <span className="text-muted-foreground">
                          {AUDIT_ACTION[a.action] ?? a.action}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {fmtDate(a.createdAt)}
                        </span>
                      </div>
                      {a.data != null && (
                        <Collapsible>
                          <CollapsibleTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="xs"
                                className="group/c -ml-2 h-6 text-muted-foreground"
                              />
                            }
                          >
                            Batafsil
                            <RiArrowDownSLine
                              data-icon="inline-end"
                              className="transition-transform group-data-[panel-open]/c:rotate-180"
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <pre className="mt-1 max-h-56 overflow-auto rounded-md border bg-muted/50 p-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
                              {JSON.stringify(a.data, null, 2)}
                            </pre>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
          <TabsContent value="scans">
            {r.scans.length === 0 ? (
              <EmptyState
                icon={RiQrScan2Line}
                title="Skanerlash yo'q"
                description="Bot orqali skanerlash urinishlari shu yerda."
                className="py-6"
              />
            ) : (
              <ul className="flex flex-col divide-y">
                {r.scans.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm first:pt-0 last:pb-0"
                  >
                    <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {fmtShort(s.createdAt)}
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      {s.channel}
                    </Badge>
                    <span className="font-mono text-xs">{s.result}</span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

export function ReviewSkeleton({ variant = 'page' }: { variant?: string }) {
  const header = <Skeleton className="h-[188px] w-full rounded-xl" />;
  if (variant === 'pane')
    return (
      <div className="flex flex-col gap-4">
        {header}
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4 lg:order-2">
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <div className="flex flex-col gap-4 lg:order-1">
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
