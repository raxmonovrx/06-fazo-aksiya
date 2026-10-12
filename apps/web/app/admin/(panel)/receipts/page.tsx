'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ReceiptsTable } from '@/components/receipts-table';
import { Button, Card, ErrorBox, Field, Input } from '@/components/ui';
import { adminApi } from '@/lib/api';

function ReceiptsInner() {
  const sp = useSearchParams();
  const [showManual, setShowManual] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Cheklar</h1>
        <Button variant="secondary" onClick={() => setShowManual((v) => !v)}>
          ➕ Qo&apos;lda qo&apos;shish
        </Button>
      </div>
      {showManual && <ManualForm onDone={() => setKey((k) => k + 1)} />}
      <ReceiptsTable
        key={key}
        initial={{ status: sp.get('status') ?? '', branchId: sp.get('branchId') ?? '', phone: sp.get('phone') ?? '', q: sp.get('q') ?? '', from: '', to: '' }}
      />
    </>
  );
}

function ManualForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ phone: '', fm: '', receiptNumber: '', fiscalAt: '', amount: '' });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await adminApi<{ id: number; status: string }>('/receipts/manual', {
        method: 'POST',
        json: { ...f, amount: f.amount ? Number(f.amount.replace(/\s/g, '')) : undefined },
      });
      setOk(`Chek #${res.id} qo'shildi: ${res.status}`);
      setF({ phone: '', fm: f.fm, receiptNumber: '', fiscalAt: '', amount: '' });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Chekni qo'lda kiritish">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Field label="Telefon"><Input value={f.phone} onChange={set('phone')} placeholder="+998901234567" required /></Field>
        <Field label="FM (kassa)"><Input value={f.fm} onChange={set('fm')} placeholder="LG420230613349" required /></Field>
        <Field label="Chek raqami"><Input value={f.receiptNumber} onChange={set('receiptNumber')} required /></Field>
        <Field label="Chek vaqti"><Input value={f.fiscalAt} onChange={set('fiscalAt')} placeholder="16.10.2026 20:15" required /></Field>
        <Field label="Summa (ixtiyoriy)" hint="Bo'sh bo'lsa iiko bilan solishtiriladi"><Input value={f.amount} onChange={set('amount')} inputMode="numeric" /></Field>
        <div className="flex items-end"><Button type="submit" disabled={busy} className="w-full">Qo&apos;shish</Button></div>
      </form>
      <div className="mt-3 space-y-2">
        <ErrorBox error={error} />
        {ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      </div>
    </Card>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense>
      <ReceiptsInner />
    </Suspense>
  );
}
