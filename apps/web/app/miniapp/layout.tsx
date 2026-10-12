import Script from 'next/script';

export const metadata = { title: 'Fazo Club' };
// HTML keshlanmasin: Telegram WebView eski sahifani (eski JS havolalari bilan) ochib qolmasin.
// /_next/static fayllari hash'li — ular baribir uzoq keshlanadi.
export const dynamic = 'force-dynamic';

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      {children}
    </>
  );
}
