# Fazo Group — “KIA SONET MENIKI” aksiya tizimi

Kassir admin panelning **Kassa** sahifasida chek summasini kiritadi va bir martalik QR chiqaradi: QR chop etiladi yoki ekranda ko'rsatiladi. Mijoz QR'ni telefon kamerasi bilan skanerlaydi, bot ochiladi va kuponlar darhol qo'shiladi. Tizim mustaqil ishlaydi: iiko, fiskal chek yoki boshqa tizimga bog'liq emas.

- Bot: [@fazogroup_bot](https://t.me/fazogroup_bot)
- Mini app: `https://promo.fazorestaurant.uz/miniapp`
- Admin panel: `https://panel.fazorestaurant.uz` (`/admin` prefiksisiz: `/vouchers`, `/cashier`…)
- Qoidalar: `https://promo.fazorestaurant.uz/rules`

Texnik topshiriq [SPEC.md](SPEC.md) da. Infratuzilma konteksti [FAZO_AKSIYA_CONTEXT.md](FAZO_AKSIYA_CONTEXT.md) da.

## Tuzilma

```
apps/api     NestJS 12 + Prisma 6 + grammY (bot, webhook)
  src/core       sof funksiyalar: kupon formulasi, vaucher tokeni, telefon, initData, chek matnlari
  src/vouchers   QR chiqarish/skanerlash, firibgarlik belgilari, taklif bonusi
  src/bot        ro'yxatdan o'tish, bosh xabar, QR rasmi/havolasi
  src/miniapp    mini app API (kuponlar, skaner)
  src/admin      admin API (auth/RBAC, filiallar, terminallar, chek logosi, ishtirokchilar, eksport…)
apps/web     Next.js 16: mijozlar (/, /miniapp, /rules) va admin panel; domenni `proxy.ts` ajratadi
tools/       deploy.sh
infra/       nginx konfiguratsiyasi
```

## QR qanday ishlaydi

1. Kassir summani kiritadi va terminal tugmasini bosadi. Server tasodifiy token bilan bir martalik QR yaratadi: `t.me/fazogroup_bot?start=v_<token>`. Summa va kupon soni serverda saqlanadi, QR'ni soxtalashtirib bo'lmaydi.
2. QR terminal sozlamasiga qarab chop etiladi (80/58 mm termoprinter) yoki ekranda katta ko'rsatiladi. Chekdagi logo va matnlarni admin filial bo'yicha sozlaydi.
3. Mijoz QR'ni skanerlaydi. Ro'yxatdan o'tmagan bo'lsa, bitta xabarda raqam so'raladi: raqamni yuborish qoidalarga rozilik hisoblanadi. Shundan keyin kuponlar qo'shiladi.
4. QR bir martalik va aksiya sozlamasidagi muddat (standart 72 soat) ichida amal qiladi. Admin yoki kassir uni bekor qila oladi.
5. Skanerlagan akkaunt (telefon, Telegram ID, ism) muhrlanadi. Xodim skanerlasa yoki bitta kassir bitta odamga ko'p QR bersa, admin guruhiga alert boradi.

Kupon formulasi: `sum < minSum → 0`, aks holda `min(max(1, floor(sum / couponPrice)), maxPerReceipt)`. Qoida har filial uchun alohida, admin paneldan o'zgartiriladi.
Kuponlar ketma-ket raqamlanadi. Xodimlarning kuponlari `eligible=false` bo'ladi, ya'ni o'yinda qatnashmaydi.

**Taklif bonusi:** havola orqali kelgan do'st birinchi QR'ini skanerlasa, taklif qilganga bonus kupon beriladi (Sozlamalarda yoqiladi, oylik chegara bor).

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
| `PUBLIC_URL` | `https://promo.fazorestaurant.uz`. Mini app, webhook va qoidalar havolasi shundan yasaladi |
| `BOT_TOKEN`, `BOT_USERNAME` | @fazogroup_bot |
| `BOT_MODE` | `webhook` (prod), `polling` (lokal), `off` |
| `BOT_WEBHOOK_SECRET` | Telegram webhook sarlavhasi uchun. Yaratish: `openssl rand -hex 24` |
| `ADMIN_ALERT_CHAT_ID` | "Fazo Group \| Alert" guruhi. Guruhga `/chatid` yozib bilib olinadi |
| `JWT_SECRET` | Admin sessiyasi uchun. Yaratish: `openssl rand -base64 48` |
| `ADMIN_INIT_LOGIN/PASSWORD` | Birinchi ishga tushishda shu ma'lumot bilan ADMIN yaratiladi |
| `POSTGRES_PASSWORD` | Prod Postgres paroli |
| `SUPPORT_CONTACT` | Botdagi "☎️ Aloqa" tugmasida ko'rinadi |

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
   sudo certbot --nginx -d promo.fazorestaurant.uz -d panel.fazorestaurant.uz
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

RestoBrain admin menyusiga "Fazo Group" tashqi havolasini qo'shing (`https://panel.fazorestaurant.uz`). Kirish shu servisning o'z login/paroli bilan bo'ladi.

## Admin uchun qisqa qo'llanma

**Filiallar va kassalar** → filial:
- *Kupon*: minimal chek, 1 kupon narxi, bitta chekka ko'pi bilan kupon.
- *Chek*: logo (istalgan rasm, avtomatik oq-qora) va matnlar, namunasi bilan.
- *Terminallar*: har bir kassa (kompyuter, Sunmi) uchun tugma — printer 80/58 mm yoki ekranda.

**Foydalanuvchilar**: kassir va menejerlarni yaratish, filialga biriktirish, bo'limlarga ruxsat.

**Vaucherlar**: barcha QR — kim chiqardi, kim skanerladi, shubhali belgilar, bekor qilish.

**Ishtirokchilar**: kuponlar tarixi, bloklash, xodim deb belgilash, o'chirish (faqat admin).

**Xodimlar**: telefonlar ro'yxatini (CSV) joylang — ular kupon oladi, lekin o'yinda qatnashmaydi.

**Eksport**: ishtirokchilar, kuponlar va vaucherlar (XLSX/CSV).

## Admin guruhiga keladigan alert'lar

- Xodim QR skanerladi.
- Bitta kassir bir kunda bitta odamga 3 va undan ko'p QR berdi.
- Bitta odam bir kunda 5 va undan ko'p QR skanerladi.
