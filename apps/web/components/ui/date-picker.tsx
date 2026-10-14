"use client"

import * as React from "react"
import { RiCalendarLine, RiCloseLine } from "@remixicon/react"
import { uz } from "react-day-picker/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/*
 * Sana tanlash — shadcn Calendar + Popover (brauzerning `type="date"`
 * maydoni o'rniga: u har brauzerda boshqacha ko'rinadi, telefonda esa
 * tug'ilgan yilga yetish uchun o'nlab oy varaqlash kerak edi).
 *
 * Qiymat — `YYYY-MM-DD` satr (API shu formatni kutadi), bo'sh = "".
 * Oy va hafta kunlari o'zbekcha lotinda: date-fns `uz` lokali oylarni
 * eski imloda ("Sentabr") beradi, shuning uchun nomlar shu yerda.
 */

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
]
/** `Date.getDay()` tartibida (0 = yakshanba) */
const WEEKDAYS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"]

const pad = (n: number) => String(n).padStart(2, "0")
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** `YYYY-MM-DD` → mahalliy yarim tun (UTC emas — aks holda Toshkentda kun siljiydi) */
function parseDay(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return undefined
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? undefined : d
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface DatePickerProps {
  id?: string
  /** `YYYY-MM-DD` yoki "" */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Tozalash tugmasi (ixtiyoriy maydon uchun) */
  clearable?: boolean
  /** Yil ro'yxati chegarasi — tug'ilgan sana uchun 1940…bugun */
  fromYear?: number
  toYear?: number
  /** Kalendar ochilganda ko'rinadigan oy (qiymat bo'sh bo'lsa) */
  defaultMonth?: Date
  disabled?: boolean
  /** Eng erta tanlanadigan kun, `YYYY-MM-DD` (masalan bron — bugundan) */
  min?: string
  /** Eng kech tanlanadigan kun, `YYYY-MM-DD` (masalan shikoyat sanasi — bugungacha) */
  max?: string
  /** Tugmadagi yozuv — standart `dd.mm.yyyy` */
  formatLabel?: (date: Date) => string
  "aria-invalid"?: boolean
  className?: string
}

function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Sanani tanlang",
  clearable = false,
  fromYear,
  toYear,
  defaultMonth,
  disabled,
  min,
  max,
  formatLabel,
  "aria-invalid": ariaInvalid,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDay(value)
  const now = new Date()
  const startMonth = new Date(fromYear ?? now.getFullYear() - 80, 0, 1)
  const endMonth = new Date(toYear ?? now.getFullYear() + 5, 11, 31)

  return (
    <div className={cn("relative", className)}>
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
                "w-full justify-start gap-2 font-normal aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
                !selected && "text-muted-foreground",
                clearable && selected && "pr-8"
              )}
            />
          }
        >
          <RiCalendarLine data-icon="inline-start" />
          <span className="truncate">
            {selected
              ? (formatLabel?.(selected) ??
                `${pad(selected.getDate())}.${pad(selected.getMonth() + 1)}.${selected.getFullYear()}`)
              : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => {
              onChange(d ? dayKey(d) : "")
              setOpen(false)
            }}
            defaultMonth={selected ?? defaultMonth}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            weekStartsOn={1}
            disabled={
              min || max
                ? [...(min ? [{ before: parseDay(min)! }] : []), ...(max ? [{ after: parseDay(max)! }] : [])]
                : undefined
            }
            locale={uz}
            formatters={{
              formatCaption: (month) =>
                `${capitalize(MONTHS[month.getMonth()]!)} ${month.getFullYear()}`,
              formatMonthDropdown: (month) =>
                capitalize(MONTHS[month.getMonth()]!),
              formatWeekdayName: (weekday) => WEEKDAYS[weekday.getDay()]!,
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && selected && !disabled && (
        // Trigger ichida emas — tugma ichida tugma bo'lolmaydi (HTML)
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground"
          aria-label="Sanani tozalash"
          onClick={() => onChange("")}
        >
          <RiCloseLine />
        </Button>
      )}
    </div>
  )
}

export { DatePicker }
