// Bot matnlari — o'zbek (lotin). Oddiy va qisqa.

export const BTN = {
  sendPhone: "📱 Raqamni yuborish",
  invite: '👥 Taklif qilish',
  contact: '☎️ Aloqa',
} as const;

/**
 * Bot profili. `description` — bo'sh chatda /start'dan oldin ko'rinadi ("Bu bot nima qila oladi?"),
 * ≤512 belgi. `shortDescription` — bot profili va ulashilgan havolada, ≤120 belgi. Oddiy matn (HTML emas).
 */
export const BOT_PROFILE = {
  description:
    `🚗 “KIA SONET MENIKI” — Fazo Group aksiyasi!\n\n` +
    `Fazo'da ovqatlaning va kassir bergan QR'ni telefon kamerasi bilan skanerlang — ` +
    `kuponlar darhol hisobingizga tushadi. Chek qancha katta bo'lsa, kupon shuncha ko'p.\n\n` +
    `🎁 Har oy sovg'alar o'ynaladi\n` +
    `🏆 Yil oxirida — KIA Sonet avtomobili\n\n` +
    `Boshlash uchun pastdagi tugmani bosing 👇`,
  shortDescription: `“KIA SONET MENIKI”: chekdagi QR'ni skanerlang, kupon yig'ing — har oy sovg'alar, yil oxirida KIA Sonet 🚗`,
} as const;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const T = {
  /**
   * Yagona ro'yxatdan o'tish xabari: raqam so'raladi, rozilik shu yerda —
   * raqamni yuborish = qoidalarga rozilik (alohida "Roziman" yo'q).
   */
  welcome: (name: string | undefined, rulesUrl: string, waitingCoupons: number | null) =>
    `Assalomu alaykum${name ? `, ${esc(name)}` : ''}! 👋\n\n` +
    (waitingCoupons
      ? `🎟 <b>${waitingCoupons} ta kupon</b> sizni kutyapti! Olish uchun telefon raqamingizni yuboring 👇`
      : `<b>Fazo Group</b> — “KIA SONET MENIKI” aksiyasi. Kassir bergan QR'ni skanerlab kupon olasiz: ` +
        `har oy sovg'alar, yil oxirida KIA Sonet avtomobili 🚗\n\nBoshlash uchun telefon raqamingizni yuboring 👇`) +
    `\n\n<i>Raqamni yuborish orqali aksiya <a href="${rulesUrl}">qoidalari</a>ga va ma'lumotlaringiz ` +
    `qayta ishlanishiga rozilik bildirasiz.</i>`,

  askPhone: `Telefon raqamingizni yuborish uchun pastdagi tugmani bosing 👇`,
  notOwnPhone: `❗️ Faqat o'zingizning raqamingizni yuboring. Pastdagi tugmani bosing 👇`,
  invalidPhone: `❗️ Faqat O'zbekiston raqami (+998) bilan ro'yxatdan o'tish mumkin.`,
  phoneTaken: (support: string) =>
    `❗️ Bu raqam boshqa Telegram akkauntga bog'langan.` + (support ? `\nAloqa: ${esc(support)}` : ''),

  home: (name?: string | null) =>
    `${name ? `${esc(name)}, ` : ''}Fazo Group'ga xush kelibsiz! 🎉\n\n` +
    `Kassir bergan QR'ni telefon kamerasi bilan skanerlang — kupon darhol qo'shiladi. ` +
    `Har oy sovg'alar, yil oxirida KIA Sonet avtomobili 🚗`,

  referralHint: (coupons: number) =>
    `\n\n👥 Do'stingizni taklif qiling: u birinchi xaridini qilsa, sizga <b>+${coupons} kupon</b>.`,

  inviteShare: "Fazo'da ovqatlaning, chekdagi QR kodni skanerlang — oylik sovg'alar va yil oxirida KIA Sonet o'yini 🚗",

  contact: (support: string) =>
    support ? `☎️ Savol va takliflar uchun: ${esc(support)}` : `☎️ Aloqa ma'lumotlari tez orada qo'shiladi.`,

  blocked: `⛔️ Akkauntingiz bloklangan. Savollar bo'lsa, aloqaga chiqing.`,
  needRegister: `Avval ro'yxatdan o'ting: /start`,
} as const;

export { esc };
