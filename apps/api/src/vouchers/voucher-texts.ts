import { esc } from '../bot/texts.js';
import { fmtSum } from '../reconcile/reconcile.service.js';
import type { RedeemResult } from './vouchers.service.js';
import { VOUCHER_TTL_HOURS } from './vouchers.service.js';

/** Bot uchun vaucher natijasi matni (HTML). */
export function redeemMessage(r: RedeemResult): string {
  switch (r.code) {
    case 'REDEEMED':
      return (
        `🎉 <b>+${r.couponsCount} kupon</b> qo'shildi!\n` +
        `${esc(r.branchName ?? '')} · ${fmtSum(r.amount ?? 0)} so'm\n\n` +
        (r.isStaff ? `ℹ️ Fazo xodimlari o'yinda qatnashmaydi.` : `🎟 Jami kuponlaringiz: <b>${r.totalCoupons} ta</b>`)
      );
    case 'ALREADY_YOURS':
      return `✅ Bu QR'ni siz allaqachon ishlatgansiz.`;
    case 'USED':
      return `❌ Bu QR allaqachon ishlatilgan.`;
    case 'EXPIRED':
      return `⌛️ Bu QR'ning muddati o'tgan (${VOUCHER_TTL_HOURS} soat).`;
    case 'CANCELLED':
      return `❌ Bu QR bekor qilingan.`;
    case 'NO_CAMPAIGN':
      return `Hozir faol aksiya yo'q.`;
    case 'RATE_LIMIT':
      return `Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.`;
    case 'BLOCKED':
      return `⛔️ Akkauntingiz bloklangan.`;
    default:
      return `❌ QR yaroqsiz. Kassirdan berilgan Fazo Club QR'ini skanerlang.`;
  }
}

export const FISCAL_DISABLED =
  `Bu soliq cheki QR'i 🙂\nKupon olish uchun kassirdan <b>Fazo Club QR</b>'ini so'rang va telefon kamerasi bilan skanerlang.`;
export const PHOTO_NO_QR = `Rasmda Fazo Club QR'i topilmadi.\nKassir bergan QR'ni telefon kamerasi bilan skanerlang.`;
export const PENDING_SAVED = `QR qabul qilindi ✅ Ro'yxatdan o'tishingiz bilan kuponlar qo'shiladi.`;
