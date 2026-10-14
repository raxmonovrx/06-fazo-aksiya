'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Mavzu (yorug'/qorong'i/tizim) — brauzer darajasidagi shaxsiy tanlov.
 *
 * `attribute="class"` <html> ga `.dark` qo'yadi — globals.css dagi
 * `@custom-variant dark (&:is(.dark *))` va `.dark { … }` bloki aynan
 * shunga tayanadi, shuning uchun barcha `dark:` utilitalari darhol ishlaydi.
 *
 * next-themes tanlovni localStorage'ga yozadi va birinchi chizishdan OLDIN
 * inline skript bilan qaytadan qo'yadi — sahifa yangilanganda noto'g'ri
 * mavzu bir lahza ham ko'rinmaydi.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Faqat admin panel uchun — mini app Telegram mavzusiga ergashadi
      storageKey="fazo-admin-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
