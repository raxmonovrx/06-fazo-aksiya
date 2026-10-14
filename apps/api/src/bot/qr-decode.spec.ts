import QRCode from 'qrcode';
import sharp from 'sharp';

import { decodeQrFromImage } from './qr-decode.js';

const REAL = 'https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261011205251&s=047808378930';

async function receiptPhoto(opts: { rotate?: number; blur?: number; quality?: number; qrWidth?: number }) {
  const qr = await QRCode.toBuffer(REAL, { width: opts.qrWidth ?? 220, margin: 2 });
  // Chekka o'xshash: oq "qog'oz", yuqorida matn o'rnida kulrang chiziqlar, pastda QR
  const lines = Array.from({ length: 12 }, (_, i) => ({
    input: { create: { width: 500, height: 8, channels: 3 as const, background: '#555' } },
    top: 40 + i * 30,
    left: 60,
  }));
  let img = sharp({ create: { width: 620, height: 1000, channels: 3, background: '#f4f1ea' } })
    .composite([...lines, { input: qr, top: 460, left: 200 }])
    .jpeg({ quality: opts.quality ?? 85 });
  let buf = await img.toBuffer();
  img = sharp(buf);
  if (opts.blur) img = img.blur(opts.blur);
  if (opts.rotate) img = img.rotate(opts.rotate, { background: '#333' });
  // Telefon kamerasidek kattalashtirish
  buf = await img.resize({ width: 1800 }).jpeg({ quality: opts.quality ?? 85 }).toBuffer();
  return buf;
}

describe('decodeQrFromImage', () => {
  it('oddiy chek rasmidan QR o\'qiydi', async () => {
    expect(await decodeQrFromImage(await receiptPhoto({}))).toBe(REAL);
  });

  it('qiyshiq, xira va siqilgan rasm', async () => {
    expect(await decodeQrFromImage(await receiptPhoto({ rotate: 17, blur: 1.2, quality: 45 }))).toBe(REAL);
  });

  it('90° burilgan', async () => {
    expect(await decodeQrFromImage(await receiptPhoto({ rotate: 90 }))).toBe(REAL);
  });

  it('QR yo\'q rasm → null', async () => {
    const blank = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    expect(await decodeQrFromImage(blank)).toBeNull();
  });

  it('rasm emas → null', async () => {
    expect(await decodeQrFromImage(Buffer.from('salom dunyo'))).toBeNull();
  });
});
