import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Fazo Club — Omad Fazosi',
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
    <html lang="uz" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
