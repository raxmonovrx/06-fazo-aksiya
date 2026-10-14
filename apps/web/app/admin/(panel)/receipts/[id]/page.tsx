'use client';

import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiHistoryLine,
  RiImageLine,
  RiInformationLine,
  RiQrScan2Line,
  RiStore2Line,
  RiTicket2Line,
} from '@remixicon/react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  ErrorAlert,
  InfoList,
  StatusBadge,
  useLoad,
} from '@/components/admin/kit';
import { usePageHeader } from '@/components/page-header';
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
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/api';
import { fmtDate, fmtSum } from '@/lib/format';
import { cn } from '@/lib/utils';

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

const REJECT_PRESETS = [
  "Chek o'qilmaydi / QR yo'q",
  'Fiskal chek emas (prechek)',
  'Aksiyadagi filialga tegishli emas',
  "Chek muddati o'tgan",
  'Soxta yoki takroriy chek',
];

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  usePageHeader({ title: `Chek #${id}`, backHref: '/admin/receipts' });
  const {
    data: r,
    error,
    reload,
  } = useLoad(() => adminApi<Detail>(`/receipts/${id}`), [id]);
  const branches = useLoad(
    () => adminApi<Array<{ id: number; name: string }>>('/branches'),
    [],
  );
  const [amount, setAmount] = useState('');
  const [branchId, setBranchId] = useState('');
  const [fm, setFm] = useState('');
  const [num, setNum] = useState('');
  const [fiscalAt, setFiscalAt] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <ErrorAlert error={error} />;
  if (!r) return <DetailSkeleton />;

  const canApprove = r.status !== 'APPROVED' && r.coupons.length === 0;
  const canReject = r.status !== 'REJECTED';
  const needIds = !r.fm || !r.receiptNumber;
  const branchValue = branchId || String(r.branch?.id ?? '');
  const branchItems = (branches.data ?? []).map((b) => ({
    value: String(b.id),
    label: b.name,
  }));
  const participantName = [r.participant.firstName, r.participant.lastName]
    .filter(Boolean)
    .join(' ');

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      toast.success(ok);
      await reload();
    } catch (e) {
      const msg = (e as Error).message;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const approve = () =>
    act(
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
      () =>
        adminApi(`/receipts/${r.id}/reject`, {
          method: 'POST',
          json: { reason },
        }),
      'Chek rad etildi',
    );

  const pickCandidate = (c: SaleRec) =>
    setAmount(String(Math.round(Number(c.amount))));

  return (
    <div className="flex flex-col gap-4">
      {/* Qisqa xulosa: holat va asosiy raqamlar */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.status} />
            {r.participant.isStaff && <Badge variant="outline">xodim</Badge>}
            <span className="text-xs text-muted-foreground">
              {r.source} · {fmtDate(r.createdAt)}
            </span>
          </div>
          {r.rejectReason && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <RiCloseCircleLine className="mt-0.5 size-4 shrink-0" />
              <span>{r.rejectReason}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-6">
            <Summary label="Summa">
              <span className="text-lg font-semibold tabular-nums">
                {fmtSum(r.amount)}
              </span>
            </Summary>
            <Summary label="Kuponlar">
              <span className="text-lg font-semibold tabular-nums">
                {r.coupons.length}
              </span>
            </Summary>
            <Summary label="Filial">{r.branch?.name ?? '—'}</Summary>
            <Summary label="Chek raqami">
              <span className="font-mono">{r.receiptNumber ?? '—'}</span>
            </Summary>
            <Summary label="Chek vaqti">{fmtDate(r.fiscalAt)}</Summary>
            <Summary label="Hal qilingan">
              {fmtDate(r.decidedAt)}
              {r.reviewedBy && (
                <span className="block text-xs text-muted-foreground">
                  {r.reviewedBy.login}
                </span>
              )}
            </Summary>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Amallar — mobil'da tepada, katta ekranda o'ngda yopishqoq */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:order-2">
          {canApprove && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiCheckboxCircleLine className="size-4 text-primary" />
                  Tasdiqlash
                </CardTitle>
                <CardDescription>
                  Summani kiriting yoki iiko jadvalidan qatorni tanlang.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel htmlFor="amount">Summa (so&apos;m)</FieldLabel>
                    <Input
                      id="amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="numeric"
                      placeholder="0"
                      className="tabular-nums"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="branch">Filial</FieldLabel>
                    <Select
                      items={branchItems}
                      value={branchValue || null}
                      onValueChange={(v) =>
                        setBranchId((v as string | null) ?? '')
                      }
                    >
                      <SelectTrigger id="branch" className="w-full">
                        <SelectValue placeholder="— tanlang —" />
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
                  {needIds && (
                    <>
                      <Separator />
                      <Field>
                        <FieldLabel htmlFor="fm">FM</FieldLabel>
                        <Input
                          id="fm"
                          value={fm}
                          onChange={(e) => setFm(e.target.value)}
                          className="font-mono"
                        />
                        <FieldDescription>
                          Chekdan — takror ishlatilmasligi uchun
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="num">Chek raqami</FieldLabel>
                        <Input
                          id="num"
                          value={num}
                          onChange={(e) => setNum(e.target.value)}
                          inputMode="numeric"
                          className="font-mono"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="fiscalAt">Chek vaqti</FieldLabel>
                        <DateTimePicker
                          id="fiscalAt"
                          value={fiscalAt}
                          onChange={setFiscalAt}
                          clearable
                        />
                      </Field>
                    </>
                  )}
                  <Button
                    className="w-full"
                    disabled={busy || !amount || !(branchId || r.branch)}
                    onClick={approve}
                  >
                    <RiCheckboxCircleLine data-icon="inline-start" />
                    Tasdiqlash va kupon berish
                  </Button>
                </FieldGroup>
              </CardContent>
            </Card>
          )}

          {canReject && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiCloseCircleLine className="size-4 text-destructive" />
                  Rad etish
                </CardTitle>
                <CardDescription>
                  Tayyor sababni tanlang yoki o&apos;zingiz yozing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-4">
                  <div className="flex flex-wrap gap-1.5">
                    {REJECT_PRESETS.map((p) => (
                      <Button
                        key={p}
                        variant={reason === p ? 'secondary' : 'outline'}
                        size="xs"
                        className="h-auto min-h-6 rounded-full py-1 text-left whitespace-normal"
                        onClick={() => setReason(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                  <Field>
                    <FieldLabel htmlFor="reason">
                      Sabab (mijozga ko&apos;rinadi)
                    </FieldLabel>
                    <Textarea
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                    />
                  </Field>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={busy || reason.trim().length < 2}
                    onClick={reject}
                  >
                    <RiCloseCircleLine data-icon="inline-start" />
                    Rad etish
                  </Button>
                </FieldGroup>
              </CardContent>
            </Card>
          )}

          {!canApprove && !canReject && (
            <Card size="sm">
              <CardContent className="flex items-start gap-2 text-sm text-muted-foreground">
                <RiInformationLine className="mt-0.5 size-4 shrink-0" />
                Bu chek bo&apos;yicha amal talab qilinmaydi.
              </CardContent>
            </Card>
          )}

          <ErrorAlert error={actionError} />
        </aside>

        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiFileList3Line className="size-4 text-muted-foreground" />
                  Ma&apos;lumot
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <InfoList
                  items={[
                    {
                      label: 'Ishtirokchi',
                      value: (
                        <>
                          <Link
                            href={`/admin/participants/${r.participant.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {r.participant.phone}
                          </Link>
                          {(participantName || r.participant.username) && (
                            <span className="block text-xs text-muted-foreground">
                              {participantName}{' '}
                              {r.participant.username &&
                                `@${r.participant.username}`}
                            </span>
                          )}
                        </>
                      ),
                    },
                    { label: 'Manba', value: r.source },
                    {
                      label: 'FM',
                      value: <span className="font-mono">{r.fm ?? '—'}</span>,
                    },
                    {
                      label: 'Fiskal belgi',
                      value: (
                        <span className="font-mono break-all">
                          {r.fiscalSign ?? '—'}
                        </span>
                      ),
                    },
                    { label: "Qo'shilgan", value: fmtDate(r.createdAt) },
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
                                !c.eligible &&
                                  'text-muted-foreground line-through',
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiImageLine className="size-4 text-muted-foreground" />
                  Chek rasmi
                </CardTitle>
                {r.photoFileId && (
                  <CardAction>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Rasmni ochish"
                      nativeButton={false}
                      render={
                        <a
                          href={`/api/admin/photos/${r.photoFileId}`}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <RiExternalLinkLine />
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                {r.photoFileId ? (
                  <a
                    href={`/api/admin/photos/${r.photoFileId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/admin/photos/${r.photoFileId}`}
                      alt="chek"
                      className="max-h-[480px] w-full object-contain"
                    />
                  </a>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
                    <RiQrScan2Line className="size-6 opacity-60" />
                    Rasm yo&apos;q (QR orqali kelgan)
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RiStore2Line className="size-4 text-muted-foreground" />
                iiko ma&apos;lumoti (savdo yozuvlari)
              </CardTitle>
              <CardDescription>
                Shu chek raqami yoki filialda ±30 daqiqa ichida yopilgan
                cheklar.
                {canApprove && ' Qatorni bosing — summa formaga tushadi.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {r.saleRecord && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-primary/5 px-3 py-2 text-sm ring-1 ring-primary/20">
                  <span className="font-medium text-primary">
                    Bog&apos;langan:
                  </span>
                  <span>#{r.saleRecord.id}</span>
                  <span className="text-muted-foreground">
                    {fmtDate(r.saleRecord.closedAt)}
                  </span>
                  <span className="font-medium tabular-nums">
                    {fmtSum(r.saleRecord.amount)}
                  </span>
                  {r.saleRecord.isRefund && (
                    <Badge variant="destructive">qaytarish</Badge>
                  )}
                </div>
              )}
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead>ID</TableHead>
                      <TableHead>Manba</TableHead>
                      <TableHead>FM</TableHead>
                      <TableHead>Chek №</TableHead>
                      <TableHead>Yopilgan</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.candidates.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={7}
                          className="h-24 text-center text-sm text-muted-foreground"
                        >
                          Mos chek topilmadi
                        </TableCell>
                      </TableRow>
                    ) : (
                      r.candidates.map((c) => {
                        const picked =
                          amount !== '' &&
                          amount === String(Math.round(Number(c.amount)));
                        return (
                          <TableRow
                            key={c.id}
                            tabIndex={0}
                            data-state={picked ? 'selected' : undefined}
                            className="cursor-pointer"
                            onClick={() => pickCandidate(c)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                pickCandidate(c);
                              }
                            }}
                          >
                            <TableCell className="text-muted-foreground">
                              #{c.id}
                            </TableCell>
                            <TableCell>{c.source}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {c.fm ?? '—'}
                            </TableCell>
                            <TableCell className="font-mono">
                              {c.receiptNumber ?? '—'}
                            </TableCell>
                            <TableCell>{fmtDate(c.closedAt)}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {fmtSum(c.amount)}
                            </TableCell>
                            <TableCell>
                              {c.isRefund && (
                                <Badge variant="destructive">qaytarish</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiHistoryLine className="size-4 text-muted-foreground" />
                  Audit
                </CardTitle>
              </CardHeader>
              <CardContent>
                {r.audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Yo&apos;q</p>
                ) : (
                  <ol className="relative flex flex-col gap-4 border-l pl-4">
                    {r.audit.map((a) => (
                      <li key={a.id} className="relative flex flex-col gap-1">
                        <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary ring-4 ring-card" />
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <Badge variant="outline" className="font-mono">
                            {a.action}
                          </Badge>
                          <span className="font-medium">
                            {a.actor?.login ?? 'tizim'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(a.createdAt)}
                          </span>
                        </div>
                        <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground">
                          {JSON.stringify(a.data, null, 1)}
                        </pre>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiQrScan2Line className="size-4 text-muted-foreground" />
                  Skanerlash jurnali
                </CardTitle>
              </CardHeader>
              <CardContent>
                {r.scans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Yo&apos;q</p>
                ) : (
                  <ul className="flex flex-col divide-y">
                    {r.scans.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm first:pt-0 last:pb-0"
                      >
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {fmtDate(s.createdAt)}
                        </span>
                        <Badge variant="secondary">{s.channel}</Badge>
                        <span className="font-mono text-xs">{s.result}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Summary({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm break-words">{children}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4 lg:order-1">
          <div className="grid gap-4 xl:grid-cols-2">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <div className="flex flex-col gap-4 lg:order-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
