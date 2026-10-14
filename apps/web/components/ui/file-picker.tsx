'use client';

import { RiCloseLine, RiUploadCloud2Line } from '@remixicon/react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/*
 * Fayl tanlash — brauzerning `type="file"` maydoni o'rniga: tanlash
 * tugmasi + tanlangan fayl nomi, ustiga tashlab qo'yish (drag & drop) ham.
 * Haqiqiy <input> yashirin — faqat fayl oynasini ochish uchun.
 */

interface FilePickerProps {
  id?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  /** `accept` — masalan ".xlsx,.csv" yoki "image/*" */
  accept?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

function FilePicker({
  id,
  value,
  onChange,
  accept,
  placeholder = 'Faylni tanlang yoki shu yerga tashlang',
  hint,
  disabled,
  className,
}: FilePickerProps) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-dashed border-input px-3 py-2.5 transition-colors',
        over && 'border-primary bg-primary/5',
        disabled && 'opacity-50',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file && !disabled) onChange(file);
      }}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <RiUploadCloud2Line className="size-[18px]" />
      </span>
      <div className="grid min-w-0 flex-1 leading-tight">
        <span
          className={cn('truncate text-sm', !value && 'text-muted-foreground')}
        >
          {value ? value.name : placeholder}
        </span>
        {(value || hint) && (
          <span className="truncate text-xs text-muted-foreground">
            {value ? `${(value.size / 1024).toFixed(0)} KB` : hint}
          </span>
        )}
      </div>
      {value && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Faylni olib tashlash"
          onClick={() => {
            onChange(null);
            if (ref.current) ref.current.value = '';
          }}
        >
          <RiCloseLine />
        </Button>
      ) : null}
      <Button
        id={id}
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => ref.current?.click()}
      >
        Tanlash
      </Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          // Aynan o'sha faylni qayta tanlash ham `change` bersin
          e.target.value = '';
        }}
      />
    </div>
  );
}

export { FilePicker };
