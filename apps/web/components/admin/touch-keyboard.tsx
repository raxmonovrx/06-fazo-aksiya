'use client';

import { RiArrowRightLine, RiCheckLine, RiDeleteBack2Line } from '@remixicon/react';
import { useRef } from 'react';

import { cn } from '@/lib/utils';

export type KbField = 'amount' | 'phone' | 'name';

const FIELDS: Array<{ key: KbField; label: string }> = [
  { key: 'amount', label: 'Summa' },
  { key: 'phone', label: 'Raqam' },
  { key: 'name', label: 'Ism' },
];

const LETTER_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

/**
 * Tugma: fokus kiritish maydonida qoladi (onMouseDown preventDefault), bosish — onClick.
 * `onHold` — uzoq bosish (masalan, ⌫ ni ushlab turish — hammasini tozalash).
 */
function Key({
  children,
  onPress,
  onHold,
  className,
  label,
}: {
  children: React.ReactNode;
  onPress: () => void;
  onHold?: () => void;
  className?: string;
  label?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={() => {
        held.current = false;
        if (onHold) {
          timer.current = setTimeout(() => {
            held.current = true;
            onHold();
          }, 550);
        }
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onPress();
      }}
      className={cn(
        'grid touch-manipulation place-items-center rounded-xl border border-border bg-secondary text-foreground shadow-[0_1px_0_rgb(0_0_0/0.12)] transition-[transform,background-color] select-none tall:rounded-2xl',
        'hover:bg-secondary/70 active:scale-95 active:bg-primary/25',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Sensorli ekran uchun klaviatura (iiko kassa kompyuterida fizik klaviatura yo'q):
 * raqamlar — summa va telefon uchun, harflar — ism uchun (o'zbek lotin).
 * Qiymatni ota-komponent boshqaradi; bu yerda faqat tugmalar.
 */
export function TouchKeyboard({
  field,
  onField,
  onKey,
  onBackspace,
  onClear,
  onNext,
  capitalizeNext,
}: {
  field: KbField;
  onField: (f: KbField) => void;
  /** Raqam, "000", harf, "'" yoki bo'sh joy */
  onKey: (k: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  /** "Keyingi" / "Tayyor" */
  onNext: () => void;
  /** Ism uchun: keyingi harf bosh harf bo'ladi (so'z boshi) */
  capitalizeNext: boolean;
}) {
  const digits = field !== 'name';
  const nextLabel = field === 'amount' ? 'Keyingi: raqam' : field === 'phone' ? 'Keyingi: ism' : 'Tayyor';

  return (
    <div className="flex flex-col gap-2 tall:gap-3" role="group" aria-label="Ekran klaviaturasi">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted p-1 tall:rounded-2xl">
        {FIELDS.map((f) => (
          <button
            key={f.key}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onField(f.key)}
            className={cn(
              'h-10 touch-manipulation rounded-lg text-base font-medium transition-colors select-none tall:h-11 tall:rounded-xl',
              field === f.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {digits ? (
        <>
          <div className="grid grid-cols-3 gap-2 tall:gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <Key key={k} onPress={() => onKey(k)} className="h-12 text-2xl font-semibold tabular-nums tall:h-[4.5rem] tall:text-3xl">
                {k}
              </Key>
            ))}
            {field === 'amount' ? (
              <Key onPress={() => onKey('000')} className="h-12 text-xl font-semibold tabular-nums tall:h-[4.5rem] tall:text-2xl">
                000
              </Key>
            ) : (
              <Key onPress={onClear} className="h-12 text-base font-medium text-muted-foreground tall:h-[4.5rem] tall:text-lg">
                Tozalash
              </Key>
            )}
            <Key onPress={() => onKey('0')} className="h-12 text-2xl font-semibold tabular-nums tall:h-[4.5rem] tall:text-3xl">
              0
            </Key>
            <Key onPress={onBackspace} onHold={onClear} label="O'chirish" className="h-12 text-muted-foreground tall:h-[4.5rem]">
              <RiDeleteBack2Line className="size-7 tall:size-8" />
            </Key>
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onNext}
            className="flex h-12 touch-manipulation items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform select-none active:scale-[.98] tall:h-14 tall:rounded-2xl tall:text-lg"
          >
            {nextLabel}
            <RiArrowRightLine className="size-5" />
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-1.5 tall:gap-2">
          {LETTER_ROWS.map((row, i) => (
            <div key={i} className="flex justify-center gap-1.5">
              {row.map((k) => (
                <Key key={k} onPress={() => onKey(k)} className="h-11 min-w-0 flex-1 text-lg font-medium tall:h-14 tall:text-xl">
                  {capitalizeNext ? k.toUpperCase() : k}
                </Key>
              ))}
              {i === 2 && (
                <Key onPress={onBackspace} onHold={onClear} label="O'chirish" className="h-11 flex-[1.6] text-muted-foreground tall:h-14">
                  <RiDeleteBack2Line className="size-6" />
                </Key>
              )}
            </div>
          ))}
          <div className="flex gap-1.5">
            <Key onPress={() => onKey("'")} label="Tutuq belgisi (o', g')" className="h-11 w-14 shrink-0 text-2xl font-semibold tall:h-14 tall:w-16">
              &apos;
            </Key>
            <Key onPress={() => onKey(' ')} label="Bo'sh joy" className="h-11 flex-1 text-sm text-muted-foreground tall:h-14">
              bo&apos;sh joy
            </Key>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onNext}
              className="flex h-11 w-28 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform select-none active:scale-95 tall:h-14 tall:w-32 tall:rounded-2xl tall:text-lg"
            >
              <RiCheckLine className="size-5" />
              {nextLabel}
            </button>
          </div>
          <p className="hidden text-center text-xs text-muted-foreground tall:block">O&apos;, G&apos; uchun: o va g dan keyin «&apos;» bosing</p>
        </div>
      )}
    </div>
  );
}
