'use client';

/**
 * Chek logosi: istalgan rasmni termoprinter uchun toza oq-qora PNG ga aylantiradi.
 * Hammasi brauzerda (canvas) — server faqat tayyor natijani saqlaydi.
 *
 * 1. Asl rasm oq fonga qo'yiladi (shaffof PNG ham), ko'pi bilan 800px — qayta sozlash uchun saqlanadi.
 * 2. Kulrangga o'tkaziladi, chegara (threshold) Otsu usuli bilan avtomatik tanlanadi.
 * 3. To'q fonli logo (masalan qora fonda oq yozuv) o'zi aniqlanadi — ranglar almashtiriladi.
 * 4. Bo'sh oq chetlar kesiladi, natija ko'pi bilan 480px, faqat 2 rang.
 */

const ORIGINAL_MAX = 800;
const PRINT_MAX = 480;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return { c, ctx: c.getContext('2d', { willReadFrequently: true })! };
}

/** Yuklangan fayl → asl rasm (oq fon, ≤800px, JPEG data URL) */
export async function prepareOriginal(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Faqat rasm fayli (PNG, JPG, SVG, WEBP)');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || 600;
    const h = img.naturalHeight || 600;
    const k = Math.min(1, ORIGINAL_MAX / Math.max(w, h));
    const { c, ctx } = canvas(w * k, h * k);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

/** Rasm uchun tavsiya: Otsu chegarasi va to'q fonmi */
export function suggest(img: HTMLImageElement): { threshold: number; invert: boolean } {
  const { c, ctx } = canvas(Math.min(img.naturalWidth, 300), Math.min(img.naturalHeight, 300));
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < d.length; i += 4) hist[Math.round(lum(d, i))]++;
  const total = d.length / 4;

  // Otsu: sinflar orasidagi dispersiya eng katta bo'lgan chegara
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 160;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  threshold = Math.min(230, Math.max(40, threshold + 1));

  // Chetdagi piksellarning ko'pi to'q bo'lsa — fon to'q, ranglarni almashtiramiz
  let edge = 0;
  let dark = 0;
  for (let x = 0; x < c.width; x++) {
    for (const y of [0, c.height - 1]) {
      edge++;
      if (lum(d, (y * c.width + x) * 4) < threshold) dark++;
    }
  }
  for (let y = 0; y < c.height; y++) {
    for (const x of [0, c.width - 1]) {
      edge++;
      if (lum(d, (y * c.width + x) * 4) < threshold) dark++;
    }
  }
  return { threshold, invert: dark / edge > 0.6 };
}

/** Asl rasm → chek uchun oq-qora PNG (data URL). Logo butunlay oq bo'lib qolsa — null. */
export function toPrint(img: HTMLImageElement, threshold: number, invert: boolean): string | null {
  // Ishchi o'lcham: chetlarni topish uchun
  const k = Math.min(1, 600 / Math.max(img.naturalWidth, img.naturalHeight));
  const { c: work, ctx } = canvas(img.naturalWidth * k, img.naturalHeight * k);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, work.width, work.height);
  ctx.drawImage(img, 0, 0, work.width, work.height);
  const d = ctx.getImageData(0, 0, work.width, work.height).data;
  const isInk = (i: number) => (lum(d, i) < threshold) !== invert;

  let x0 = work.width;
  let y0 = work.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < work.height; y++) {
    for (let x = 0; x < work.width; x++) {
      if (!isInk((y * work.width + x) * 4)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;

  // Kesilgan qism + kichik bo'sh joy, ko'pi bilan 480px
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03);
  const sx = Math.max(0, x0 - pad) / k;
  const sy = Math.max(0, y0 - pad) / k;
  const sw = (Math.min(work.width - 1, x1 + pad) + 1) / k - sx;
  const sh = (Math.min(work.height - 1, y1 + pad) + 1) / k - sy;
  const s = Math.min(1, PRINT_MAX / Math.max(sw, sh));
  const { c: out, ctx: o } = canvas(sw * s, sh * s);
  o.fillStyle = '#fff';
  o.fillRect(0, 0, out.width, out.height);
  o.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);

  // Yakuniy o'lchamda chegaralash — faqat sof qora va oq
  const px = o.getImageData(0, 0, out.width, out.height);
  const p = px.data;
  for (let i = 0; i < p.length; i += 4) {
    const v = (lum(p, i) < threshold) !== invert ? 0 : 255;
    p[i] = p[i + 1] = p[i + 2] = v;
    p[i + 3] = 255;
  }
  o.putImageData(px, 0, 0);
  return out.toDataURL('image/png');
}
