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
        'grid touch-manipulation place-items-center rounded-2xl bg-muted text-foreground transition-[transform,background-color] select-none',
        'hover:bg-muted/70 active:scale-95 active:bg-primary/20',
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
    <div className="flex flex-col gap-3" role="group" aria-label="Ekran klaviaturasi">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1">
        {FIELDS.map((f) => (
          <button
            key={f.key}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onField(f.key)}
            className={cn(
              'h-11 touch-manipulation rounded-xl text-base font-medium transition-colors select-none',
              field === f.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {digits ? (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <Key key={k} onPress={() => onKey(k)} className="h-[4.5rem] text-3xl font-semibold tabular-nums">
                {k}
              </Key>
            ))}
            {field === 'amount' ? (
              <Key onPress={() => onKey('000')} className="h-[4.5rem] text-2xl font-semibold tabular-nums">
                000
              </Key>
            ) : (
              <Key onPress={onClear} className="h-[4.5rem] text-lg font-medium text-muted-foreground">
                Tozalash
              </Key>
            )}
            <Key onPress={() => onKey('0')} className="h-[4.5rem] text-3xl font-semibold tabular-nums">
              0
            </Key>
            <Key onPress={onBackspace} onHold={onClear} label="O'chirish" className="h-[4.5rem] text-muted-foreground">
              <RiDeleteBack2Line className="size-8" />
            </Key>
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onNext}
            className="flex h-14 touch-manipulation items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground transition-transform select-none active:scale-[.98]"
          >
            {nextLabel}
            <RiArrowRightLine className="size-5" />
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {LETTER_ROWS.map((row, i) => (
            <div key={i} className="flex justify-center gap-1.5">
              {row.map((k) => (
                <Key key={k} onPress={() => onKey(k)} className="h-14 min-w-0 flex-1 text-xl font-medium">
                  {capitalizeNext ? k.toUpperCase() : k}
                </Key>
              ))}
              {i === 2 && (
                <Key onPress={onBackspace} onHold={onClear} label="O'chirish" className="h-14 flex-[1.6] text-muted-foreground">
                  <RiDeleteBack2Line className="size-6" />
                </Key>
              )}
            </div>
          ))}
          <div className="flex gap-1.5">
            <Key onPress={() => onKey("'")} label="Tutuq belgisi (o', g')" className="h-14 w-16 shrink-0 text-2xl font-semibold">
              &apos;
            </Key>
            <Key onPress={() => onKey(' ')} label="Bo'sh joy" className="h-14 flex-1 text-sm text-muted-foreground">
              bo&apos;sh joy
            </Key>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onNext}
              className="flex h-14 w-32 shrink-0 touch-manipulation items-center justify-center gap-1.5 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground transition-transform select-none active:scale-95"
            >
              <RiCheckLine className="size-5" />
              {nextLabel}
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">O&apos;, G&apos; uchun: o va g dan keyin «&apos;» bosing</p>
        </div>
      )}
    </div>
  );
}
