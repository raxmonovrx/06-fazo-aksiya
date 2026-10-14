'use client';

import { useState } from 'react';

import { Button, Card, ErrorBox, Field, Select, Table, useLoad } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { fmtDate } from '@/lib/format';

type Mapping = Partial<Record<'amount' | 'closedAt' | 'date' | 'time' | 'fm' | 'receiptNumber' | 'branch' | 'refund', number>>;
interface Preview { token: string; fileName: string; headers: string[]; sample: unknown[][]; totalRows: number; mapping: Mapping }
interface Report { checked: number; approved: number; belowMin: number; refunded: number; review: number; notFound: number }
interface Result { batchId: number; rows: number; inserted: number; duplicates: number; matched: number; errors: Array<{ row: number; error: string }>; reconcile: Report }
interface Batch { id: number; source: string; fileName: string | null; periodFrom: string | null; periodTo: string | null; rows: number; matched: number; createdAt: string; createdBy: { login: string } | null }

const FIELDS: Array<{ key: keyof Mapping; label: string; hint?: string; required?: boolean }> = [
  { key: 'amount', label: 'Summa *', required: true, hint: 'Chegirmadan keyingi summa' },
  { key: 'closedAt', label: 'Yopilish sana-vaqti', hint: 'Yoki pastda alohida sana + vaqt' },
  { key: 'date', label: 'Sana (alohida)' },
  { key: 'time', label: 'Vaqt (alohida)' },
  { key: 'receiptNumber', label: 'Fiskal chek raqami', hint: 'QR dagi r= bilan bir xil raqam' },
  { key: 'fm', label: 'FM (fiskal modul)', hint: "Bo'lmasa — filial + vaqt bo'yicha moslanadi" },
  { key: 'branch', label: 'Filial / department' },
  { key: 'refund', label: 'Qaytarish belgisi', hint: "Manfiy summa ham qaytarish hisoblanadi" },
];

const reportText = (r: Report) =>
  `tekshirildi ${r.checked} · tasdiqlandi ${r.approved} · summa kam ${r.belowMin} · qaytarilgan ${r.refunded} · moderatsiyaga ${r.review} · topilmadi ${r.notFound}`;

export default function ImportPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [branchId, setBranchId] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [runReport, setRunReport] = useState<Report | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const branches = useLoad(() => adminApi<Array<{ id: number; name: string }>>('/branches'), []);
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
      const p = await adminApi<Preview>('/import/preview', { method: 'POST', body: fd });
      setPreview(p);
      setMapping(Object.fromEntries(Object.entries(p.mapping).filter(([, v]) => v !== undefined && v !== null)) as Mapping);
    });

  const commit = () =>
    wrap(async () => {
      const res = await adminApi<Result>('/import/commit', {
        method: 'POST',
        json: { token: preview!.token, mapping, defaultBranchId: branchId ? Number(branchId) : null },
      });
      setResult(res);
      setPreview(null);
      await batches.reload();
    });

  const notifyNow = () =>
    confirm("Kechagi natijalar mijozlarga hozir yuborilsinmi? (Odatda har kuni 09:00 da avtomatik)") &&
    wrap(async () => {
      const r = await adminApi<{ queued: number; sent: number; failed: number; blocked: number }>('/jobs/notify', { method: 'POST' });
      setNotice(`Xabarlar: navbatga ${r.queued}, yuborildi ${r.sent}, bot bloklangan ${r.blocked}, xato ${r.failed}`);
    });

  const reconcileNow = () =>
    wrap(async () => {
      setRunReport(await adminApi<Report>('/reconcile/run', { method: 'POST' }));
    });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Import va solishtirish</h1>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busy} onClick={notifyNow}>📨 Xabarlarni hozir yuborish</Button>
          <Button variant="secondary" disabled={busy} onClick={reconcileNow}>🔄 Hozir solishtirish</Button>
        </div>
      </div>
      {runReport && <p className="rounded-lg bg-emerald-50 dark:bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">Solishtirish: {reportText(runReport)}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 dark:bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
      <ErrorBox error={error} />

      <Card title="1. iiko hisobotini yuklash (xlsx yoki csv)">
        <input
          type="file"
          accept=".xlsx,.csv,.txt"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="text-sm"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          iikoOffice → Отчеты → OLAP-отчет по продажам. Kerakli ustunlar: fiskal chek raqami, FM (yoki kassa), yopilish vaqti, summa. Bir faylni qayta yuklash xavfsiz — takror yozuvlar o&apos;tkazib yuboriladi.
        </p>
      </Card>

      {preview && (
        <Card title={`2. Ustunlarni moslash — ${preview.fileName} (${preview.totalRows} qator)`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <Select
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = { ...mapping };
                    if (v === '') delete next[f.key];
                    else next[f.key] = Number(v);
                    setMapping(next);
                  }}
                >
                  <option value="">—</option>
                  {preview.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </Select>
              </Field>
            ))}
            <Field label="Filial (ustun bo'lmasa)" hint="Butun fayl shu filialga tegishli">
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">—</option>
                {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          </div>
          <h3 className="mt-4 mb-2 text-sm font-semibold">Namuna</h3>
          <Table head={preview.headers.map((h, i) => {
            const used = Object.entries(mapping).find(([, v]) => v === i)?.[0];
            return <span key={i} className={used ? 'text-emerald-700 dark:text-emerald-400' : ''}>{h}{used && ` ← ${FIELDS.find((f) => f.key === used)?.label.replace(' *', '')}`}</span>;
          })}>
            {preview.sample.map((row, i) => (
              <tr key={i}>{preview.headers.map((_, j) => <td key={j} className="whitespace-nowrap">{String(row[j] ?? '')}</td>)}</tr>
            ))}
          </Table>
          <Button className="mt-4" disabled={busy || mapping.amount === undefined || (mapping.closedAt === undefined && mapping.date === undefined)} onClick={commit}>
            {busy ? 'Import qilinmoqda…' : 'Import qilish va solishtirish'}
          </Button>
        </Card>
      )}

      {result && (
        <Card title="Natija">
          <ul className="space-y-1 text-sm">
            <li>Qatorlar: <b>{result.rows}</b> · yangi: <b>{result.inserted}</b> · takror: {result.duplicates}</li>
            <li>Cheklarga bog&apos;landi: <b>{result.matched}</b></li>
            <li>Solishtirish: {reportText(result.reconcile)}</li>
            {result.errors.length > 0 && (
              <li className="text-red-700 dark:text-red-400">
                O&apos;qilmagan qatorlar ({result.errors.length}): {result.errors.slice(0, 10).map((e) => `${e.row}-qator: ${e.error}`).join('; ')}
              </li>
            )}
          </ul>
        </Card>
      )}

      <Card title="Importlar tarixi">
        <Table head={['#', 'Manba', 'Fayl', 'Davr', 'Qatorlar', 'Bog\'landi', 'Kim', 'Qachon']} empty={!batches.data?.length}>
          {batches.data?.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.source}</td>
              <td>{b.fileName ?? '—'}</td>
              <td className="whitespace-nowrap">{fmtDate(b.periodFrom, false)} – {fmtDate(b.periodTo, false)}</td>
              <td>{b.rows}</td>
              <td>{b.matched}</td>
              <td>{b.createdBy?.login ?? 'cron'}</td>
              <td className="whitespace-nowrap">{fmtDate(b.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
