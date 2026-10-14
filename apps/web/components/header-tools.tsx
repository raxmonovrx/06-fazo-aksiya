'use client';

import { RiMoonLine, RiSunLine } from '@remixicon/react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/use-hydrated';
import { cn } from '@/lib/utils';

/** Header'dagi hamma tugmalar uchun bitta ko'rinish */
export const HEADER_CONTROL =
  'inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border/70 text-muted-foreground ring-ring outline-hidden transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2';

/**
 * Yorug'/qorong'i — bir bosishda («Tizim bo'yicha» foydalanuvchi menyusida).
 * Tanlov localStorage'da, server render'ida yo'q — gidratsiyagacha ikonka
 * chizilmaydi (sakramasin).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const dark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className={cn(HEADER_CONTROL, 'w-9')}
      aria-label={dark ? "Yorug' rejimga o'tish" : "Qorong'i rejimga o'tish"}
      title={dark ? "Yorug' rejim" : "Qorong'i rejim"}
    >
      {hydrated &&
        (dark ? (
          <RiSunLine className="size-[18px]" />
        ) : (
          <RiMoonLine className="size-[18px]" />
        ))}
    </Button>
  );
}
