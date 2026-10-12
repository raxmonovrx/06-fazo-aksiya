import sharp, { type Sharp } from 'sharp';
import { readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';

const OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  tryDownscale: true,
  maxNumberOfSymbols: 4,
};

// Chek rasmlari turlicha: telefon kamerasi (katta, EXIF burilgan), skrinshot,
// g'ijim qog'oz. Bir nechta tayyorlov variantini navbat bilan sinaymiz.
const VARIANTS: Array<(img: Sharp) => Sharp> = [
  (img) => img.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).grayscale(),
  (img) => img.resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).grayscale().normalize().sharpen(),
  (img) => img.resize({ width: 1200, height: 1200, fit: 'inside' }).grayscale().normalize().threshold(140),
  (img) => img.resize({ width: 2400, height: 2400, fit: 'inside' }).grayscale().normalize().threshold(110),
];

const isReceiptQr = (t: string) => /^https?:\/\/(www\.)?ofd\.soliq\.uz\//i.test(t.trim());

/**
 * Rasmdan QR matnini o'qiydi. Avval fiskal chek QR'ini qidiradi; topilmasa
 * boshqa QR matnini qaytaradi (u keyin parserda rad etiladi); umuman yo'q bo'lsa null.
 */
export async function decodeQrFromImage(input: Buffer): Promise<string | null> {
  let fallback: string | null = null;
  const base = sharp(input, { failOn: 'none' }).rotate(); // EXIF bo'yicha burish

  for (const prepare of VARIANTS) {
    let png: Buffer;
    try {
      png = await prepare(base.clone()).png().toBuffer();
    } catch {
      return null; // rasm emas yoki buzilgan
    }
    const results = await readBarcodes(new Uint8Array(png), OPTIONS);
    for (const r of results) {
      if (!r.isValid || !r.text) continue;
      if (isReceiptQr(r.text)) return r.text.trim();
      fallback ??= r.text.trim();
    }
  }
  return fallback;
}
