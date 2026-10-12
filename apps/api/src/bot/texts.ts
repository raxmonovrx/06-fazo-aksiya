// Bot matnlari — o'zbek (lotin). Oddiy va qisqa.

export const BTN = {
  sendPhone: "📱 Raqamni yuborish",
  agree: '✅ Roziman',
  invite: '👥 Taklif qilish',
  contact: '☎️ Aloqa',
} as const;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const T = {
  welcome: (name?: string) =>
    `Assalomu alaykum${name ? `, ${esc(name)}` : ''}! 👋\n\n` +
    `<b>Fazo Club</b> — <b>"Omad Fazosi"</b> aksiyasi.\n` +
    `Ovqatlan — mashina yut! 🚗\n\n` +
    `Fazo filiallaridagi har bir fiskal chek uchun kupon oling. ` +
    `Har oy sovg'alar, yil oxirida esa avtomobil o'ynaladi.\n\n` +
    `Boshlash uchun telefon raqamingizni yuboring 👇`,

  askPhone: `Telefon raqamingizni yuborish uchun pastdagi tugmani bosing 👇`,
  notOwnPhone: `❗️ Faqat o'zingizning raqamingizni yuboring. Pastdagi tugmani bosing 👇`,
  invalidPhone: `❗️ Faqat O'zbekiston raqami (+998) bilan ro'yxatdan o'tish mumkin.`,
  phoneTaken: (support: string) =>
    `❗️ Bu raqam boshqa Telegram akkauntga bog'langan.` + (support ? `\nAloqa: ${esc(support)}` : ''),

  rulesPrompt: (rulesUrl: string) =>
    `Rahmat! ✅\n\nAksiyada qatnashish uchun <a href="${rulesUrl}">qoidalar</a> bilan tanishing va rozilik bering.`,

  home: (name?: string | null) =>
    `${name ? `${esc(name)}, ` : ''}Fazo Club'ga xush kelibsiz! 🎉\n\n` +
    `Chek QR kodini skanerlang va kupon oling: har oy sovg'alar, yil oxirida avtomobil 🚗`,

  inviteShare: "Fazo'da ovqatlaning, chekdagi QR kodni skanerlang — oylik sovg'alar va yil oxirida avtomobil o'yini 🚗",

  contact: (support: string) =>
    support ? `☎️ Savol va takliflar uchun: ${esc(support)}` : `☎️ Aloqa ma'lumotlari tez orada qo'shiladi.`,

  blocked: `⛔️ Akkauntingiz bloklangan. Savollar bo'lsa, aloqaga chiqing.`,
  needRegister: `Avval ro'yxatdan o'ting: /start`,
} as const;

export { esc };
