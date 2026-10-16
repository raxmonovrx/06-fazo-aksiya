'use client';

import {
  RiCheckboxCircleFill,
  RiCloseCircleLine,
  RiKeyboardBoxLine,
  RiCloseLine,
  RiLoader4Line,
  RiPrinterLine,
  RiQrCodeLine,
  RiSmartphoneLine,
} from '@remixicon/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useLoad } from '@/components/admin/kit';
import { noAutofill, PhoneInput, phoneValue } from '@/components/admin/phone-input';
import { TouchKeyboard, type KbField } from '@/components/admin/touch-keyboard';
import { VoucherStatusBadge, type VoucherRow } from '@/components/admin/voucher-status';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { adminApi, qs } from '@/lib/api';
import { fmtPhone, fmtShort, fmtSum } from '@/lib/format';
import { OUTPUTS, type Terminal, type TerminalOutput } from '@/lib/terminals';
import { cn } from '@/lib/utils';
import { printVoucher, type PrintableVoucher } from '@/lib/voucher-print';
import { can, useAdmin } from '../admin-context';

interface Issued extends PrintableVoucher {
  link: string;
  terminalId: number | null;
  customerName: string | null;
  customerPhone: string | null;
}

interface BranchRow {
  id: number;
  name: string;
  isActive: boolean;
  minSum: string;
  couponPrice: string;
  maxPerReceipt: number;
  terminals: Terminal[];
}

/** Terminal qo'shilmagan bo'lsa — oddiy ikki tugma */
const FALLBACK: Array<Pick<Terminal, 'name' | 'output'> & { id: null; key: string }> = [
  { id: null, key: 'p', name: 'Chop etish', output: 'PRINT_80' },
  { id: null, key: 's', name: 'Ekranda', output: 'SCREEN' },
];

const onlyDigits = (s: string) => s.replace(/\D/g, '');
const groupDigits = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Kupon soni — serverdagi formula bilan bir xil (oldindan ko'rsatish uchun) */
function couponsFor(sum: number, b: { minSum: number; couponPrice: number; maxPerReceipt: number } | null) {
  if (!b || !sum || sum < b.minSum || b.couponPrice <= 0) return 0;
  return Math.min(Math.max(1, Math.floor(sum / b.couponPrice)), b.maxPerReceipt);
}

/** Bugun 00:00 (Toshkent) — ro'yxat filtri uchun */
function todayStartIso() {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  return `${ymd}T00:00:00+05:00`;
}

const readPref = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writePref = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* saqlanmasa ham ishlayveradi */
  }
};

/** Bekor qilish sabablari — sensorli ekranda yozmasdan bir bosishda */
const QUICK_REASONS = ["Summa noto'g'ri kiritildi", 'Mijoz rad etdi', 'Printer xatosi', 'Chek bekor qilindi'];

const paperOf = (o: TerminalOutput) => (o === 'PRINT_58' ? 58 : 80);

export default function CashierPage() {
  const me = useAdmin();
  const amountRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const terminalsRef = useRef<HTMLDivElement>(null);
  const seesAll = can(me, 'vouchers');

  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [pickedBranch, setPickedBranch] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<Issued | null>(null);
  const [onScreen, setOnScreen] = useState<Issued | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<VoucherRow | null>(null);
  const [reason, setReason] = useState('');
  // Sensorli rejim: ilovaning o'z klaviaturasi (iiko sensorli kompyuterida fizik klaviatura yo'q)
  const [touch, setTouch] = useState(false);
  const [active, setActive] = useState<KbField>('amount');

  // Qaysi terminal oxirgi marta bosilgan — shu qurilmada eslab qolinadi (Enter shuni bosadi)
  useEffect(() => setLastKey(readPref('fc.terminal')), []);
  // Birinchi marta qurilma sensorli bo'lsa o'zi yoqiladi; keyin tanlov eslab qolinadi
  useEffect(() => {
    const saved = readPref('fc.touch');
    setTouch(saved === null ? navigator.maxTouchPoints > 0 : saved === '1');
  }, []);
  const toggleTouch = (on: boolean) => {
    setTouch(on);
    writePref('fc.touch', on ? '1' : '0');
    setTimeout(() => amountRef.current?.focus(), 0);
  };

  const branches = useLoad(() => adminApi<BranchRow[]>('/branches'), []);
  const branchId = me.branch?.id ?? (pickedBranch ? Number(pickedBranch) : null);
  const branch = branches.data?.find((b) => b.id === branchId) ?? null;
  const rule = branch && { minSum: Number(branch.minSum), couponPrice: Number(branch.couponPrice), maxPerReceipt: branch.maxPerReceipt };
  const terminals = useMemo(
    () =>
      branch?.terminals.filter((t) => t.isActive).map((t) => ({ ...t, key: String(t.id) })) ??
      ([] as Array<Terminal & { key: string }>),
    [branch],
  );
  // Terminal yo'q — oddiy «Chop etish» va «Ekranda». Terminallar bor, lekin ekranda ko'rsatadigani
  // yo'q bo'lsa ham «Ekranda» doim qo'shiladi: printer buzilsa ham QR'ni mijozga ekrandan ko'rsatish mumkin.
  const buttons: Array<{ id: number | null; key: string; name: string; output: TerminalOutput }> = terminals.length
    ? [...terminals, ...(terminals.some((t) => t.output === 'SCREEN') ? [] : [FALLBACK[1]])]
    : FALLBACK;
  const primaryKey = buttons.some((b) => b.key === lastKey) ? lastKey : buttons[0]?.key;

  const today = useLoad(
    () => adminApi<{ items: VoucherRow[] }>(`/vouchers${qs({ from: todayStartIso(), pageSize: 100 })}`),
    [],
  );
  const todayItems = today.data?.items ?? [];
  const todayActive = todayItems.filter((v) => v.status !== 'CANCELLED');

  const sum = Number(onlyDigits(amount) || 0);
  const coupons = couponsFor(sum, rule);
  const belowMin = Boolean(sum && rule && sum < rule.minSum);
  const phoneOk = phoneValue(phone) !== undefined;
  const ready = Boolean(branch && coupons && phoneOk);

  const resetForm = useCallback(() => {
    setAmount('');
    setPhone('');
    setName('');
    setError(null);
    setActive('amount');
    setTimeout(() => amountRef.current?.focus(), 0);
  }, []);

  // ── Ekran klaviaturasi ──────────────────────────────────────────────────
  const refs = { amount: amountRef, phone: phoneRef, name: nameRef } as const;
  const goto = (f: KbField) => {
    setActive(f);
    refs[f].current?.focus();
  };
  const nameNeedsCap = !name || name.endsWith(' ');
  const press = (k: string) => {
    if (active === 'amount') setAmount((a) => onlyDigits(a + k).replace(/^0+/, '').slice(0, 10));
    else if (active === 'phone') {
      const next = onlyDigits(phone + k).slice(0, 9);
      setPhone(next);
      if (next.length === 9) goto('name'); // raqam to'liq — ismga o'tamiz
    } else {
      setName((n) => {
        if (k === ' ' && (!n || n.endsWith(' '))) return n; // ikki marta/boshida probel yo'q
        const cap = !n || n.endsWith(' ');
        return (n + (cap ? k.toUpperCase() : k)).slice(0, 100);
      });
    }
  };
  const backspace = () => {
    if (active === 'amount') setAmount((a) => onlyDigits(a).slice(0, -1));
    else if (active === 'phone') setPhone((p) => p.slice(0, -1));
    else setName((n) => n.slice(0, -1));
  };
  const clearField = () => {
    if (active === 'amount') setAmount('');
    else if (active === 'phone') setPhone('');
    else setName('');
  };
  const next = () => {
    if (active === 'amount') goto('phone');
    else if (active === 'phone') goto('name');
    else {
      // Tayyor: klaviatura va fokusni yopib, terminal tugmalariga o'tamiz
      (document.activeElement as HTMLElement | null)?.blur();
      terminalsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  const keyboard = touch && (
    <TouchKeyboard
      field={active}
      onField={goto}
      onKey={press}
      onBackspace={backspace}
      onClear={clearField}
      onNext={next}
      capitalizeNext={nameNeedsCap}
    />
  );
  const kbMode = touch ? ('none' as const) : ('numeric' as const);

  const output = (v: Issued, out: TerminalOutput) => {
    if (out === 'SCREEN') setOnScreen(v);
    else printVoucher(v, paperOf(out));
  };

  const issue = async (btn: (typeof buttons)[number]) => {
    if (!ready || busyKey) return;
    setBusyKey(btn.key);
    setError(null);
    try {
      const v = await adminApi<Issued>('/vouchers', {
        method: 'POST',
        json: {
          amount: sum,
          ...(!me.branch && { branchId }),
          ...(btn.id && { terminalId: btn.id }),
          ...(phoneValue(phone) && { customerPhone: phoneValue(phone) }),
          ...(name.trim() && { customerName: name.trim() }),
        },
      });
      setLast(v);
      setLastKey(btn.key);
      writePref('fc.terminal', btn.key);
      output(v, btn.output);
      toast.success(`QR #${v.id} — ${v.couponsCount} kupon`);
      resetForm();
      void today.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyKey(null);
    }
  };

  const reprint = async (row: VoucherRow, out: TerminalOutput) => {
    try {
      const v = await adminApi<Issued>(`/vouchers/${row.id}/reprint`, { method: 'POST' });
      output(v, out);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await adminApi(`/vouchers/${cancelling.id}/cancel`, { method: 'POST', json: { reason } });
      toast.success(`QR #${cancelling.id} bekor qilindi`);
      if (last?.id === cancelling.id) setLast(null);
      setCancelling(null);
      setReason('');
      void today.reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Qayta chop etish: oxirgi bosilgan printer terminali (bo'lmasa 80 mm)
  const printOut: TerminalOutput =
    buttons.find((b) => b.key === primaryKey && b.output !== 'SCREEN')?.output ??
    buttons.find((b) => b.output !== 'SCREEN')?.output ??
    'PRINT_80';

  const hint = !branch
    ? me.branch
      ? ''
      : 'Avval filialni tanlang'
    : belowMin
      ? `Kupon uchun kamida ${fmtSum(rule!.minSum)}`
      : !phoneOk
        ? "Raqam to'liq emas: +998 XX XXX XXXX"
        : !sum
          ? 'Summani kiriting'
          : '';

  return (
    <div
      className={cn(
        'mx-auto grid w-full grid-cols-[minmax(0,1fr)] gap-4',
        touch ? 'max-w-[1400px] lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]' : 'max-w-6xl lg:grid-cols-[minmax(0,1fr)_380px]',
      )}
    >
      {/* ── Chap: forma va terminallar ─────────────────────────────── */}
      <form
        autoComplete="off"
        className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4 shadow-xs md:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const btn = buttons.find((b) => b.key === primaryKey);
          if (btn) void issue(btn);
        }}
      >
        <label className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <RiKeyboardBoxLine className="size-4" />
          Sensorli klaviatura
          <Switch checked={touch} onCheckedChange={(c) => toggleTouch(Boolean(c))} />
        </label>

        {!me.branch && (
          <Field>
            <FieldLabel>Filial</FieldLabel>
            <Select
              items={(branches.data ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
              value={pickedBranch || null}
              onValueChange={(v) => setPickedBranch((v as string | null) ?? '')}
            >
              <SelectTrigger className="h-12! w-full text-base">
                <SelectValue placeholder="Filialni tanlang" />
              </SelectTrigger>
              <SelectContent>
                {(branches.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <div>
          <label htmlFor="c-sum" className="text-sm font-medium text-muted-foreground">
            Chek summasi
          </label>
          <div
            className={cn(
              'mt-1.5 flex items-baseline gap-3 rounded-2xl border-2 border-input px-4 py-2 transition-colors focus-within:border-primary',
              touch && active === 'amount' && 'border-primary',
            )}
          >
            <input
              id="c-sum"
              ref={amountRef}
              autoFocus
              inputMode={kbMode}
              onFocus={() => setActive('amount')}
              {...noAutofill('s1')}
              placeholder="0"
              className="h-16 w-0 min-w-0 flex-1 bg-transparent text-5xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40 md:h-20 md:text-6xl"
              value={groupDigits(onlyDigits(amount))}
              onChange={(e) => setAmount(onlyDigits(e.target.value).slice(0, 10))}
            />
            <span className="text-xl font-medium text-muted-foreground">so&apos;m</span>
          </div>
          <div className="mt-2 flex min-h-9 items-center gap-3">
            {coupons ? (
              <span className="rounded-full bg-emerald-500/15 px-4 py-1.5 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                {coupons} ta kupon
              </span>
            ) : (
              <span className={cn('text-sm text-muted-foreground', belowMin && 'font-medium text-destructive')}>
                {belowMin ? `Kupon uchun kamida ${fmtSum(rule!.minSum)}` : rule ? `Har ${fmtSum(rule.couponPrice)} — 1 kupon` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="c-p" className="text-sm font-medium text-muted-foreground">
              Mijoz raqami <span className="font-normal">(ixtiyoriy)</span>
            </label>
            <PhoneInput
              id="c-p"
              ref={phoneRef}
              inputMode={kbMode}
              onFocus={() => setActive('phone')}
              value={phone}
              onChange={setPhone}
              invalid={!phoneOk}
              className="mt-1.5 h-14 rounded-xl text-xl"
            />
          </div>
          <div>
            <label htmlFor="c-n" className="text-sm font-medium text-muted-foreground">
              Ismi <span className="font-normal">(ixtiyoriy)</span>
            </label>
            <Input
              id="c-n"
              ref={nameRef}
              inputMode={kbMode}
              onFocus={() => setActive('name')}
              {...noAutofill('n1')}
              className="mt-1.5 h-14 rounded-xl px-3 text-xl md:text-xl"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        {keyboard && <div className="rounded-2xl border bg-background/50 p-3 lg:hidden">{keyboard}</div>}

        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-base font-medium text-destructive">{error}</p>
        )}

        <div ref={terminalsRef}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {terminals.length ? 'Terminalni bosing' : 'QR chiqarish'}
            </span>
            {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
          </div>
          <div className={cn('grid gap-3', buttons.length > 1 && 'sm:grid-cols-2')}>
            {buttons.map((b) => {
              const Icon = OUTPUTS[b.output].icon;
              const primary = b.key === primaryKey;
              return (
                <Button
                  key={b.key}
                  type="button"
                  variant={primary ? 'default' : 'outline'}
                  disabled={!ready || busyKey !== null}
                  onClick={() => void issue(b)}
                  className="h-20 justify-start gap-4 rounded-2xl px-5 text-left [&_svg:not([class*='size-'])]:size-7"
                >
                  {busyKey === b.key ? <RiLoader4Line className="animate-spin" /> : <Icon />}
                  <span className="grid min-w-0 leading-tight">
                    <span className="truncate text-xl font-semibold">{b.name}</span>
                    <span className={cn('truncate text-sm', primary ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {OUTPUTS[b.output].short}
                      {primary && buttons.length > 1 && ' · Enter'}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
          {!terminals.length && branch && (
            <p className="mt-2 text-xs text-muted-foreground">
              Bu filialga terminal qo&apos;shilmagan — admin «Filiallar va kassalar» bo&apos;limida qo&apos;shadi.
            </p>
          )}
        </div>
      </form>

      {/* ── O'ng: oxirgi QR va bugungi ro'yxat ─────────────────────── */}
      <aside className="flex min-w-0 flex-col gap-4">
        {keyboard && (
          <div className="sticky top-20 z-10 hidden rounded-2xl border bg-card p-4 shadow-xs lg:block">{keyboard}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">Bugun QR</div>
            <div className="text-3xl font-bold tabular-nums">{todayActive.length}</div>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">Kupon</div>
            <div className="text-3xl font-bold tabular-nums">{todayActive.reduce((n, v) => n + v.couponsCount, 0)}</div>
          </div>
        </div>

        {last && (
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
            <div
              className="size-24 shrink-0 rounded-lg bg-white p-1.5 [&_svg]:size-full"
              // Server yaratgan SVG (qrcode kutubxonasi) — tashqi kiritma emas
              dangerouslySetInnerHTML={{ __html: last.qrSvg }}
            />
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="text-sm text-muted-foreground">Oxirgi · #{last.id}</div>
              <div className="text-xl font-bold">{last.couponsCount} kupon</div>
              <div className="truncate text-sm text-muted-foreground tabular-nums">{fmtSum(last.amount)}</div>
              <div className="mt-1 flex gap-2">
                <Button size="sm" variant="outline" className="h-9" onClick={() => setOnScreen(last)}>
                  <RiSmartphoneLine /> Ekranda
                </Button>
                <Button size="sm" variant="outline" className="h-9" onClick={() => printVoucher(last, paperOf(printOut))}>
                  <RiPrinterLine /> Chop
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="border-b px-4 py-3 font-medium">
            Bugungi QR&apos;lar
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {seesAll ? (me.branch ? 'filial bo\'yicha' : 'barcha kassalar') : 'siz chiqargan'}
            </span>
          </div>
          {todayItems.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {today.loading ? 'Yuklanmoqda…' : 'Bugun hali QR chiqarilmagan'}
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y overflow-y-auto">
              {todayItems.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-semibold tabular-nums">{v.couponsCount} kupon</span>
                      <span className="truncate text-sm text-muted-foreground tabular-nums">{fmtSum(v.amount)}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground tabular-nums">
                      #{v.id} · {fmtShort(v.issuedAt).split(' ')[1]}
                      {v.terminal && ` · ${v.terminal.name}`}
                      {seesAll && ` · ${v.issuedBy.login}`}
                      {v.customerPhone && ` · ${fmtPhone(v.customerPhone)}`}
                    </div>
                    <VoucherStatusBadge v={v} detail={false} />
                  </div>
                  {v.status === 'ISSUED' && new Date(v.expiresAt) > new Date() && (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon-lg" variant="ghost" aria-label="Ekranda" onClick={() => void reprint(v, 'SCREEN')}>
                        <RiQrCodeLine />
                      </Button>
                      <Button size="icon-lg" variant="ghost" aria-label="Qayta chop etish" onClick={() => void reprint(v, printOut)}>
                        <RiPrinterLine />
                      </Button>
                      <Button
                        size="icon-lg"
                        variant="ghost"
                        aria-label="Bekor qilish"
                        className="text-destructive"
                        onClick={() => setCancelling(v)}
                      >
                        <RiCloseCircleLine />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {onScreen && (
        <ScreenQr
          v={onScreen}
          onClose={() => {
            setOnScreen(null);
            void today.reload();
            setTimeout(() => amountRef.current?.focus(), 0);
          }}
          onPrint={() => printVoucher(onScreen, paperOf(printOut))}
        />
      )}

      <Dialog open={cancelling !== null} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR #{cancelling?.id} ni bekor qilish</DialogTitle>
            <DialogDescription>Bekor qilingan QR skanerlansa, kupon berilmaydi.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="c-r">Sabab</FieldLabel>
            <Input
              id="c-r"
              {...noAutofill('r1')}
              className="h-11 text-base"
              placeholder="Masalan: summa noto'g'ri kiritildi"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setReason(r)}
                  className={cn(
                    'h-11 touch-manipulation rounded-full border px-4 text-sm font-medium transition-colors select-none',
                    reason === r ? 'border-primary bg-primary/10 text-primary' : 'bg-muted/50 hover:bg-muted',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </Field>
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setCancelling(null)}>
              Yopish
            </Button>
            <Button variant="destructive" size="lg" disabled={reason.trim().length < 2} onClick={confirmCancel}>
              Bekor qilish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * QR butun ekranda — mijoz kassir telefoni/Sunmi ekranidan skanerlaydi.
 * Skanerlanganini o'zi sezadi va yopiladi.
 */
function ScreenQr({ v, onClose, onPrint }: { v: Issued; onClose: () => void; onPrint: () => void }) {
  const [redeemed, setRedeemed] = useState(false);
  // Ota sahifa qayta chizilganda so'rov taymeri qayta boshlanmasin
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (redeemed) {
      const t = setTimeout(() => close.current(), 3500);
      return () => clearTimeout(t);
    }
    const timer = setInterval(async () => {
      try {
        const s = await adminApi<{ status: string }>(`/vouchers/${v.id}/status`);
        if (s.status === 'REDEEMED') setRedeemed(true);
        if (s.status === 'CANCELLED') close.current();
      } catch {
        /* tarmoq uzilsa — keyingi urinish */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [v.id, redeemed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`QR #${v.id}`}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="text-sm text-muted-foreground tabular-nums">
          #{v.id} · {v.branchName} · {fmtSum(v.amount)}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="h-11" onClick={onPrint}>
            <RiPrinterLine /> Chop etish
          </Button>
          <Button size="lg" className="h-11" onClick={onClose}>
            <RiCloseLine /> Yopish
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
        {redeemed ? (
          <>
            <RiCheckboxCircleFill className="size-32 text-emerald-500" />
            <div className="text-4xl font-bold">Skanerlandi</div>
            <div className="text-xl text-muted-foreground">Mijozga {v.couponsCount} ta kupon qo&apos;shildi</div>
          </>
        ) : (
          <>
            <div className="text-5xl font-extrabold tracking-tight md:text-6xl">{v.couponsCount} KUPON</div>
            <div
              className="aspect-square w-[min(82vw,58vh)] rounded-3xl bg-white p-4 shadow-sm [&_svg]:size-full"
              // Server yaratgan SVG (qrcode kutubxonasi) — tashqi kiritma emas
              dangerouslySetInnerHTML={{ __html: v.qrSvg }}
            />
            <div className="max-w-md text-xl font-medium">Telefon kamerasi bilan skanerlang va botda «Start»ni bosing</div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RiLoader4Line className="size-4 animate-spin" /> Skanerlanishi kutilmoqda · {fmtShort(v.expiresAt)} gacha
            </div>
          </>
        )}
      </div>
    </div>
  );
}
