'use client';

import { RiDeleteBinLine, RiImageAddLine, RiLoader4Line, RiMagicLine } from '@remixicon/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ErrorAlert, useLoad } from '@/components/admin/kit';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { adminApi } from '@/lib/api';
import { loadImage, prepareOriginal, suggest, toPrint } from '@/lib/logo-process';
import { cn } from '@/lib/utils';
import { ticketHtml, type PaperWidth } from '@/lib/voucher-print';

interface LogoState {
  enabled: boolean;
  threshold: number;
  invert: boolean;
  updatedAt: string | null;
  original: string | null;
  print: string | null;
}

/** Namunadagi QR o'rnida — oddiy katak (haqiqiy QR kassada chiqadi) */
const SAMPLE_QR =
  '<svg viewBox="0 0 29 29" xmlns="http://www.w3.org/2000/svg"><rect width="29" height="29" fill="#fff"/>' +
  '<path d="M1 1h7v7H1zM21 1h7v7h-7zM1 21h7v7H1z" fill="none" stroke="#000" stroke-width="1.5"/>' +
  '<path d="M3 3h3v3H3zM23 3h3v3h-3zM3 23h3v3H3zM11 2h2v2h-2zM14 5h3v2h-3zM11 9h2v3h-2zM15 11h4v2h-4zM20 14h3v3h-3zM10 15h3v2h-3zM14 18h2v4h-2zM18 20h4v2h-4zM23 23h3v3h-3zM12 24h3v2h-3zM24 10h3v2h-3z"/></svg>';

/**
 * Filial chek logosi: admin istalgan rasmni yuklaydi, brauzerda oq-qora qilinadi
 * (termoprinter faqat qora chiqaradi). Kassir hech narsa sozlamaydi.
 */
export function BranchLogo({ branchId, branchName }: { branchId: number; branchName: string }) {
  const data = useLoad(() => adminApi<LogoState>(`/branches/${branchId}/logo`), [branchId]);
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(160);
  const [invert, setInvert] = useState(false);
  const [original, setOriginal] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [paper, setPaper] = useState<PaperWidth>(80);
  const [busy, setBusy] = useState(false);
  const [inited, setInited] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Serverdagi holat bilan bir marta to'ldiriladi
  useEffect(() => {
    const d = data.data;
    if (!d || inited) return;
    setEnabled(d.enabled);
    setThreshold(d.threshold);
    setInvert(d.invert);
    setOriginal(d.original);
    setInited(true);
  }, [data.data, inited]);

  useEffect(() => {
    let alive = true;
    if (!original) setImg(null);
    else void loadImage(original).then((i) => alive && setImg(i));
    return () => {
      alive = false;
    };
  }, [original]);

  const print = useMemo(() => (img ? toPrint(img, threshold, invert) : null), [img, threshold, invert]);
  const saved = data.data;
  const dirty =
    !!saved &&
    (enabled !== saved.enabled || threshold !== saved.threshold || invert !== saved.invert || original !== saved.original);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const o = await prepareOriginal(file);
      const i = await loadImage(o);
      const s = suggest(i);
      setOriginal(o);
      setThreshold(s.threshold);
      setInvert(s.invert);
      setEnabled(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const auto = () => {
    if (!img) return;
    const s = suggest(img);
    setThreshold(s.threshold);
    setInvert(s.invert);
  };

  const save = async () => {
    if (original && !print) return toast.error("Logo butunlay oq bo'lib qoldi — chegarani o'zgartiring");
    setBusy(true);
    try {
      const imageChanged = original !== saved?.original;
      const next = await adminApi<LogoState>(`/branches/${branchId}/logo`, {
        method: 'PUT',
        json: {
          enabled: Boolean(enabled && original),
          threshold,
          invert,
          // Rasm o'zgarmagan bo'lsa ham, chegara o'zgargan bo'lishi mumkin — chek varianti har doim yangilanadi
          ...(imageChanged && { original }),
          print: original ? print : null,
        },
      });
      toast.success(`${branchName}: chek sozlamasi saqlandi`);
      await data.reload();
      setEnabled(next.enabled);
      setOriginal(next.original);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(
    () =>
      ticketHtml(
        {
          id: 123,
          amount: 650000,
          couponsCount: 2,
          branchName,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
          qrSvg: SAMPLE_QR,
          logo: enabled ? print : null,
        },
        paper,
      ),
    [branchName, enabled, print, paper],
  );

  if (data.error) return <ErrorAlert error={data.error} />;
  if (!inited)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <RiLoader4Line className="size-4 animate-spin" /> Yuklanmoqda…
      </p>
    );

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <Field orientation="horizontal" className="rounded-lg border p-3">
        <FieldContent>
          <FieldLabel htmlFor={`logo-on-${branchId}`}>Chekda logo</FieldLabel>
          <FieldDescription>{original ? 'Kassir chiqargan har bir QR chekida chiqadi' : 'Avval logo yuklang'}</FieldDescription>
        </FieldContent>
        <Switch id={`logo-on-${branchId}`} checked={enabled && !!original} disabled={!original} onCheckedChange={setEnabled} />
      </Field>

      {!original ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files?.[0]);
          }}
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <RiImageAddLine className="size-8" />
          <span className="font-medium text-foreground">Logo yuklash</span>
          <span>PNG, JPG, SVG — istalgan rangda. Oq-qora avtomatik qilinadi.</span>
        </button>
      ) : (
        <div className="grid gap-4 rounded-lg border p-3">
          <div className="grid grid-cols-2 gap-3">
            <figure className="grid gap-1.5">
              <figcaption className="text-xs text-muted-foreground">Asl rasm</figcaption>
              <div className="grid aspect-square place-items-center rounded-md border bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={original} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            </figure>
            <figure className="grid gap-1.5">
              <figcaption className="text-xs text-muted-foreground">Chekda (oq-qora)</figcaption>
              <div className="grid aspect-square place-items-center rounded-md border bg-white p-2">
                {print ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={print} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-center text-xs text-destructive">Butunlay oq — chegarani o&apos;zgartiring</span>
                )}
              </div>
            </figure>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor={`logo-th-${branchId}`}>Qoralik chegarasi</label>
              <span className="text-muted-foreground tabular-nums">{threshold}</span>
            </div>
            <input
              id={`logo-th-${branchId}`}
              type="range"
              min={20}
              max={240}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">Chapga — ingichkaroq, o&apos;ngga — qalinroq va to&apos;qroq.</p>
          </div>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={`logo-inv-${branchId}`}>Ranglarni almashtirish</FieldLabel>
              <FieldDescription>To&apos;q fonli logo uchun (oq yozuv qora bo&apos;lib chiqadi)</FieldDescription>
            </FieldContent>
            <Switch id={`logo-inv-${branchId}`} checked={invert} onCheckedChange={setInvert} />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={auto}>
              <RiMagicLine data-icon="inline-start" /> Avtomatik
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <RiImageAddLine data-icon="inline-start" /> Boshqa rasm
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive"
              onClick={() => {
                setOriginal(null);
                setEnabled(false);
              }}
            >
              <RiDeleteBinLine data-icon="inline-start" /> Logoni olib tashlash
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Chek namunasi <span className="font-normal text-muted-foreground">· QR shartli</span>
          </span>
          <div className="flex gap-1">
            {([80, 58] as const).map((w) => (
              <Button key={w} type="button" size="sm" variant={paper === w ? 'secondary' : 'ghost'} onClick={() => setPaper(w)}>
                {w} mm
              </Button>
            ))}
          </div>
        </div>
        <div className="flex justify-center rounded-lg bg-muted/60 p-4">
          <iframe
            title="Chek namunasi"
            srcDoc={preview}
            className={cn('rounded-sm bg-white shadow-sm', paper === 80 ? 'h-[150mm] w-[80mm]' : 'h-[130mm] w-[58mm]')}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setInited(false);
              void data.reload();
            }}
          >
            Bekor qilish
          </Button>
        )}
        <Button type="button" size="sm" disabled={busy || !dirty} onClick={() => void save()}>
          {busy && <RiLoader4Line data-icon="inline-start" className="animate-spin" />}
          Chekni saqlash
        </Button>
      </div>
    </div>
  );
}
