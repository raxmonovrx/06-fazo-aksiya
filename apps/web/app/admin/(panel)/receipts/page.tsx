'use client';

import { RiAddLine, RiCloseLine } from '@remixicon/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';

import { ErrorAlert, PageToolbar } from '@/components/admin/kit';
import { ReceiptsTable } from '@/components/receipts-table';
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { adminApi } from '@/lib/api';

function ReceiptsInner() {
  const sp = useSearchParams();
  const [showManual, setShowManual] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <PageToolbar description="Barcha yuborilgan cheklar. Qatorni bosib chek tafsilotini oching.">
        <Button
          variant={showManual ? 'outline' : 'default'}
          onClick={() => setShowManual((v) => !v)}
        >
          {showManual ? (
            <RiCloseLine data-icon="inline-start" />
          ) : (
            <RiAddLine data-icon="inline-start" />
          )}
          {showManual ? 'Yopish' : "Qo'lda qo'shish"}
        </Button>
      </PageToolbar>
      {showManual && (
        <ManualForm
          onDone={() => setKey((k) => k + 1)}
          onClose={() => setShowManual(false)}
        />
      )}
      <ReceiptsTable
        key={key}
        initial={{
          status: sp.get('status') ?? '',
          branchId: sp.get('branchId') ?? '',
          phone: sp.get('phone') ?? '',
          q: sp.get('q') ?? '',
          from: '',
          to: '',
        }}
      />
    </div>
  );
}

function ManualForm({
  onDone,
  onClose,
}: {
  onDone: () => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    phone: '',
    fm: '',
    receiptNumber: '',
    fiscalAt: '',
    amount: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.fiscalAt) {
      setError('Chek vaqtini tanlang');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi<{ id: number; status: string }>(
        '/receipts/manual',
        {
          method: 'POST',
          json: {
            ...f,
            amount: f.amount ? Number(f.amount.replace(/\s/g, '')) : undefined,
          },
        },
      );
      toast.success(`Chek #${res.id} qo'shildi: ${res.status}`);
      // FM keyingi chek uchun saqlanadi (odatda bir kassadan kiritiladi)
      setF({
        phone: '',
        fm: f.fm,
        receiptNumber: '',
        fiscalAt: '',
        amount: '',
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chekni qo&apos;lda kiritish</CardTitle>
        <CardDescription>
          Ishtirokchi chekini bot orqali yubora olmagan bo&apos;lsa, shu yerdan
          qo&apos;shing.
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Yopish"
            onClick={onClose}
          >
            <RiCloseLine />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field>
                <FieldLabel htmlFor="m-phone">Telefon</FieldLabel>
                <Input
                  id="m-phone"
                  value={f.phone}
                  onChange={set('phone')}
                  placeholder="+998901234567"
                  inputMode="tel"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-fm">FM (kassa)</FieldLabel>
                <Input
                  id="m-fm"
                  value={f.fm}
                  onChange={set('fm')}
                  placeholder="LG420230613349"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-num">Chek raqami</FieldLabel>
                <Input
                  id="m-num"
                  value={f.receiptNumber}
                  onChange={set('receiptNumber')}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-time">Chek vaqti</FieldLabel>
                <DateTimePicker
                  id="m-time"
                  value={f.fiscalAt}
                  onChange={(v) => setF({ ...f, fiscalAt: v })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-amount">Summa (ixtiyoriy)</FieldLabel>
                <Input
                  id="m-amount"
                  value={f.amount}
                  onChange={set('amount')}
                  inputMode="numeric"
                />
                <FieldDescription>
                  Bo&apos;sh bo&apos;lsa iiko bilan solishtiriladi
                </FieldDescription>
              </Field>
            </div>
            <ErrorAlert error={error} />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                <RiAddLine data-icon="inline-start" />
                {busy ? "Qo'shilmoqda…" : "Qo'shish"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
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
