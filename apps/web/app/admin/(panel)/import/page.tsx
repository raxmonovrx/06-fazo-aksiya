'use client';

import {
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiPlayLine,
  RiRefreshLine,
  RiSendPlaneLine,
} from '@remixicon/react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  ErrorAlert,
  PageToolbar,
  TableEmpty,
  TableLoading,
  useLoad,
} from '@/components/admin/kit';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { FilePicker } from '@/components/ui/file-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Mapping = Partial<
  Record<
    | 'amount'
    | 'closedAt'
    | 'date'
    | 'time'
    | 'fm'
    | 'receiptNumber'
    | 'branch'
    | 'refund',
    number
  >
>;
interface Preview {
  token: string;
  fileName: string;
  headers: string[];
  sample: unknown[][];
  totalRows: number;
  mapping: Mapping;
}
interface Report {
  checked: number;
  approved: number;
  belowMin: number;
  refunded: number;
  review: number;
  notFound: number;
}
interface Result {
  batchId: number;
  rows: number;
  inserted: number;
  duplicates: number;
  matched: number;
  errors: Array<{ row: number; error: string }>;
  reconcile: Report;
}
interface Batch {
  id: number;
  source: string;
  fileName: string | null;
  periodFrom: string | null;
  periodTo: string | null;
  rows: number;
  matched: number;
  createdAt: string;
  createdBy: { login: string } | null;
}

const FIELDS: Array<{
  key: keyof Mapping;
  label: string;
  hint?: string;
  required?: boolean;
}> = [
  {
    key: 'amount',
    label: 'Summa *',
    required: true,
    hint: 'Chegirmadan keyingi summa',
  },
  {
    key: 'closedAt',
    label: 'Yopilish sana-vaqti',
    hint: 'Yoki pastda alohida sana + vaqt',
  },
  { key: 'date', label: 'Sana (alohida)' },
  { key: 'time', label: 'Vaqt (alohida)' },
  {
    key: 'receiptNumber',
    label: 'Fiskal chek raqami',
    hint: 'QR dagi r= bilan bir xil raqam',
  },
  {
    key: 'fm',
    label: 'FM (fiskal modul)',
    hint: "Bo'lmasa — filial + vaqt bo'yicha moslanadi",
  },
  { key: 'branch', label: 'Filial / department' },
  {
    key: 'refund',
    label: 'Qaytarish belgisi',
    hint: 'Manfiy summa ham qaytarish hisoblanadi',
  },
];

// Base UI Select'da bo'sh qiymat o'rniga
const NONE = '__none';

const REPORT_ITEMS: Array<{ key: keyof Report; label: string; cls?: string }> =
  [
    { key: 'checked', label: 'Tekshirildi' },
    {
      key: 'approved',
      label: 'Tasdiqlandi',
      cls: 'text-emerald-600 dark:text-emerald-400',
    },
    { key: 'belowMin', label: 'Summa kam' },
    { key: 'refunded', label: 'Qaytarilgan' },
    { key: 'review', label: 'Moderatsiyaga' },
    { key: 'notFound', label: 'Topilmadi' },
  ];

/** Solishtirish hisoboti — raqamlar to'ri */
function ReportGrid({ report }: { report: Report }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {REPORT_ITEMS.map((i) => (
        <div key={i.key} className="rounded-lg border bg-muted/30 px-3 py-2">
          <div className="text-xs text-muted-foreground">{i.label}</div>
          <div
            className={cn(
              'text-lg font-semibold tabular-nums',
              i.cls && report[i.key] > 0 && i.cls,
            )}
          >
            {report[i.key]}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Raqamli qadam sarlavhasi */
function StepTitle({
  n,
  done,
  children,
}: {
  n: number;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <span
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
          done
            ? 'bg-primary text-primary-foreground'
            : 'bg-primary/10 text-primary',
        )}
      >
        {done ? <RiCheckLine className="size-3.5" /> : n}
      </span>
      {children}
    </CardTitle>
  );
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [branchId, setBranchId] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [runReport, setRunReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmNotify, setConfirmNotify] = useState(false);
  const branches = useLoad(
    () => adminApi<Array<{ id: number; name: string }>>('/branches'),
    [],
  );
  const batches = useLoad(() => adminApi<Batch[]>('/import/batches'), []);

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File) =>
    wrap(async () => {
      setResult(null);
      const fd = new FormData();
      fd.append('file', file);
      const p = await adminApi<Preview>('/import/preview', {
        method: 'POST',
        body: fd,
      });
      setPreview(p);
      setMapping(
        Object.fromEntries(
          Object.entries(p.mapping).filter(
            ([, v]) => v !== undefined && v !== null,
          ),
        ) as Mapping,
      );
    });

  const commit = () =>
    wrap(async () => {
      const res = await adminApi<Result>('/import/commit', {
        method: 'POST',
        json: {
          token: preview!.token,
          mapping,
          defaultBranchId: branchId ? Number(branchId) : null,
        },
      });
      setResult(res);
      setPreview(null);
      toast.success(`Import tugadi: ${res.inserted} ta yangi qator`);
      await batches.reload();
    });

  const notifyNow = () =>
    wrap(async () => {
      const r = await adminApi<{
        queued: number;
        sent: number;
        failed: number;
        blocked: number;
      }>('/jobs/notify', { method: 'POST' });
      toast.success(
        `Xabarlar: navbatga ${r.queued}, yuborildi ${r.sent}, bot bloklangan ${r.blocked}, xato ${r.failed}`,
      );
    });

  const reconcileNow = () =>
    wrap(async () => {
      setRunReport(
        await adminApi<Report>('/reconcile/run', { method: 'POST' }),
      );
    });

  const setField = (key: keyof Mapping, v: string) => {
    const next = { ...mapping };
    if (v === NONE) delete next[key];
    else next[key] = Number(v);
    setMapping(next);
  };

  const headerItems = [
    { value: NONE, label: '—' },
    ...(preview?.headers.map((h, i) => ({ value: String(i), label: h })) ?? []),
  ];
  const branchItems = [
    { value: NONE, label: '—' },
    ...(branches.data?.map((b) => ({ value: String(b.id), label: b.name })) ??
      []),
  ];

  const missingAmount = mapping.amount === undefined;
  const missingDate =
    mapping.closedAt === undefined && mapping.date === undefined;
  const canCommit = !!preview && !busy && !missingAmount && !missingDate;

  return (
    <>
      <PageToolbar description="iiko savdo hisobotini yuklang, ustunlarni moslang — tizim cheklarni avtomatik solishtiradi.">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setConfirmNotify(true)}
        >
          <RiSendPlaneLine data-icon="inline-start" />
          Xabarlarni hozir yuborish
        </Button>
        <Button variant="outline" disabled={busy} onClick={reconcileNow}>
          <RiRefreshLine data-icon="inline-start" />
          Hozir solishtirish
        </Button>
      </PageToolbar>

      <ErrorAlert error={error} />

      {runReport && (
        <Card>
          <CardHeader>
            <CardTitle>Solishtirish natijasi</CardTitle>
            <CardDescription>
              Qo&apos;lda ishga tushirilgan solishtirish
            </CardDescription>
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRunReport(null)}
              >
                Yopish
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ReportGrid report={runReport} />
          </CardContent>
        </Card>
      )}

      {/* 1-qadam: fayl tanlash */}
      <Card>
        <CardHeader>
          <StepTitle n={1} done={!!preview || !!result}>
            Fayl tanlash
          </StepTitle>
          <CardDescription>
            iikoOffice → Отчеты → OLAP-отчет по продажам. Kerakli ustunlar:
            fiskal chek raqami, FM (yoki kassa), yopilish vaqti, summa. Bir
            faylni qayta yuklash xavfsiz — takror yozuvlar o&apos;tkazib
            yuboriladi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FilePicker
            value={file}
            accept=".xlsx,.csv,.txt"
            hint="xlsx yoki csv"
            disabled={busy}
            onChange={(f) => {
              setFile(f);
              if (f) void upload(f);
            }}
          />
          {busy && !preview && file && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <RiLoader4Line className="size-3.5 animate-spin" />
              Fayl o&apos;qilmoqda…
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2-qadam: ustunlarni moslash */}
      <Card className={cn(!preview && 'opacity-60')}>
        <CardHeader>
          <StepTitle n={2} done={!!result && !preview}>
            Ustunlarni moslash
          </StepTitle>
          <CardDescription>
            {preview ? (
              <>
                {preview.fileName} ·{' '}
                <span className="tabular-nums">{preview.totalRows}</span> qator.
                Har bir maydon uchun fayldagi ustunni tanlang.
              </>
            ) : (
              "Fayl yuklangach, ustunlar shu yerda ko'rinadi."
            )}
          </CardDescription>
        </CardHeader>
        {preview && (
          <CardContent className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {FIELDS.map((f) => {
                const v = mapping[f.key];
                return (
                  <Field key={f.key}>
                    <FieldLabel htmlFor={`map-${f.key}`}>{f.label}</FieldLabel>
                    <Select
                      items={headerItems}
                      value={v === undefined ? NONE : String(v)}
                      onValueChange={(val) =>
                        setField(f.key, (val as string | null) ?? NONE)
                      }
                    >
                      <SelectTrigger id={`map-${f.key}`} className="w-full">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {headerItems.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {f.hint && <FieldDescription>{f.hint}</FieldDescription>}
                  </Field>
                );
              })}
              <Field>
                <FieldLabel htmlFor="map-branch-default">
                  Filial (ustun bo&apos;lmasa)
                </FieldLabel>
                <Select
                  items={branchItems}
                  value={branchId || NONE}
                  onValueChange={(val) => {
                    const s = (val as string | null) ?? NONE;
                    setBranchId(s === NONE ? '' : s);
                  }}
                >
                  <SelectTrigger id="map-branch-default" className="w-full">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchItems.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Butun fayl shu filialga tegishli
                </FieldDescription>
              </Field>
            </div>

            <div className="grid gap-2">
              <div className="text-sm font-medium">Namuna</div>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.headers.map((h, i) => {
                        const used = Object.entries(mapping).find(
                          ([, v]) => v === i,
                        )?.[0];
                        const label = FIELDS.find(
                          (f) => f.key === used,
                        )?.label.replace(' *', '');
                        return (
                          <TableHead key={i} className="align-top">
                            <div className="flex flex-col gap-1 py-1">
                              <span>{h}</span>
                              {label && (
                                <Badge
                                  variant="secondary"
                                  className="w-fit bg-primary/10 text-primary"
                                >
                                  ← {label}
                                </Badge>
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.sample.length === 0 ? (
                      <TableEmpty colSpan={preview.headers.length || 1} />
                    ) : (
                      preview.sample.map((row, i) => (
                        <TableRow key={i}>
                          {preview.headers.map((_, j) => (
                            <TableCell key={j} className="whitespace-nowrap">
                              {String(row[j] ?? '')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 3-qadam: import va solishtirish */}
      <Card className={cn(!preview && !result && 'opacity-60')}>
        <CardHeader>
          <StepTitle n={3} done={!!result && !preview}>
            Import va solishtirish
          </StepTitle>
          <CardDescription>
            Qatorlar bazaga yoziladi, cheklarga bog&apos;lanadi va darhol
            solishtiriladi.
          </CardDescription>
        </CardHeader>
        {preview && (
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button disabled={!canCommit} onClick={commit}>
              {busy ? (
                <RiLoader4Line
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <RiPlayLine data-icon="inline-start" />
              )}
              {busy ? 'Import qilinmoqda…' : 'Import qilish va solishtirish'}
            </Button>
            {(missingAmount || missingDate) && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RiErrorWarningLine className="size-3.5" />
                {missingAmount
                  ? '«Summa» ustunini tanlang'
                  : '«Yopilish sana-vaqti» yoki «Sana» ustunini tanlang'}
              </span>
            )}
          </CardContent>
        )}
        {result && (
          <>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Qatorlar', value: result.rows },
                  { label: 'Yangi', value: result.inserted },
                  { label: 'Takror', value: result.duplicates },
                  { label: "Cheklarga bog'landi", value: result.matched },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <div className="text-xs text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium">Solishtirish</div>
                <ReportGrid report={result.reconcile} />
              </div>
              {result.errors.length > 0 && (
                <div className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <div className="font-medium">
                    O&apos;qilmagan qatorlar ({result.errors.length})
                  </div>
                  <ul className="grid gap-0.5 text-xs">
                    {result.errors.slice(0, 10).map((e) => (
                      <li key={e.row}>
                        {e.row}-qator: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              Partiya #{result.batchId}
            </CardFooter>
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Importlar tarixi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Manba</TableHead>
                  <TableHead>Fayl</TableHead>
                  <TableHead>Davr</TableHead>
                  <TableHead className="text-right">Qatorlar</TableHead>
                  <TableHead className="text-right">Bog&apos;landi</TableHead>
                  <TableHead>Kim</TableHead>
                  <TableHead>Qachon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.loading && !batches.data ? (
                  <TableLoading colSpan={8} rows={3} />
                ) : !batches.data?.length ? (
                  <TableEmpty colSpan={8}>Hali import qilinmagan</TableEmpty>
                ) : (
                  batches.data.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {b.id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.source}</Badge>
                      </TableCell>
                      <TableCell className="max-w-56 truncate">
                        {b.fileName ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {fmtDate(b.periodFrom, false)} –{' '}
                        {fmtDate(b.periodTo, false)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.rows}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.matched}
                      </TableCell>
                      <TableCell>{b.createdBy?.login ?? 'cron'}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {fmtDate(b.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmNotify} onOpenChange={setConfirmNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xabarlarni hozir yuborish</AlertDialogTitle>
            <AlertDialogDescription>
              Kechagi natijalar mijozlarga hozir yuborilsinmi? (Odatda har kuni
              09:00 da avtomatik)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction onClick={() => void notifyNow()}>
              Yuborish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
