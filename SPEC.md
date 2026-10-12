# Fazo aksiya tizimi — texnik topshiriq (SPEC)

> Bu fayl yangi loyiha papkasida turadi. Yonida `FAZO_AKSIYA_CONTEXT.md` ham bo'ladi.
> U fayl RestoBrain loyihasidan yig'ilgan: iiko ulanishi, server, admin auth, filiallar.
> **Ishni boshlashdan oldin ikkalasini to'liq o'qi.** Infratuzilma haqidagi faktlarda
> (iiko endpoint'lari, server, domen, auth) `FAZO_AKSIYA_CONTEXT.md` ustun turadi.
> Mahsulot qoidalarida (mexanika, statuslar, UX) shu SPEC ustun turadi.

## 0. Muddat va ustuvorlik
- **3 kunda ishga tushishi shart.** 3-kun kechqurun real mijozlar foydalanadi.
- 3 kunda faqat ikki narsa ishlashi shart: mijoz **ro'yxatdan o'tadi** va **chekini qo'shadi**.
  Qolgan hamma narsa keyin. Bitta shart bor: xom ma'lumot (kim, qaysi chek, qachon, qaysi kassa)
  birinchi kundan to'g'ri saqlansin. Kuponlarni keyin istalgan qoida bilan qayta hisoblash
  mumkin bo'lishi kerak.
- Murakkablikdan qoch. Har bir qaror "3 kunda ishonchli ishlaydimi?" savoliga javob bersin.

## 1. Biznes mexanika
- Fazo Group filiallari: Fazo Restaurant, Boy BoBo, Le Fazo va boshqalar (ro'yxat CONTEXT'da).
- Aksiya ~1 yil davom etadi. Oylik kichik o'yinlar, yil oxirida mashina o'ynaladi.
  Asosiy maqsad: auditoriya yig'ish (mijozlar bazasi) va Fazo'ni tanitish.
- Mijoz fiskal chek bilan kupon oladi. **Har bir filial uchun alohida qoida** (admin paneldan
  o'zgartiriladi):
  - `min_sum`: chek shu summadan kam bo'lsa, kupon berilmaydi.
  - `coupon_price`: har shuncha so'mga 1 kupon.
  - `max_per_receipt`: bitta chekdan maksimal kupon soni (banket va to'y cheklari o'yinni
    egallab olmasligi uchun).
  - Formula: `sum < min_sum → 0`, aks holda
    `coupons = min(max(1, floor(sum / coupon_price)), max_per_receipt)`.
- Chek aksiya boshlanganidan keyin chiqqan bo'lishi va chek vaqtidan boshlab
  `receipt_window_hours` (standart 72) ichida qo'shilishi kerak.
- Xodimlar (telefon raqami xodimlar ro'yxatida bo'lsa) ro'yxatdan o'ta oladi, lekin ularning
  kuponlari o'yinda qatnashmaydi (`is_staff`).
- Bitta fiskal chek faqat bir marta ishlatiladi. Birinchi skanerlagan oladi.

## 2. Fiskal chek va QR (real ma'lumot)
Fiskal chekni iiko o'zi chiqaradi ("Onlayn NKM nomi: iiko cloud"). Chek mijozga beriladi.
Chek pastidagi QR namunasi:
```
https://ofd.soliq.uz/check?t=LG420230613349&r=4495&c=20261011205251&s=047808378930
```
| Param | Ma'nosi | Namuna |
|---|---|---|
| `t` | FM raqami (kassa qurilmasi), filialni aniqlaydi | LG420230613349 |
| `r` | Fiskal chek raqami | 4495 |
| `c` | Sana-vaqt `YYYYMMDDHHmmss`, Asia/Tashkent | 20261011205251 → 11.10.2026 20:52:51 |
| `s` | Fiskal belgi (summa EMAS) | 047808378930 |

- **QR ichida summa yo'q.** Summa iiko ma'lumotidan olinadi (5-bo'lim).
- Chekning noyob kaliti: `(fm, receipt_number)`.
- Bu chekning haqiqiy qiymatlari: "Fazo DT" MChJ, STIR 312163993, summa 8 000 so'm,
  "Орбит жвачка", naqd. Testlarda ishlat.
- `ofd.soliq.uz` sahifasini serverdan o'qima (scraping qilma). Bu norasmiy yo'l va
  sayt avtomatik so'rovlarni bloklaydi.
- "Гостевой счет" (iiko prechek) da QR ham, fiskal ma'lumot ham yo'q. U ishlatilmaydi.

## 3. Arxitektura
- **Alohida servis**, RestoBrain ichiga hozir qo'shilmaydi (keyin modul sifatida ko'chadi).
  RestoBrain admin menyusidan bu servisning admin sahifasiga link yoki iframe bo'ladi.
  Usulni CONTEXT'dagi tavsiyaga qarab tanla.
- Stack (foydalanuvchining odatiy stack'i):
  - **Backend:** NestJS + Prisma + PostgreSQL. Bot shu jarayon ichida **grammY**, webhook
    rejimida. Cron uchun `@nestjs/schedule`. MVP'da Redis yoki queue kerak emas.
  - **Frontend:** Next.js (App Router), bitta ilovada ikki qism:
    `/miniapp` (Telegram mini app) va `/admin` (admin panel).
  - **Deploy:** Docker Compose (`api`, `web`, `postgres`), HTTPS domen (mini app uchun shart).
    Server va reverse proxy CONTEXT'dagi bilan bir xil bo'lsin.
- Hamma vaqtlar DB'da UTC'da saqlanadi, ko'rsatish va cron Asia/Tashkent bo'yicha.
- Telefon raqam formati: `+998XXXXXXXXX`.

## 4. Ma'lumotlar modeli (Prisma, taxminiy)
```
Campaign      id, name, startsAt, endsAt, receiptWindowHours(72), rulesText, isActive
Branch        id, name, brand, isActive, minSum, couponPrice, maxPerReceipt, iikoRef(json?)
FiscalDevice  id, fm (unique), branchId, legalName, stir, note
Participant   id, tgId (unique), phone (unique), firstName, lastName, username,
              refCode (unique), referredById?, source, isStaff, isBlocked, rulesAcceptedAt, createdAt
Receipt       id, participantId, fm, receiptNumber, fiscalSign, fiscalAt, rawUrl,
              source(QR|PHOTO|MANUAL), status, amount?, branchId?, couponsCount,
              rejectReason?, saleRecordId?, photoFileId?, reviewedById?, createdAt, decidedAt
              @@unique([fm, receiptNumber])
Coupon        id (ketma-ket raqam = kupon raqami), campaignId, participantId, receiptId,
              eligible(bool, xodim bo'lsa false), createdAt
SaleRecord    id, fm, receiptNumber, closedAt, amount, isRefund, branchHint, source(IIKO_API|EXCEL),
              importBatchId, raw(json)   @@unique([fm, receiptNumber, isRefund])
ImportBatch   id, source, periodFrom, periodTo, rows, matched, createdById, createdAt, log
StaffPhone    phone (unique), name?, source
AdminUser     id, login, passwordHash, role(ADMIN|OPERATOR)  (yoki RestoBrain auth — CONTEXT)
AuditLog      id, actorId?, action, entity, entityId, data(json), createdAt
Notification  id, participantId, type, payload, sendAfter, sentAt?, error?
```
Receipt statuslari:
- `PENDING`: skanerlandi, iiko bilan hali solishtirilmadi.
- `APPROVED`: topildi, summa va filial bor, kuponlar yaratildi.
- `BELOW_MIN`: topildi, lekin summa `min_sum` dan kam.
- `REJECTED`: muddati o'tgan, aksiyadan oldingi, filial aksiyada emas, qaytarilgan (refund)
  yoki moderator rad etgan.
- `NOT_FOUND`: N kun ichida iiko'da topilmadi, moderatsiyaga tushadi.
- `NEEDS_REVIEW`: rasm orqali kelgan yoki shubhali.

## 5. Asosiy oqimlar

### 5.1 Ro'yxatdan o'tish (bot)
1. `/start [payload]`. Payload'lar: `ref_<code>` (referal) va `src_<tag>` (qaysi poster yoki
   stol). Payload saqlanadi.
2. Salomlashish, aksiya qisqacha, "📱 Raqamni yuborish" (`request_contact`) tugmasi.
3. `contact.user_id === from.id` bo'lishi shart, aks holda "faqat o'z raqamingizni yuboring".
4. Telefon normallashtiriladi, `StaffPhone` bo'yicha `isStaff` tekshiriladi.
5. Qoidalar havolasi va "✅ Roziman" tugmasi → asosiy menyu:
   **🧾 Chek qo'shish** (mini app) · **🎟 Kuponlarim** · **📜 Qoidalar** · **👥 Do'st taklif qilish**
   (referal 3 kunlik MVP'da faqat kod saqlaydi, bonus keyin) · **☎️ Aloqa**.

### 5.2 Chek qo'shish
- **Asosiy yo'l:** mini app → `Telegram.WebApp.showScanQrPopup` → matn backend'ga yuboriladi
  (`initData` bilan; backend `initData` HMAC'ini bot token bilan tekshiradi).
- Backend: URL host `ofd.soliq.uz`, `t`, `r`, `c`, `s` bor va formati to'g'ri ekanini tekshiradi.
  Keyin:
  - `fm` `FiscalDevice` da yo'q → "Bu chek aksiyadagi filialga tegishli emas"
    (admin uchun log, noma'lum FM'lar ro'yxati ko'rinadi).
  - `fiscalAt` < aksiya boshlanishi yoki oyna (72 soat) o'tgan → rad etiladi, sababi aytiladi.
  - `(fm, r)` mavjud → "Bu chek allaqachon qo'shilgan".
  - Aks holda `Receipt(PENDING)`. Javob: "Chek qabul qilindi ✅ Kuponlar ertaga ertalab
    hisoblanadi". Agar iiko API real vaqtda ishlasa, darhol solishtirishga urin (5.3).
- **Zaxira 1:** mijoz botga chek **rasmini** yuboradi. Server rasmdagi QR'ni dekodlaydi
  (OpenCV `QRCodeDetector` yoki zxing; real chek rasmida OpenCV bilan sinalgan va ishladi).
  Dekodlansa, oqim yuqoridagidek. Dekodlanmasa, `NEEDS_REVIEW` va moderatsiyaga.
- **Zaxira 2 (admin):** operator chekni qo'lda kiritadi: telefon, FM, chek raqami, vaqt.
  Status `MANUAL`, audit log yoziladi.
- Rate limit: bitta foydalanuvchi uchun daqiqasiga 5 ta va kuniga 20 ta chek.

### 5.3 Solishtirish (reconciliation)
`SalesSource` interfeysi: `fetch(from, to) → SaleRecord[]`. Ikkita implementatsiya:
1. **IikoSource:** CONTEXT'da topilgan endpoint orqali (iikoCloud yoki iikoServer OLAP).
   Fiskal chek raqami va FM qaysi maydonda kelishi CONTEXT'da yozilgan. Agar FM maydoni
   bo'lmasa, filial va kassa + chek raqami + vaqt (±10 daqiqa) bo'yicha moslashtir.
2. **ExcelSource:** admin iiko hisobotini (xlsx/csv) yuklaydi. Ustunlarni moslashtirish
   (mapping) birinchi marta UI'da tanlanadi va saqlanadi. **MVP'da shu albatta bo'lsin**:
   API ishlamay qolsa ham tizim ishlayveradi.

Ishlash tartibi:
- Cron har kuni 03:00 Asia/Tashkent'da kechagi kun (+ oxirgi 3 kun qayta) uchun `SaleRecord`
  import qiladi. Keyin hamma `PENDING` cheklarni `(fm, receiptNumber)` bo'yicha moslaydi va
  `fiscalAt ≈ closedAt` (±10 daqiqa) ni tekshiradi.
- Topilsa: summa → filial qoidasi → kuponlar (tranzaksiya ichida) → `APPROVED` yoki `BELOW_MIN`.
- Qaytarish (refund) cheki bo'lsa: `REJECTED`. Avval berilgan kuponlar `eligible=false`
  qilinadi va audit yoziladi.
- 3 kundan keyin ham topilmasa: `NOT_FOUND` → moderatsiya navbati.
- Admin "Hozir solishtirish" tugmasi bilan qo'lda ham ishga tushira oladi.

### 5.4 Bildirishnomalar
- Har kuni 09:00 Asia/Tashkent'da mijozga bitta xabar boradi: kecha tasdiqlangan kuponlar
  ("Fazo Restaurant'dagi chekingiz uchun 2 ta kupon qo'shildi 🎉 Jami: 7 ta").
  Rad etilganlar uchun sababi bilan xabar.
- Telegram limitlariga rioya qil (soniyasiga ~25 ta xabar), xatolarni log qil,
  bot bloklangan foydalanuvchilarni belgilab qo'y.
- Tizim xatolari va noma'lum FM'lar admin Telegram guruhiga yuboriladi
  (`ADMIN_ALERT_CHAT_ID`).

## 6. Mini app (`/miniapp`)
- Telegram WebApp SDK. Rang va temani Telegram'dan olsin.
- Ekranlar: **Chek qo'shish** (katta "QR'ni skanerlash" tugmasi + oxirgi cheklar statusi),
  **Kuponlarim** (jami kupon, cheklar ro'yxati: sana, filial, summa, status, kupon soni),
  **Qoidalar**.
- O'zbek tilida (lotin). Matnlar oddiy va qisqa bo'lsin.

## 7. Admin panel (`/admin`)
Auth: CONTEXT'dagi tavsiya bo'yicha (RestoBrain JWT) yoki MVP uchun oddiy login/parol
(bcrypt) + rollar. Sahifalar:
1. **Dashboard:** ishtirokchilar soni (bugun / jami), cheklar statuslar bo'yicha, kuponlar
   soni, filiallar kesimida.
2. **Filiallar:** CRUD, qoidalar (`minSum`, `couponPrice`, `maxPerReceipt`, faol),
   FM raqamlari ro'yxati.
3. **Cheklar:** filtr (status, filial, sana, telefon), tafsilot (xom QR, SaleRecord, audit).
4. **Moderatsiya:** `NEEDS_REVIEW` va `NOT_FOUND` cheklar, rasm ko'rinishi,
   tasdiqlash (summa va filial kiritib) yoki rad etish (sababi bilan).
5. **Ishtirokchilar:** qidiruv, kuponlar, bloklash, xodim belgisi.
6. **Import:** iiko Excel yuklash, ustun mapping, natija (nechta topildi), "Hozir solishtirish".
7. **Xodimlar:** telefonlar ro'yxati (CSV import yoki CONTEXT'dagi manbadan sinxron).
8. **Eksport:** ishtirokchilar va kuponlar XLSX/CSV.
9. **Sozlamalar:** aksiya sanalari, chek oynasi (soat), qoidalar matni.
- Har bir admin harakati `AuditLog` ga yoziladi.
- O'yin (draw) moduli MVP'da yo'q. Lekin kuponlar ketma-ket raqamli va `eligible`
  maydoni bor, keyin qo'shish oson bo'lsin.

## 8. Xavfsizlik va firibgarlikka qarshi
- `(fm, receiptNumber)` unique, DB darajasida.
- Mini app so'rovlarida `initData` imzosi tekshiriladi, `auth_date` 24 soatdan eski bo'lmasin.
- Xodimlar kuponi `eligible=false`.
- Shubhali faollik haqida ogohlantirish: bir telefon kuniga 5 tadan ortiq chek qo'shsa yoki
  bir FM'dan bir soatda g'ayritabiiy ko'p chek kelsa, admin guruhga xabar boradi.
- Maxfiy qiymatlar faqat `.env` da turadi. `.env.example` yoz.
- Admin panel faqat HTTPS orqali, parollar bcrypt bilan.

## 9. Ish tartibi (Claude Code uchun)
1. `FAZO_AKSIYA_CONTEXT.md` va shu SPEC'ni o'qi. **Qisqa reja va ochiq savollar ro'yxatini**
   foydalanuvchiga ko'rsat. Faqat ishni to'xtatadigan savollarni so'ra, qolganida mantiqiy
   default tanla va yozib qo'y.
2. Tartib:
   - **1-kun:** loyiha skeleti, Docker Compose, Prisma sxema va migratsiya, QR parser
     (unit test, real namuna bilan), kupon formulasi (unit test), bot: ro'yxatdan o'tish
     va menyu.
   - **2-kun:** mini app skaner va `initData` tekshiruvi, chek qo'shish oqimi, rasm orqali QR
     dekodlash, admin panel (filiallar, cheklar, moderatsiya, ishtirokchilar, eksport,
     Excel import va solishtirish), deploy.
   - **3-kun:** IikoSource (CONTEXT'ga ko'ra; bo'lmasa Excel bilan qoladi), cron'lar,
     bildirishnomalar, admin alert'lar, real chek bilan end-to-end test, tuzatishlar,
     README (deploy, env, operator uchun qisqa qo'llanma).
3. Har bir mantiqiy qadamdan keyin commit qil.
4. "Tayyor" deyishdan oldin ishlab ko'r: testlar o'tadi, `docker compose up` ishlaydi,
   botda ro'yxatdan o'tish va real QR namunasini qo'shish end-to-end ishlaydi.

## 10. Qabul mezonlari (MVP)
- [ ] Yangi foydalanuvchi botda 2 ta bosish bilan ro'yxatdan o'tadi. Telefon o'ziniki ekani
      tekshiriladi.
- [ ] Mini app real fiskal QR'ni skanerlaydi va chek `PENDING` bo'lib saqlanadi.
      Ikkinchi marta skanerlansa "allaqachon qo'shilgan" deydi.
- [ ] Chek rasmi yuborilganda QR serverda dekodlanadi, dekodlanmasa moderatsiyaga tushadi.
- [ ] Admin filial qoidalarini va FM ro'yxatini o'zgartira oladi.
- [ ] Admin iiko Excel hisobotini yuklaydi → `PENDING` cheklar summa bilan tasdiqlanadi →
      kuponlar formula bo'yicha yaratiladi.
- [ ] Ertalabki bildirishnoma mijozga boradi.
- [ ] Xodim raqami bilan kelgan kuponlar `eligible=false`.
- [ ] Ishtirokchilar va kuponlar eksport qilinadi.
- [ ] HTTPS domenda deploy qilingan, `.env.example` va README bor.

## 11. Keyingi bosqichlar (MVP'dan keyin, hozir QILMA)
iiko real vaqtda solishtirish, referal bonuslari (+1 kupon ikkalasiga), kanalga obuna
bonusi, oylik/choraklik o'yin moduli (shaffof tanlov va log), SMS orqali ro'yxatdan o'tish
(Telegram'i yo'qlar uchun), CRM sinxroni, RestoBrain moduliga ko'chirish, mobil ilova uchun
shu backend'dan foydalanish.

## 12. Nomlar (vaqtincha)
Bot: **Fazo Club**. Aksiya: **"Omad Fazosi"**. Shior: "Ovqatlan — mashina yut!".
Bot username foydalanuvchidan olinadi (`BOT_USERNAME` env).
