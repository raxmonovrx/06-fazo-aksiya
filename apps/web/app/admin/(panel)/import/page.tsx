'use client';

import {
  RiArrowDownSLine,
  RiArrowLeftLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiFileExcel2Line,
  RiHistoryLine,
  RiInformationLine,
  RiLoader4Line,
  RiPlayLine,
  RiRefreshLine,
  RiSendPlaneLine,
  RiUploadCloud2Line,
} from '@remixicon/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { DataTableCard } from '@/components/admin/data-table';
import {
  ErrorAlert,
  StatCard,
  TableLoading,
  useLoad,
} from '@/components/admin/kit';
import {
  EmptyState,
  PageContainer,
  PageIntro,
} from '@/components/admin/layout';
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { fmtDate, fmtShort } from '@/lib/format';
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

type Action = 'upload' | 'commit' | 'reconcile' | 'notify';

const ACCEPT = '.xlsx,.csv,.txt';

const FIELDS: Array<{
  key: keyof Mapping;
  label: string;
  hint?: string;
  required?: boolean;
}> = [
  {
    key: 'amount',
    label: 'Summa',
    required: true,
    hint: 'Chegirmadan keyingi summa',
  },
  {
    key: 'closedAt',
    label: 'Yopilish sana-vaqti',
    hint: 'Yoki alohida sana + vaqt',
  },
  { key: 'date', label: 'Sana (alohida)' },
  { key: 'time', label: 'Vaqt (alohida)' },
  {
    key: 'receiptNumber',
    label: 'Fiskal chek raqami',
    hint: 'QR dagi r= bilan bir xil',
  },
  {
    key: 'fm',
    label: 'FM (fiskal modul)',
    hint: "Bo'lmasa — filial + vaqt bo'yicha",
  },
  { key: 'branch', label: 'Filial / department' },
  {
    key: 'refund',
    label: 'Qaytarish belgisi',
    hint: 'Manfiy summa ham qaytarish',
  },
];

const FIELD_LABEL = Object.fromEntries(
  FIELDS.map((f) => [f.key, f.label]),
) as Record<keyof Mapping, string>;

const REQUIRED_COLUMNS = [
  'Fiskal chek raqami',
  'FM yoki kassa',
  'Yopilish vaqti',
  'Summa',
];

const SOURCE_LABEL: Record<string, string> = {
  IIKO_API: 'iiko API',
  EXCEL: 'Excel',
};

// Base UI Select'da bo'sh qiymat o'rniga
const NONE = '__none';

const REPORT_ITEMS: Array<{ key: keyof Report; label: string; dot: string }> = [
  { key: 'checked', label: 'Tekshirildi', dot: 'bg-muted-foreground/50' },
  { key: 'approved', label: 'Tasdiqlandi', dot: 'bg-emerald-500' },
  { key: 'belowMin', label: 'Summa kam', dot: 'bg-muted-foreground/50' },
  { key: 'refunded', label: 'Qaytarilgan', dot: 'bg-red-500' },
  { key: 'review', label: 'Moderatsiyaga', dot: 'bg-sky-500' },
  { key: 'notFound', label: 'Topilmadi', dot: 'bg-orange-500' },
];

/** Solishtirish hisoboti — ixcham raqamlar to'ri */
function ReportGrid({ report }: { report: Report }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 md:grid-cols-6">
      {REPORT_ITEMS.map((i) => (
        <div key={i.key} className="grid gap-1 bg-card px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-1.5 shrink-0 rounded-full', i.dot)} />
            {i.label}
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {report[i.key]}
          </span>
        </div>
      ))}
    </div>
  );
}

const STEPS = ['Fayl', 'Ustunlar', 'Natija'];

/** Gorizontal qadamlar: 1 Fayl → 2 Ustunlar → 3 Natija */
function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 border-b px-4 py-3 sm:gap-3">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current || (n === 3 && current === 3);
        const active = n === current;
        return (
          <li
            key={label}
            className="flex min-w-0 items-center gap-2 sm:gap-3"
            aria-current={active ? 'step' : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  'h-px w-5 shrink-0 sm:w-10',
                  n <= current ? 'bg-primary/60' : 'bg-border',
                )}
              />
            )}
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors',
                done
                  ? 'bg-primary text-primary-foreground'
                  : active
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/15'
                    : 'border bg-muted text-muted-foreground',
              )}
            >
              {done ? <RiCheckLine className="size-3.5" /> : n}
            </span>
            <span
              className={cn(
                'truncate text-sm',
                active ? 'font-medium' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Katta drag & drop maydoni (brauzer fayl oynasi dasturiy ochiladi) */
function Dropzone({
  busy,
  fileName,
  onFile,
}: {
  busy: boolean;
  fileName?: string;
  onFile: (f: File) => void;
}) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const pick = () => {
    if (busy) return;
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = ACCEPT;
    el.onchange = () => {
      const f = el.files?.[0];
      if (f) onFile(f);
    };
    el.click();
  };

  return (
    <div
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-disabled={busy}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        if (!busy) setOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current -= 1;
        if (depth.current <= 0) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f && !busy) onFile(f);
      }}
      className={cn(
        'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors outline-none',
        'hover:border-primary/50 hover:bg-muted/40 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50',
        over && 'border-primary bg-primary/5',
        busy && 'pointer-events-none cursor-default',
      )}
    >
      <span
        className={cn(
          'grid size-12 place-items-center rounded-xl border bg-card text-muted-foreground shadow-xs transition-colors',
          (over || busy) && 'border-primary/30 text-primary',
          'group-hover:text-primary',
        )}
      >
        {busy ? (
          <RiLoader4Line className="size-6 animate-spin" />
        ) : (
          <RiUploadCloud2Line className="size-6" />
        )}
      </span>
      {busy ? (
        <div className="grid gap-1">
          <p className="text-sm font-medium">Fayl o&apos;qilmoqda…</p>
          <p className="max-w-xs truncate text-xs text-muted-foreground">
            {fileName}
          </p>
        </div>
      ) : (
        <div className="grid gap-1">
          <p className="text-sm font-medium">
            Faylni shu yerga tashlang yoki{' '}
            <span className="text-primary underline-offset-4 group-hover:underline">
              tanlang
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            XLSX yoki CSV · iiko savdo hisoboti
          </p>
        </div>
      )}
    </div>
  );
}

/** «Qaysi fayl kerak?» — yig'iladigan yordam */
function FileHelp() {
  return (
    <Collapsible className="rounded-lg border bg-muted/30">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50">
        <RiInformationLine className="size-4 text-muted-foreground" />
        Qaysi fayl kerak?
        <RiArrowDownSLine className="ml-auto size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 border-t px-3 py-3 text-sm">
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">
            iikoOffice&apos;dagi hisobot
          </span>
          <code className="w-fit rounded-md border bg-background px-2 py-1 font-mono text-xs break-all">
            iikoOffice → Отчеты → OLAP-отчет по продажам
          </code>
        </div>
        <div className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">
            Kerakli ustunlar
          </span>
          <div className="flex flex-wrap gap-1.5">
            {REQUIRED_COLUMNS.map((c) => (
              <Badge key={c} variant="outline">
                {c}
              </Badge>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Bir faylni qayta yuklash xavfsiz — takror qatorlar o&apos;tkazib
          yuboriladi.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [autoMapping, setAutoMapping] = useState<Mapping>({});
  const [mapping, setMapping] = useState<Mapping>({});
  const [branchId, setBranchId] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [runReport, setRunReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [confirmNotify, setConfirmNotify] = useState(false);
  const branches = useLoad(
    () => adminApi<Array<{ id: number; name: string }>>('/branches'),
    [],
  );
  const batches = useLoad(() => adminApi<Batch[]>('/import/batches'), []);

  const busy = action !== null;
  const step = preview ? 2 : result ? 3 : 1;

  const wrap = async (a: Action, fn: () => Promise<void>) => {
    setAction(a);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAction(null);
    }
  };

  const upload = (file: File) =>
    wrap('upload', async () => {
      setResult(null);
      const fd = new FormData();
      fd.append('file', file);
      const p = await adminApi<Preview>('/import/preview', {
        method: 'POST',
        body: fd,
      });
      const auto = Object.fromEntries(
        Object.entries(p.mapping).filter(
          ([, v]) => v !== undefined && v !== null,
        ),
      ) as Mapping;
      setPreview(p);
      setAutoMapping(auto);
      setMapping(auto);
    });

  const commit = () =>
    wrap('commit', async () => {
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
    wrap('notify', async () => {
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
    wrap('reconcile', async () => {
      setRunReport(
        await adminApi<Report>('/reconcile/run', { method: 'POST' }),
      );
    });

  const reset = () => {
    setPreview(null);
    setResult(null);
    setFile(null);
    setMapping({});
    setAutoMapping({});
    setBranchId('');
    setError(null);
  };

  const onFile = (f: File) => {
    setFile(f);
    void upload(f);
  };

  const setField = (key: keyof Mapping, v: string) => {
    const next = { ...mapping };
    if (v === NONE) delete next[key];
    else next[key] = Number(v);
    setMapping(next);
  };

  const headerItems = [
    { value: NONE, label: '— tanlanmagan' },
    ...(preview?.headers.map((h, i) => ({ value: String(i), label: h })) ?? []),
  ];
  const branchItems = [
    { value: NONE, label: '— tanlanmagan' },
    ...(branches.data?.map((b) => ({ value: String(b.id), label: b.name })) ??
      []),
  ];

  const missingAmount = mapping.amount === undefined;
  const missingDate =
    mapping.closedAt === undefined && mapping.date === undefined;
  const canCommit = !!preview && !busy && !missingAmount && !missingDate;
  const mappedCount = Object.keys(mapping).length;

  // Ustun indeksi → bizning maydon nomi (namuna jadvali sarlavhasi uchun)
  const usedBy = new Map<number, string>();
  for (const [k, v] of Object.entries(mapping)) {
    if (v !== undefined) usedBy.set(v, FIELD_LABEL[k as keyof Mapping]);
  }

  return (
    <PageContainer size="narrow">
      <PageIntro
        description="iiko savdo hisobotini yuklang — cheklar avtomatik solishtiriladi."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={reconcileNow}
            >
              {action === 'reconcile' ? (
                <RiLoader4Line
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <RiRefreshLine data-icon="inline-start" />
              )}
              Hozir solishtirish
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmNotify(true)}
            >
              {action === 'notify' ? (
                <RiLoader4Line
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <RiSendPlaneLine data-icon="inline-start" />
              )}
              Xabarlarni yuborish
            </Button>
          </>
        }
      />

      <ErrorAlert error={error} />

      {runReport && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Solishtirish natijasi</CardTitle>
            <CardDescription>Qo&apos;lda ishga tushirildi</CardDescription>
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

      {/* Yangi import — qadamlar */}
      <Card className="gap-0 overflow-visible py-0">
        <Stepper current={step} />

        {/* 1-qadam: fayl */}
        {step === 1 && (
          <div className="grid gap-3 p-4">
            <Dropzone
              busy={action === 'upload'}
              fileName={file?.name}
              onFile={onFile}
            />
            <FileHelp />
          </div>
        )}

        {/* 2-qadam: ustunlarni moslash */}
        {step === 2 && preview && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 p-4">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <RiFileExcel2Line className="size-[18px]" />
                </span>
                <div className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-sm font-medium">
                    {preview.fileName}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {preview.totalRows} qator · {preview.headers.length} ustun
                    {file &&
                      ` · ${Math.max(1, Math.round(file.size / 1024))} KB`}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={reset}
                >
                  Boshqa fayl
                </Button>
              </div>

              <section className="grid gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="grid gap-0.5">
                    <h2 className="text-sm font-semibold">
                      Ustunlarni moslash
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Har bir maydon uchun fayldagi ustunni tanlang.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {mappedCount} / {FIELDS.length} moslandi
                  </span>
                </div>

                <div className="divide-y rounded-lg border">
                  {FIELDS.map((f) => {
                    const v = mapping[f.key];
                    const auto = v !== undefined && autoMapping[f.key] === v;
                    const needed =
                      (f.key === 'amount' && missingAmount) ||
                      ((f.key === 'closedAt' || f.key === 'date') &&
                        missingDate);
                    return (
                      <div
                        key={f.key}
                        className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center sm:gap-4"
                      >
                        <div className="grid min-w-0 gap-0.5">
                          <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                            {f.label}
                            {f.required && (
                              <span className="text-destructive" aria-hidden>
                                *
                              </span>
                            )}
                            {auto && (
                              <Badge
                                variant="secondary"
                                className="h-4 px-1.5 text-[10px] font-normal"
                              >
                                avto
                              </Badge>
                            )}
                          </span>
                          {f.hint && (
                            <span className="text-xs text-muted-foreground">
                              {f.hint}
                            </span>
                          )}
                        </div>
                        <Select
                          items={headerItems}
                          value={v === undefined ? NONE : String(v)}
                          onValueChange={(val) =>
                            setField(f.key, (val as string | null) ?? NONE)
                          }
                        >
                          <SelectTrigger
                            aria-label={f.label}
                            aria-invalid={needed || undefined}
                            className={cn(
                              'w-full',
                              v === undefined && 'text-muted-foreground',
                            )}
                          >
                            <SelectValue placeholder="— tanlanmagan" />
                          </SelectTrigger>
                          <SelectContent>
                            {headerItems.map((i) => (
                              <SelectItem key={i.value} value={i.value}>
                                {i.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                  <div className="grid gap-2 bg-muted/20 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center sm:gap-4">
                    <div className="grid min-w-0 gap-0.5">
                      <span className="text-sm font-medium">
                        Standart filial
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Filial ustuni bo&apos;lmasa — butun fayl shu filialga
                      </span>
                    </div>
                    <Select
                      items={branchItems}
                      value={branchId || NONE}
                      onValueChange={(val) => {
                        const s = (val as string | null) ?? NONE;
                        setBranchId(s === NONE ? '' : s);
                      }}
                    >
                      <SelectTrigger
                        aria-label="Standart filial"
                        className={cn(
                          'w-full',
                          !branchId && 'text-muted-foreground',
                        )}
                      >
                        <SelectValue placeholder="— tanlanmagan" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchItems.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section className="grid gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">Namuna</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.min(6, preview.sample.length)} / {preview.totalRows}{' '}
                    qator
                  </span>
                </div>
                <DataTableCard>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {preview.headers.map((h, i) => {
                          const label = usedBy.get(i);
                          return (
                            <TableHead
                              key={i}
                              className={cn(
                                'h-auto! py-2 align-top whitespace-nowrap',
                                label && 'bg-primary/5',
                              )}
                            >
                              <div className="grid gap-1">
                                <span>{h}</span>
                                {label ? (
                                  <span className="text-[11px] font-medium text-primary">
                                    → {label}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground/60">
                                    ishlatilmaydi
                                  </span>
                                )}
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sample.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={preview.headers.length || 1}
                            className="h-20 text-center text-muted-foreground"
                          >
                            Faylda qator yo&apos;q
                          </TableCell>
                        </TableRow>
                      ) : (
                        preview.sample.slice(0, 6).map((row, i) => (
                          <TableRow key={i}>
                            {preview.headers.map((_, j) => (
                              <TableCell
                                key={j}
                                className={cn(
                                  'max-w-56 truncate whitespace-nowrap text-xs',
                                  usedBy.has(j) && 'bg-primary/5',
                                )}
                              >
                                {String(row[j] ?? '')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </DataTableCard>
              </section>
            </div>

            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t bg-card px-4 py-3">
              <Button variant="ghost" disabled={busy} onClick={reset}>
                <RiArrowLeftLine data-icon="inline-start" />
                Orqaga
              </Button>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {(missingAmount || missingDate) && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RiErrorWarningLine className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    {missingAmount
                      ? '«Summa» ustunini tanlang'
                      : '«Yopilish sana-vaqti» yoki «Sana» ni tanlang'}
                  </span>
                )}
                <Button disabled={!canCommit} onClick={commit}>
                  {action === 'commit' ? (
                    <RiLoader4Line
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <RiPlayLine data-icon="inline-start" />
                  )}
                  {action === 'commit' ? 'Import qilinmoqda…' : 'Import qilish'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* 3-qadam: natija */}
        {step === 3 && result && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-6 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <RiCheckLine className="size-5" />
                </span>
                <div className="grid gap-0.5">
                  <p className="text-sm font-medium">
                    Import tugadi va cheklar solishtirildi
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file?.name ?? 'Fayl'} · partiya #{result.batchId}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Qatorlar"
                  value={result.rows.toLocaleString('ru-RU')}
                />
                <StatCard
                  label="Yangi"
                  value={result.inserted.toLocaleString('ru-RU')}
                />
                <StatCard
                  label="Takror"
                  value={result.duplicates.toLocaleString('ru-RU')}
                />
                <StatCard
                  label="Cheklarga bog'landi"
                  value={result.matched.toLocaleString('ru-RU')}
                />
              </div>

              <section className="grid gap-3">
                <h2 className="text-sm font-semibold">Solishtirish</h2>
                <ReportGrid report={result.reconcile} />
              </section>

              {result.errors.length > 0 && (
                <div className="grid gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <div className="flex items-center gap-1.5 font-medium">
                    <RiErrorWarningLine className="size-4" />
                    O&apos;qilmagan qatorlar ({result.errors.length})
                  </div>
                  <ul className="grid gap-0.5 text-xs">
                    {result.errors.slice(0, 10).map((e) => (
                      <li key={e.row}>
                        <span className="tabular-nums">{e.row}</span>-qator:{' '}
                        {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex justify-end rounded-b-xl border-t px-4 py-3">
              <Button onClick={reset}>
                <RiUploadCloud2Line data-icon="inline-start" />
                Yangi import
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Importlar tarixi */}
      <section className="mt-4 grid gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Importlar tarixi</h2>
          {!!batches.data?.length && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {batches.data.length} ta
            </span>
          )}
        </div>
        <ErrorAlert error={batches.error} />
        <DataTableCard>
          {!batches.loading && !batches.data?.length ? (
            <EmptyState
              icon={RiHistoryLine}
              className="py-10"
              title="Hali import qilinmagan"
              description="Yuklangan fayllar va iiko'dan avtomatik importlar shu yerda ko'rinadi."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sana</TableHead>
                  <TableHead>Manba</TableHead>
                  <TableHead>Fayl</TableHead>
                  <TableHead>Davr</TableHead>
                  <TableHead className="text-right">Qatorlar</TableHead>
                  <TableHead className="text-right">Bog&apos;landi</TableHead>
                  <TableHead>Kim</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.loading && !batches.data ? (
                  <TableLoading colSpan={7} rows={3} />
                ) : (
                  batches.data?.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="grid leading-tight">
                          <span className="tabular-nums">
                            {fmtShort(b.createdAt)}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            #{b.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {SOURCE_LABEL[b.source] ?? b.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-56 truncate">
                        {b.fileName ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                        {b.periodFrom || b.periodTo
                          ? `${fmtDate(b.periodFrom, false)} – ${fmtDate(b.periodTo, false)}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.rows.toLocaleString('ru-RU')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.matched.toLocaleString('ru-RU')}
                        {b.rows > 0 && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {Math.round((b.matched / b.rows) * 100)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {b.createdBy?.login ?? (
                          <span className="text-muted-foreground">avto</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </DataTableCard>
      </section>

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
    </PageContainer>
  );
}
