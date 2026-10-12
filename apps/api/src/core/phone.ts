/**
 * Telefonni +998XXXXXXXXX ko'rinishiga keltiradi. O'zbek raqami bo'lmasa null.
 * Qabul qiladi: "+998 90 123-45-67", "998901234567", "901234567", "8 90 1234567".
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let digits = input.replace(/\D/g, '');
  if (digits.length === 9) digits = '998' + digits;
  else if (digits.length === 10 && digits.startsWith('8')) digits = '998' + digits.slice(1);
  if (!/^998\d{9}$/.test(digits)) return null;
  return '+' + digits;
}
