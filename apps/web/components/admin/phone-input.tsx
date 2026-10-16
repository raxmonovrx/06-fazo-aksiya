'use client';

import { forwardRef } from 'react';

import { cn } from '@/lib/utils';

/**
 * Brauzer avtoto'ldirishi va takliflarini o'chiradi: kassada bir kompyuterda
 * yuzlab mijoz — oldingi mijoz raqami/ismi chiqib qolmasin.
 * `code` atayin ma'nosiz bo'lsin ("f1", "f2"): Chrome nom/telefon maydonini
 * `name` dan taniydi va autocomplete="off" ga qaramay to'ldiradi.
 */
export const noAutofill = (code: string) =>
  ({
    name: `fc-${code}`,
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    'data-1p-ignore': true,
    'data-lpignore': 'true',
    'data-form-type': 'other',
  }) as const;

/** 9 ta raqam → "90 123 4567" */
export function formatLocalPhone(digits: string) {
  const d = digits.slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}

/** Kiritilgan/joylangan matndan 9 ta mahalliy raqam ("+998 90…" ham, "90…" ham) */
export function phoneDigits(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.length > 9 && d.startsWith('998')) d = d.slice(3);
  return d.slice(0, 9);
}

/** 9 ta raqam to'liq bo'lsa "+998XXXXXXXXX", bo'sh bo'lsa null, chala bo'lsa undefined */
export function phoneValue(digits: string): string | null | undefined {
  if (!digits) return null;
  return digits.length === 9 ? `+998${digits}` : undefined;
}

interface PhoneInputProps {
  id?: string;
  /** Faqat 9 ta mahalliy raqam */
  value: string;
  onChange: (digits: string) => void;
  className?: string;
  inputClassName?: string;
  invalid?: boolean;
  /** Sensorli rejimda `none`: brauzer klaviaturasi chiqmaydi (o'zimizniki bor) */
  inputMode?: 'numeric' | 'none';
  onFocus?: () => void;
}

/** +998 XX XXX XXXX — prefiks qotirilgan, faqat raqam yoziladi */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { id, value, onChange, className, inputClassName, invalid, inputMode = 'numeric', onFocus },
  ref,
) {
  return (
    <div
      className={cn(
        'flex h-10 w-full items-center rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30',
        invalid && 'border-destructive ring-3 ring-destructive/20',
        className,
      )}
    >
      <span className="pl-3 font-medium text-muted-foreground tabular-nums select-none">+998</span>
      <input
        ref={ref}
        id={id}
        // type="tel" emas: Chrome tel maydonini profil raqami bilan to'ldirishga urinadi
        type="text"
        inputMode={inputMode}
        onFocus={onFocus}
        {...noAutofill('p9')}
        placeholder="XX XXX XXXX"
        aria-invalid={invalid || undefined}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent px-2 tabular-nums outline-none placeholder:text-muted-foreground/60',
          inputClassName,
        )}
        value={formatLocalPhone(value)}
        onChange={(e) => onChange(phoneDigits(e.target.value))}
      />
    </div>
  );
});
