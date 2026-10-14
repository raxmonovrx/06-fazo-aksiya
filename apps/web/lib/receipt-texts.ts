/** Chek matnlari — apps/api/src/core/receipt-texts.ts bilan bir xil */
export interface ReceiptTexts {
  title: string;
  subtitle: string;
  hint: string;
  footer: string;
}

export const DEFAULT_RECEIPT_TEXTS: ReceiptTexts = {
  title: 'FAZO GROUP',
  subtitle: '“KIA SONET MENIKI” aksiyasi',
  hint: 'Telefon kamerasi bilan skanerlang\nva botda «Start»ni bosing',
  footer: '',
};

export const RECEIPT_TEXT_LIMITS: Record<keyof ReceiptTexts, number> = { title: 40, subtitle: 80, hint: 160, footer: 200 };
