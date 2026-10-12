// Bot matnlari — o'zbek (lotin). Oddiy va qisqa.

export const BTN = {
  sendPhone: "📱 Raqamni yuborish",
  agree: '✅ Roziman',
  addReceipt: "🧾 Chek qo'shish",
  myCoupons: '🎟 Kuponlarim',
  rules: '📜 Qoidalar',
  invite: "👥 Do'st taklif qilish",
  contact: '☎️ Aloqa',
  scan: "📷 QR'ni skanerlash",
  openApp: '🎟 Batafsil',
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

  registered:
    `🎉 Tabriklaymiz, siz ro'yxatdan o'tdingiz!\n\n` +
    `Endi Fazo filiallarida chek oling va uni <b>"🧾 Chek qo'shish"</b> orqali qo'shing.`,

  addReceipt: (canOpenApp: boolean) =>
    (canOpenApp
      ? `Chek pastidagi QR kodni skanerlang 👇\n\n`
      : '') +
    `Yoki chekning <b>rasmini</b> shu yerga yuboring — QR kod aniq ko'rinsin.\n\n` +
    `ℹ️ Chek olingandan keyin 72 soat ichida qo'shing.`,

  coupons: (coupons: number, pending: number, approved: number) =>
    `🎟 Kuponlaringiz: <b>${coupons} ta</b>\n\n` +
    `✅ Tasdiqlangan cheklar: ${approved}\n` +
    `⏳ Tekshirilmoqda: ${pending}\n\n` +
    `Kuponlar har kuni ertalab hisoblanadi.`,

  rulesShort: (rulesUrl: string, rulesText: string) =>
    (rulesText ? `${esc(rulesText)}\n\n` : '') + `To'liq qoidalar: ${rulesUrl}`,

  invite: (link: string) =>
    `👥 Do'stlaringizni taklif qiling!\n\nShu havolani yuboring:\n${link}`,

  contact: (support: string) =>
    support ? `☎️ Savol va takliflar uchun: ${esc(support)}` : `☎️ Aloqa ma'lumotlari tez orada qo'shiladi.`,

  blocked: `⛔️ Akkauntingiz bloklangan. Savollar bo'lsa, aloqaga chiqing.`,
  needRegister: `Avval ro'yxatdan o'ting: /start`,
  unknown: `Menyudan tanlang 👇`,
} as const;

export { esc };
