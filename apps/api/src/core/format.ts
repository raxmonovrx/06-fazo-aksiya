/** 650000 → "650 000" (so'msiz) */
export const fmtSum = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ');
