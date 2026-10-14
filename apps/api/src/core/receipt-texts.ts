import { z } from 'zod';

/** Chekdagi tahrirlanadigan matnlar (filial bo'yicha). Bo'sh satr — chekda chiqmaydi. */
export const receiptTextsSchema = z.object({
  title: z.string().trim().max(40),
  subtitle: z.string().trim().max(80),
  hint: z.string().trim().max(160),
  footer: z.string().trim().max(200),
});
export type ReceiptTexts = z.infer<typeof receiptTextsSchema>;

export const DEFAULT_RECEIPT_TEXTS: ReceiptTexts = {
  title: 'FAZO GROUP',
  subtitle: '“KIA SONET MENIKI” aksiyasi',
  hint: 'Telefon kamerasi bilan skanerlang\nva botda «Start»ni bosing',
  footer: '',
};

/** Bazadagi qiymat (null yoki chala) → to'liq matnlar */
export function resolveReceiptTexts(raw: unknown): ReceiptTexts {
  const parsed = receiptTextsSchema.partial().safeParse(raw ?? {});
  return { ...DEFAULT_RECEIPT_TEXTS, ...(parsed.success ? parsed.data : {}) };
}
