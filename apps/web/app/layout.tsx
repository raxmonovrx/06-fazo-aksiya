import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';

// Admin panel shrifti (restobrain bilan bir xil). Faqat o'zgaruvchi beriladi —
// qo'llanishi globals.css dagi `.admin-root` da, mini app'ga tegmaydi.
const geistSans = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Fazo Group — “KIA SONET MENIKI”',
  description: 'Ovqatlan — mashina yut! Fazo Group aksiyasi',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // iPhone chekkalari (notch, home indicator) — safe area CSS bilan boshqariladi
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="uz"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
