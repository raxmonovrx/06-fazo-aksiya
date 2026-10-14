// Bot matnlari — o'zbek (lotin). Oddiy va qisqa.

export const BTN = {
  sendPhone: "📱 Raqamni yuborish",
  invite: '👥 Taklif qilish',
  contact: '☎️ Aloqa',
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

  inviteShare: "Fazo'da ovqatlaning, chekdagi QR kodni skanerlang — oylik sovg'alar va yil oxirida KIA Sonet o'yini 🚗",

  contact: (support: string) =>
    support ? `☎️ Savol va takliflar uchun: ${esc(support)}` : `☎️ Aloqa ma'lumotlari tez orada qo'shiladi.`,

  blocked: `⛔️ Akkauntingiz bloklangan. Savollar bo'lsa, aloqaga chiqing.`,
  needRegister: `Avval ro'yxatdan o'ting: /start`,
} as const;

export { esc };
