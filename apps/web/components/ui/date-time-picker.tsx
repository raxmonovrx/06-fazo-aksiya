'use client';

import { RiCalendarLine, RiCloseLine } from '@remixicon/react';
import * as React from 'react';
import { uz } from 'react-day-picker/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/*
 * Sana + vaqt — brauzerning `type="datetime-local"` maydoni o'rniga
 * (date-picker.tsx bilan bir xil ko'rinish, ostida soat:daqiqa).
 *
 * Qiymat — `YYYY-MM-DDTHH:mm` (datetime-local formati — API'ga avvalgidek
 * ketadi), bo'sh = "".
 */

const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentyabr',
  'oktyabr',
  'noyabr',
  'dekabr',
];
const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

const pad = (n: number) => String(n).padStart(2, '0');
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function parse(value: string): { day?: Date; time: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!m) return { time: '' };
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return {
    day: Number.isNaN(day.getTime()) ? undefined : day,
    time: m[4] ? `${m[4]}:${m[5]}` : '',
  };
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "9:5", "0930", "9" → "09:05" / "09:30" / "09:00"; noto'g'ri bo'lsa null */
function normalizeTime(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const m = raw.includes(':')
    ? /^(\d{1,2}):(\d{0,2})$/.exec(raw.trim())
    : /^(\d{1,2}?)(\d{2})?$/.exec(digits);
  if (!m) return null;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

interface DateTimePickerProps {
  id?: string;
  /** `YYYY-MM-DDTHH:mm` yoki "" */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  /** Kun tanlanganda vaqt bo'sh bo'lsa shu qo'yiladi */
  defaultTime?: string;
  'aria-invalid'?: boolean;
  className?: string;
}

function DateTimePicker({
  id,
  value,
  onChange,
  placeholder = 'Sana va vaqtni tanlang',
  clearable = false,
  disabled,
  defaultTime = '00:00',
  'aria-invalid': ariaInvalid,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const { day, time } = parse(value);
  const [timeDraft, setTimeDraft] = React.useState(time);
  const [seenTime, setSeenTime] = React.useState(time);
  if (seenTime !== time) {
    setSeenTime(time);
    setTimeDraft(time);
  }
  const timeId = React.useId();
  const now = new Date();

  const commitTime = () => {
    const t = normalizeTime(timeDraft);
    if (!t || !day) {
      setTimeDraft(time);
      return;
    }
    onChange(`${dayKey(day)}T${t}`);
  };

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={ariaInvalid}
              className={cn(
                'w-full justify-start gap-2 font-normal aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
                !day && 'text-muted-foreground',
                clearable && day && 'pr-8',
              )}
            />
          }
        >
          <RiCalendarLine data-icon="inline-start" />
          <span className="truncate">
            {day
              ? `${pad(day.getDate())}.${pad(day.getMonth() + 1)}.${day.getFullYear()} ${time || defaultTime}`
              : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={day}
            onSelect={(d) => {
              if (!d) return onChange('');
              onChange(`${dayKey(d)}T${time || defaultTime}`);
            }}
            defaultMonth={day}
            captionLayout="dropdown"
            startMonth={new Date(now.getFullYear() - 5, 0, 1)}
            endMonth={new Date(now.getFullYear() + 5, 11, 31)}
            weekStartsOn={1}
            locale={uz}
            formatters={{
              formatCaption: (month) =>
                `${capitalize(MONTHS[month.getMonth()]!)} ${month.getFullYear()}`,
              formatMonthDropdown: (month) =>
                capitalize(MONTHS[month.getMonth()]!),
              formatWeekdayName: (weekday) => WEEKDAYS[weekday.getDay()]!,
            }}
          />
          <div className="flex items-center gap-3 border-t p-3">
            <Label htmlFor={timeId} className="text-muted-foreground">
              Vaqt
            </Label>
            <Input
              id={timeId}
              inputMode="numeric"
              placeholder="ss:dd"
              className="h-8 w-24 tabular-nums"
              value={timeDraft}
              disabled={!day}
              onChange={(e) => setTimeDraft(e.target.value)}
              onBlur={commitTime}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitTime();
                  setOpen(false);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              onClick={() => {
                commitTime();
                setOpen(false);
              }}
            >
              Tayyor
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {clearable && day && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          aria-label="Tozalash"
          onClick={() => onChange('')}
        >
          <RiCloseLine />
        </Button>
      )}
    </div>
  );
}

export { DateTimePicker };
