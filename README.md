# Fazo Club — "Omad Fazosi" aksiya tizimi

Mijoz Telegram botda ro'yxatdan o'tadi va Fazo filiallaridan olgan fiskal chekining QR kodini skanerlaydi. Chek iiko savdo ma'lumoti bilan solishtiriladi, keyin filial qoidasi bo'yicha kupon beriladi.

- Bot: [@FazoClub_bot](https://t.me/FazoClub_bot)
- Mini app: `https://club.fazorestaurant.uz/miniapp`
- Admin panel: `https://club.fazorestaurant.uz/admin`
- Qoidalar: `https://club.fazorestaurant.uz/rules`

Texnik topshiriq [SPEC.md](SPEC.md) da. Infratuzilma konteksti [FAZO_AKSIYA_CONTEXT.md](FAZO_AKSIYA_CONTEXT.md) da.

## Tuzilma

```
apps/api     NestJS 12 + Prisma 6 + grammY (bot, webhook), cron'lar
  src/core       sof funksiyalar: QR parser, kupon formulasi, moslash, initData
  src/receipts   chek qo'shish (mini app, rasm, matn), rate limit
  src/reconcile  solishtirish, Excel/CSV import
  src/iiko       iikoServer OLAP (IikoSource)
  src/jobs       03:15 solishtirish, 09:00 bildirishnomalar
  src/admin      admin API (auth, cheklar, filiallar, import, eksport…)
apps/web     Next.js 16: /miniapp, /rules, /admin
tools/       deploy.sh, iiko-columns.mjs
infra/       nginx konfiguratsiyasi
```

## Chek qanday ishlaydi

1. Mijoz QR'ni skanerlaydi. U `https://ofd.soliq.uz/check?t=FM&r=chek&c=vaqt&s=belgi` ko'rinishida bo'ladi. QR ichida summa yo'q.
2. Server QR'ni tekshiradi va chekka status beradi:
   - FM `FiscalDevice` da bo'lsa: **PENDING**.
   - FM noma'lum bo'lsa: **NEEDS_REVIEW** va admin guruhiga alert boradi. Admin FM'ni filialga bog'lagach, chek o'zi qayta ishlanadi.
   - Chek aksiyadan oldin chiqqan yoki 72 soatdan eski bo'lsa: **REJECTED**. Sababi mijozga darhol aytiladi.
   - Shu chek allaqachon qo'shilgan bo'lsa: "allaqachon qo'shilgan".
3. Har kuni 03:15 da iiko'dan savdo olinadi (yoki admin Excel yuklaydi). Chek `(FM, chek raqami)` bo'yicha, vaqt farqi ±10 daqiqa ichida bo'lsa moslanadi:
   - topilsa, summaga qarab **APPROVED** (kuponlar yaratiladi) yoki **BELOW_MIN**;
   - qaytarilgan (refund) chek bo'lsa, **REJECTED** va kuponlari o'yindan chiqadi;
   - 3 kundan keyin ham topilmasa, **NOT_FOUND** va moderatsiyaga tushadi.
4. Har kuni 09:00 da mijozga bitta xabar boradi: kecha nechta kupon qo'shilgani va jami kuponlari.

Kupon formulasi: `sum < minSum → 0`, aks holda `min(max(1, floor(sum / couponPrice)), maxPerReceipt)`. Qoida har filial uchun alohida, admin paneldan o'zgartiriladi.
Kuponlar ketma-ket raqamlanadi. Xodimlarning kuponlari `eligible=false` bo'ladi, ya'ni o'yinda qatnashmaydi.

## Lokal ishga tushirish

```bash
pnpm install
```

```bash
pnpm db:up
```

`.env.example` dan `.env` yarating. Lokalda `PUBLIC_URL=http://localhost:4601` va `BOT_MODE=polling` qo'ying.

```bash
pnpm --filter @fazo/api exec prisma migrate dev
```

```bash
pnpm --filter @fazo/api build && pnpm db:seed
```

```bash
pnpm dev:api
```

```bash
pnpm dev:web
```

Testlarni ishga tushirish (dev Postgres kerak):

```bash
pnpm --filter @fazo/api test
```

> ⚠️ `BOT_MODE=polling` bot webhook'ini o'chirib qo'yadi. Prod bot ishlab turganda lokalda polling'ni ishga tushirmang, `BOT_MODE=off` qo'ying.

## Env o'zgaruvchilar

To'liq ro'yxat [.env.example](.env.example) da. Asosiylari:

| Nomi | Izoh |
|---|---|
| `PUBLIC_URL` | `https://club.fazorestaurant.uz`. Mini app, webhook va qoidalar havolasi shundan yasaladi |
| `BOT_TOKEN`, `BOT_USERNAME` | @FazoClub_bot |
| `BOT_MODE` | `webhook` (prod), `polling` (lokal), `off` |
| `BOT_WEBHOOK_SECRET` | Telegram webhook sarlavhasi uchun. Yaratish: `openssl rand -hex 24` |
| `ADMIN_ALERT_CHAT_ID` | "Fazo Club \| Alert" guruhi. Guruhga `/chatid` yozib bilib olinadi |
| `JWT_SECRET` | Admin sessiyasi uchun. Yaratish: `openssl rand -base64 48` |
| `ADMIN_INIT_LOGIN/PASSWORD` | Birinchi ishga tushishda shu ma'lumot bilan ADMIN yaratiladi |
| `POSTGRES_PASSWORD` | Prod Postgres paroli |
| `SUPPORT_CONTACT` | Botdagi "☎️ Aloqa" tugmasida ko'rinadi |
| `IIKO_SERVERS` | Ixtiyoriy. `[{"host":"https://fazo-co.iiko.it","login":"..","password":".."}, …]` |
| `IIKO_FIELDS` | Ixtiyoriy. OLAP ustun nomlari: `{"receiptNumber":"..","fm":"..","closedAt":"CloseTime","amount":"DishDiscountSumInt","refund":".."}` |

## Deploy (server: `ssh fazo`)

Bir martalik tayyorlov:

1. Serverda `/opt/fazo-club/.env` yarating (`.env.example` asosida, `BOT_MODE=webhook`).
2. nginx konfiguratsiyasini ulang:

   ```bash
   sudo cp /opt/fazo-club/infra/nginx-club.conf /etc/nginx/sites-available/fazo-club
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/fazo-club /etc/nginx/sites-enabled/fazo-club
   ```

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. HTTPS sertifikat oling:

   ```bash
   sudo certbot --nginx -d club.fazorestaurant.uz
   ```

Har safar deploy qilish:

```bash
bash tools/deploy.sh
```

Skript kodni rsync qiladi, keyin serverda `docker compose up -d --build` va sog'lik tekshiruvini bajaradi. API ishga tushganda o'zi `prisma migrate deploy` va idempotent seed'ni bajaradi, keyin webhook'ni o'rnatadi.

Loglarni ko'rish:

```bash
ssh fazo 'cd /opt/fazo-club && docker compose logs --tail=200 -f api'
```

Bazaga kirish:

```bash
ssh fazo 'cd /opt/fazo-club && docker compose exec postgres psql -U fazo fazo_club'
```

RestoBrain admin menyusiga "Fazo Club" tashqi havolasini qo'shing (`https://club.fazorestaurant.uz/admin`). Kirish shu servisning o'z login/paroli bilan bo'ladi.

## iiko ulash

1. Fiskal ustunlarni toping. **RestoBrain sinxroni ishlamaydigan va iikoOffice'da shu login bilan hech kim ishlamayotgan paytda** ishga tushiring:

   ```bash
   IIKO_HOST=https://fazo-co.iiko.it IIKO_LOGIN=.. IIKO_PASSWORD=.. node tools/iiko-columns.mjs 2026-10-11 "Fazo Family Restauraunt"
   ```

2. Topilgan ustun nomlarini `IIKO_FIELDS` ga, serverlarni `IIKO_SERVERS` ga yozing va deploy qiling.
3. Admin paneldagi Filiallar sahifasida har filialning `iiko department` va `iiko server` maydonlari to'ldirilgan bo'lishi kerak.

iiko ishlamasa ham tizim to'xtamaydi: Excel import har doim ishlaydi.

## Operator uchun qisqa qo'llanma

**Moderatsiya** (har kuni)
1. Admin panel → 👀 Moderatsiya. Bu yerda QR'i o'qilmagan rasmlar, noma'lum kassalar va iiko'da topilmagan cheklar turadi.
2. Chekni oching, rasm va "iiko ma'lumoti" jadvaliga qarang. Jadvaldagi qatorni bossangiz, summa formaga tushadi.
3. **Tasdiqlash**: summa va filialni kiriting. Rasm orqali kelgan chekda FM va chek raqamini ham yozing, shunda chek ikkinchi marta ishlatilmaydi.
4. **Rad etish**: sababini tanlang yoki yozing. Sabab mijozga ertalabki xabarda boradi.

**Excel import** (iiko API ishlamasa)
1. iikoOffice → Отчеты → OLAP-отчет по продажам. Ustunlar: fiskal chek raqami, FM yoki kassa, yopilish vaqti, chegirmadan keyingi summa. Kerakli kunlarni Excel'ga chiqaring.
2. Admin → 📥 Import → faylni yuklang → ustunlarni tekshiring (birinchi safar tanlaganingiz eslab qolinadi) → "Import qilish va solishtirish".
3. Faylni qayta yuklash xavfsiz, takror yozuv yaratilmaydi.

**Yangi kassa (FM)**
- Admin → 🏢 Filiallar → filial ostidagi "FM qo'shish". Noma'lum FM'lar shu sahifaning yuqorisida chiqadi. Filialni tanlasangiz, kutayotgan cheklar avtomatik qayta ishlanadi.

**Chekni qo'lda kiritish**
- Admin → 🧾 Cheklar → "Qo'lda qo'shish". Kerak: telefon, FM, chek raqami va vaqt. Summa kiritilsa, chek darhol tasdiqlanadi.

**Xodimlar**
- Admin → 🧑‍🍳 Xodimlar → telefonlar ro'yxatini (CSV) joylang. Ro'yxatdagi telefon bilan ro'yxatdan o'tganlarning kuponlari o'yindan chiqadi.

**Eksport**: Admin → 📤 Eksport → ishtirokchilar, kuponlar yoki cheklar (XLSX/CSV).

## Admin guruhiga keladigan alert'lar

- Noma'lum FM'dan chek keldi (har FM uchun soatiga bir marta).
- Shubhali faollik: bitta telefon bir kunda 5 tadan ko'p chek qo'shdi yoki bitta kassadan bir soatda 40 tadan ko'p chek keldi.
- iiko import yoki solishtirish xatosi.
- Har kuni 09:00 da kechagi kun bo'yicha qisqa hisobot.
