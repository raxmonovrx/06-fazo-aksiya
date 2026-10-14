'use client';

/**
 * Vaucher QR'ini termoprinterga (58/80 mm) chop etish. Alohida yashirin iframe
 * ichida — panel sahifasi bosma uslublariga aralashmaydi. Brauzer bosma oynasida
 * kassa printeri tanlanadi (bir marta tanlansa, keyin eslab qoladi).
 */
export interface PrintableVoucher {
  id: number;
  amount: number;
  couponsCount: number;
  branchName: string;
  issuedAt: string;
  expiresAt: string;
  qrSvg: string;
}

export type PaperWidth = 58 | 80;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
const dt = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace(',', '');

export function ticketHtml(v: PrintableVoucher, paper: PaperWidth): string {
  const width = paper === 80 ? 72 : 48; // chop etiladigan kenglik (mm)
  const qr = paper === 80 ? 52 : 40;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Fazo Club #${v.id}</title><style>
@page { size: ${paper}mm auto; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; width: ${paper}mm; font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #000; }
.t { width: ${width}mm; margin: 0 auto; padding: 4mm 0 6mm; text-align: center; }
.brand { font-size: ${paper === 80 ? 18 : 15}px; font-weight: 800; letter-spacing: .5px; }
.sub { font-size: 11px; margin-top: 1mm; }
.hr { border-top: 1px dashed #000; margin: 3mm 0; }
.big { font-size: ${paper === 80 ? 26 : 22}px; font-weight: 800; margin: 1mm 0; }
.row { font-size: 12px; margin-top: .8mm; }
.qr { width: ${qr}mm; height: ${qr}mm; margin: 3mm auto 2mm; }
.qr svg { width: 100%; height: 100%; display: block; }
.hint { font-size: 12px; font-weight: 600; line-height: 1.35; }
.small { font-size: 10px; margin-top: 1.5mm; }
</style></head><body><div class="t">
<div class="brand">FAZO CLUB</div>
<div class="sub">Fazo Group</div>
<div class="hr"></div>
<div class="big">${v.couponsCount} KUPON</div>
<div class="row">${esc(v.branchName)} · ${sum(v.amount)} so'm</div>
<div class="row">${dt(v.issuedAt)} · #${v.id}</div>
<div class="qr">${v.qrSvg}</div>
<div class="hint">Telefon kamerasi bilan skanerlang<br>va botda «Start»ni bosing</div>
<div class="small">Amal qiladi: ${dt(v.expiresAt)} gacha<br>Bir martalik QR</div>
</div></body></html>`;
}

/** Yashirin iframe orqali bosma oynasini ochadi. */
export function printVoucher(v: PrintableVoucher, paper: PaperWidth) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(ticketHtml(v, paper));
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  frame.contentWindow!.onafterprint = cleanup;
  // SVG chizilishiga ulgursin
  setTimeout(() => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    setTimeout(cleanup, 60_000);
  }, 150);
}
