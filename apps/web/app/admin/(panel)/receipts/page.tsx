'use client';

import { RiAddLine, RiLoader4Line } from '@remixicon/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { toast } from 'sonner';

import { ErrorAlert } from '@/components/admin/kit';
import { PageContainer } from '@/components/admin/layout';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  ReceiptsTable,
  type ReceiptsTableState,
} from '@/components/receipts-table';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  InputGroupText,
} from '@/components/ui/input-group';
import { adminApi } from '@/lib/api';
import { STATUS } from '@/lib/format';

const toInt = (v: string | null, def: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : def;
};

function ReceiptsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [manualOpen, setManualOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Boshlang'ich holat URL'dan (Dashboard havolalari: ?status=APPROVED)
  const [initial] = useState(() => ({
    filters: {
      status: sp.get('status') ?? '',
      branchId: sp.get('branchId') ?? '',
      phone: sp.get('phone') ?? '',
      q: sp.get('q') ?? '',
      from: sp.get('from') ?? '',
      to: sp.get('to') ?? '',
    },
    page: toInt(sp.get('page'), 1),
    pageSize: PAGE_SIZES.includes(toInt(sp.get('pageSize'), 0))
      ? toInt(sp.get('pageSize'), DEFAULT_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE,
  }));

  // Filtr/sahifa → URL (yangilash va havola ulashishda holat saqlanadi)
  const syncUrl = useCallback(
    ({ filters, page, pageSize }: ReceiptsTableState) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
      if (page > 1) p.set('page', String(page));
      if (pageSize !== DEFAULT_PAGE_SIZE) p.set('pageSize', String(pageSize));
      const next = p.toString();
      if (next !== window.location.search.replace(/^\?/, '')) {
        router.replace(next ? `${pathname}?${next}` : pathname, {
          scroll: false,
        });
      }
    },
    [router, pathname],
  );

  return (
    <PageContainer size="wide">
      <ReceiptsTable
        initial={initial.filters}
        initialPage={initial.page}
        initialPageSize={initial.pageSize}
        reloadKey={reloadKey}
        onStateChange={syncUrl}
        actions={
          <Button size="sm" className="h-8" onClick={() => setManualOpen(true)}>
            <RiAddLine data-icon="inline-start" />
            Qo&apos;lda qo&apos;shish
          </Button>
        }
      />
      <ManualDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        onCreated={(id) => {
          setReloadKey((k) => k + 1);
          return () => router.push(`/admin/receipts/${id}`);
        }}
      />
    </PageContainer>
  );
}

const EMPTY_FORM = {
  phone: '',
  fm: '',
  receiptNumber: '',
  fiscalAt: '',
  amount: '',
};

function ManualDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Yangi chek ID'si; qaytarilgan funksiya — «Ochish» tugmasi uchun */
  onCreated: (id: number) => () => void;
}) {
  const [f, setF] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  const valid =
    f.phone.replace(/\D/g, '').length >= 9 &&
    f.fm.trim().length >= 6 &&
    /^\d{1,12}$/.test(f.receiptNumber.trim()) &&
    Boolean(f.fiscalAt);

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
      const openReceipt = onCreated(res.id);
      toast.success(
        `Chek #${res.id} qo'shildi — ${STATUS[res.status]?.label ?? res.status}`,
        { action: { label: 'Ochish', onClick: openReceipt } },
      );
      // FM keyingi chek uchun saqlanadi (odatda bir kassadan kiritiladi)
      setF({ ...EMPTY_FORM, fm: f.fm });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setError(null);
      }}
    >
      <DialogContent size="lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Chekni qo&apos;lda qo&apos;shish</DialogTitle>
            <DialogDescription>
              Ishtirokchi chekni bot orqali yubora olmagan bo&apos;lsa, shu
              yerdan kiriting.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="m-phone">Telefon</FieldLabel>
                <Input
                  id="m-phone"
                  value={f.phone}
                  onChange={set('phone')}
                  placeholder="+998 90 123 45 67"
                  inputMode="tel"
                  autoComplete="off"
                  autoFocus
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
                  className="font-mono"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-num">Chek raqami</FieldLabel>
                <Input
                  id="m-num"
                  value={f.receiptNumber}
                  onChange={set('receiptNumber')}
                  placeholder="1234"
                  inputMode="numeric"
                  className="tabular-nums"
                  autoComplete="off"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="m-time">Chek vaqti</FieldLabel>
                <DateTimePicker
                  id="m-time"
                  value={f.fiscalAt}
                  onChange={(v) => setF({ ...f, fiscalAt: v })}
                  placeholder="Sana va vaqt"
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="m-amount">
                  Summa{' '}
                  <span className="font-normal text-muted-foreground">
                    (ixtiyoriy)
                  </span>
                </FieldLabel>
                <InputGroup className="sm:max-w-[calc(50%-0.5rem)]">
                  <InputGroupInput
                    id="m-amount"
                    value={f.amount}
                    onChange={set('amount')}
                    placeholder="0"
                    inputMode="numeric"
                    className="tabular-nums"
                    autoComplete="off"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>so&apos;m</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  Bo&apos;sh qolsa, summa iiko bilan solishtirib olinadi.
                </FieldDescription>
              </Field>
            </div>
            <ErrorAlert error={error} />
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Yopish
            </Button>
            <Button type="submit" disabled={busy || !valid}>
              {busy ? (
                <RiLoader4Line
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <RiAddLine data-icon="inline-start" />
              )}
              {busy ? "Qo'shilmoqda…" : "Qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense>
      <ReceiptsInner />
    </Suspense>
  );
}
