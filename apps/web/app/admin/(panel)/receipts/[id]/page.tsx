'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, ErrorBox, Field, Input, Select, StatusBadge, Table, useLoad } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { fmtDate, fmtSum } from '@/lib/format';

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
  participant: { id: number; phone: string; firstName: string | null; lastName: string | null; username: string | null; isStaff: boolean };
  saleRecord: SaleRec | null;
  reviewedBy: { login: string } | null;
  coupons: Array<{ id: number; eligible: boolean }>;
  audit: Array<{ id: number; action: string; createdAt: string; data: unknown; actor: { login: string } | null }>;
  scans: Array<{ id: number; result: string; channel: string; createdAt: string }>;
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

const REJECT_PRESETS = ["Chek o'qilmaydi / QR yo'q", 'Fiskal chek emas (prechek)', 'Aksiyadagi filialga tegishli emas', "Chek muddati o'tgan", 'Soxta yoki takroriy chek'];

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: r, error, reload } = useLoad(() => adminApi<Detail>(`/receipts/${id}`), [id]);
  const branches = useLoad(() => adminApi<Array<{ id: number; name: string }>>('/branches'), []);
  const [amount, setAmount] = useState('');
  const [branchId, setBranchId] = useState('');
  const [fm, setFm] = useState('');
  const [num, setNum] = useState('');
  const [fiscalAt, setFiscalAt] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <ErrorBox error={error} />;
  if (!r) return <p className="text-muted-foreground">Yuklanmoqda…</p>;

  const canApprove = r.status !== 'APPROVED' && r.coupons.length === 0;
  const needIds = !r.fm || !r.receiptNumber;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const approve = () =>
    act(() =>
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
    );
  const reject = () => act(() => adminApi(`/receipts/${r.id}/reject`, { method: 'POST', json: { reason } }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/receipts" className="text-sm text-muted-foreground hover:underline">← Cheklar</Link>
        <h1 className="text-xl font-bold">Chek #{r.id}</h1>
        <StatusBadge status={r.status} />
        {r.rejectReason && <span className="text-sm text-muted-foreground">{r.rejectReason}</span>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Ma'lumot" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            <Item k="Ishtirokchi">
              <Link className="text-sky-700 dark:text-sky-400 hover:underline" href={`/admin/participants/${r.participant.id}`}>
                {r.participant.phone}
              </Link>{' '}
              {r.participant.isStaff && <span className="rounded bg-secondary px-1 text-xs">xodim</span>}
              <div className="text-xs text-muted-foreground">
                {[r.participant.firstName, r.participant.lastName].filter(Boolean).join(' ')} {r.participant.username && `@${r.participant.username}`}
              </div>
            </Item>
            <Item k="Filial">{r.branch?.name ?? '—'}</Item>
            <Item k="Manba">{r.source}</Item>
            <Item k="FM">{r.fm ?? '—'}</Item>
            <Item k="Chek raqami">{r.receiptNumber ?? '—'}</Item>
            <Item k="Fiskal belgi">{r.fiscalSign ?? '—'}</Item>
            <Item k="Chek vaqti">{fmtDate(r.fiscalAt)}</Item>
            <Item k="Qo'shilgan">{fmtDate(r.createdAt)}</Item>
            <Item k="Hal qilingan">{fmtDate(r.decidedAt)} {r.reviewedBy && `(${r.reviewedBy.login})`}</Item>
            <Item k="Summa">{fmtSum(r.amount)}</Item>
            <Item k="Kuponlar">
              {r.coupons.length ? r.coupons.map((c) => <span key={c.id} className={c.eligible ? '' : 'text-muted-foreground line-through'}>№{c.id} </span>) : '—'}
            </Item>
          </dl>
          {r.rawUrl && (
            <p className="mt-4 break-all rounded-lg bg-muted/50 p-2 font-mono text-xs">
              <a href={r.rawUrl} target="_blank" rel="noreferrer" className="text-sky-700 dark:text-sky-400 hover:underline">{r.rawUrl}</a>
            </p>
          )}
        </Card>

        <Card title="Chek rasmi">
          {r.photoFileId ? (
            <a href={`/api/admin/photos/${r.photoFileId}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/admin/photos/${r.photoFileId}`} alt="chek" className="max-h-[480px] w-full rounded-lg object-contain" />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Rasm yo&apos;q (QR orqali kelgan)</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {canApprove && (
          <Card title="✅ Tasdiqlash">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Summa (so'm)"><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" /></Field>
              <Field label="Filial">
                <Select value={branchId || String(r.branch?.id ?? '')} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">— tanlang —</option>
                  {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              {needIds && (
                <>
                  <Field label="FM" hint="Chekdan — takror ishlatilmasligi uchun"><Input value={fm} onChange={(e) => setFm(e.target.value)} /></Field>
                  <Field label="Chek raqami"><Input value={num} onChange={(e) => setNum(e.target.value)} /></Field>
                  <Field label="Chek vaqti"><Input value={fiscalAt} onChange={(e) => setFiscalAt(e.target.value)} placeholder="16.10.2026 20:15" /></Field>
                </>
              )}
            </div>
            <Button className="mt-3" disabled={busy || !amount || !(branchId || r.branch)} onClick={approve}>
              Tasdiqlash va kupon berish
            </Button>
          </Card>
        )}
        {r.status !== 'REJECTED' && (
          <Card title="❌ Rad etish">
            <div className="mb-2 flex flex-wrap gap-1">
              {REJECT_PRESETS.map((p) => (
                <button key={p} onClick={() => setReason(p)} className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted/50">{p}</button>
              ))}
            </div>
            <Field label="Sabab (mijozga ko'rinadi)"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <Button variant="danger" className="mt-3" disabled={busy || reason.trim().length < 2} onClick={reject}>
              Rad etish
            </Button>
          </Card>
        )}
      </div>
      <ErrorBox error={actionError} />

      <Card title="iiko ma'lumoti (savdo yozuvlari)">
        {r.saleRecord && (
          <p className="mb-3 text-sm">
            Bog&apos;langan: #{r.saleRecord.id} · {fmtDate(r.saleRecord.closedAt)} · {fmtSum(r.saleRecord.amount)} {r.saleRecord.isRefund && '(qaytarish)'}
          </p>
        )}
        <p className="mb-2 text-xs text-muted-foreground">Shu chek raqami yoki filialda ±30 daqiqa ichida yopilgan cheklar. Qatorni bosing — summa formaga tushadi.</p>
        <Table head={['ID', 'Manba', 'FM', 'Chek №', 'Yopilgan', 'Summa', '']} empty={!r.candidates.length}>
          {r.candidates.map((c) => (
            <tr key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setAmount(String(Math.round(Number(c.amount))))}>
              <td>#{c.id}</td>
              <td>{c.source}</td>
              <td>{c.fm ?? '—'}</td>
              <td>{c.receiptNumber ?? '—'}</td>
              <td>{fmtDate(c.closedAt)}</td>
              <td>{fmtSum(c.amount)}</td>
              <td>{c.isRefund && <span className="text-red-600 dark:text-red-400">qaytarish</span>}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Audit">
          <ul className="space-y-2 text-sm">
            {r.audit.length === 0 && <li className="text-muted-foreground">Yo&apos;q</li>}
            {r.audit.map((a) => (
              <li key={a.id}>
                <span className="text-muted-foreground">{fmtDate(a.createdAt)}</span> · <b>{a.action}</b> · {a.actor?.login ?? 'tizim'}
                <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-xs">{JSON.stringify(a.data, null, 1)}</pre>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Skanerlash jurnali">
          <ul className="space-y-1 text-sm">
            {r.scans.map((s) => (
              <li key={s.id}>
                <span className="text-muted-foreground">{fmtDate(s.createdAt)}</span> · {s.channel} · {s.result}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Item({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}
