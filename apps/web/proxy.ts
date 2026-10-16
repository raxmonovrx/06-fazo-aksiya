import { NextResponse, type NextRequest } from 'next/server';

/**
 * Bitta Next ilovasi, ikki domen:
 *   promo.*   — mijozlar: `/` (bosh sahifa), `/miniapp`, `/rules`
 *   boshqasi  — admin panel (panel.*, lokalda localhost): `/dashboard`, `/vouchers`, `/cashier`…
 *               (`/admin` prefiksisiz). Panelning ildizi `/` — `/dashboard` ga yo'naltiriladi,
 *               chunki mijozlar bosh sahifasi ham `/` da.
 *
 * Rewrite ishlatilmaydi: nginx orqasida (X-Forwarded-Proto=https) Next ichki rewrite'ni
 * o'ziga https orqali yo'naltirib 500 berardi. Oddiy redirect esa ishonchli.
 */
const PANEL_PATHS = /^\/(login|dashboard|cashier|vouchers|participants|branches|staff|export|users|settings)(\/|$)/;

function origin(req: NextRequest, host: string) {
  const proto = req.headers.get('x-forwarded-proto') ?? (req.nextUrl.protocol.replace(':', '') || 'http');
  return `${proto}://${host}`;
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host;

  // Eski manzillar: /admin/vouchers → /vouchers (xatcho'plar buzilmasin)
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return NextResponse.redirect(new URL((pathname.slice('/admin'.length) || '/') + search, origin(req, host)), 308);
  }

  if (/^promo\./i.test(host)) {
    // Mijozlar domenida panel sahifalari yo'q — panel domeniga
    if (PANEL_PATHS.test(pathname)) {
      return NextResponse.redirect(new URL(pathname + search, origin(req, host.replace(/^promo\./i, 'panel.'))), 307);
    }
    return NextResponse.next();
  }

  // Panel domeni (va lokal dev)
  if (pathname === '/') return NextResponse.redirect(new URL('/dashboard' + search, origin(req, host)), 307);
  return NextResponse.next();
}

export const config = {
  // API, statik fayllar va rasmlar proxy'dan o'tmaydi
  matcher: ['/((?!api/|_next/|favicon\\.ico|.*\\.[a-z0-9]+$).*)'],
};
