/** Rasmni data URL ↔ bayt. Faqat PNG/JPEG/WEBP, sarlavha baytlari bilan tekshiriladi. */
export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export function sniffImage(buf: Uint8Array): ImageMime | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && Buffer.from(buf.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(buf.subarray(8, 12)).toString() === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/** "data:image/png;base64,…" → bayt; noto'g'ri yoki katta bo'lsa — xato matni */
export function decodeImageDataUrl(s: string, maxBytes: number, only?: ImageMime): Uint8Array<ArrayBuffer> | string {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) return 'Rasm formati noto\'g\'ri';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > maxBytes) return `Rasm juda katta (ko'pi bilan ${Math.round(maxBytes / 1024)} KB)`;
  const mime = sniffImage(buf);
  if (!mime || (only && mime !== only)) return 'Rasm formati noto\'g\'ri';
  // Prisma Bytes — oddiy ArrayBuffer'li Uint8Array
  return new Uint8Array(buf);
}

export function toImageDataUrl(buf: Uint8Array | null | undefined): string | null {
  if (!buf?.length) return null;
  const mime = sniffImage(buf) ?? 'image/png';
  return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
}
