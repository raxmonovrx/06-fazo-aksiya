# Fazo aksiya — RestoBrain konteksti

- **Sana:** 2026-10-12
- **Kim yig'di:** Claude Code (Opus 5.5) sessiyasi, egasi Farrux (`raxmonovrx`) topshirig'i bilan
- **Repo:** `/Users/raxmonovrx/FarruXbek Raxmonov/01 Projects/02 restobrain`, branch `farrux`, commit `5e25f42` (`release: v1.17.2`)
- **Prod:** v1.17.3 (`cc6fcf2`, 2026-10-12). iiko kodi v1.17.2 → v1.17.3 orasida o'zgarmagan.
- **Manbalar:** kod va hujjatlar (fayl:satr bilan) + prod serverdagi faqat o'qish buyruqlari (pastda ko'rsatilgan).
- **Maxfiy qiymatlar yozilmagan.** Faqat env o'zgaruvchi nomlari va saqlanadigan joy. Server IP ham yozilmagan.

---

## 0. Qisqa xulosa

- **iiko'dan FM + chek raqami bo'yicha summa olish: hozircha ANIQLASH KERAK (RestoBrain'da MUMKIN EMAS).**
  - RestoBrain iiko'dan hech qanday fiskal maydon so'ramaydi va saqlamaydi.
  - Bor chek identifikatori faqat iiko ichki **`OrderNum`** (smena ichidagi buyurtma raqami). U fiskal chek raqami emas.
  - iikoServer SALES OLAP hisobotida **285 ta ustun** bor (`docs/SHUBHALI.md:523`). Ular orasida fiskal ustun bormi, buni faqat jonli so'rov ko'rsatadi.
  - Ushbu sessiyada jonli iiko so'rovi va 4495-chek testi **bajarilmadi** (§2.6).
- **Ulanish yo'li (tavsiya):**
  1. iikoServer `/resto/api/v2/reports/olap` (SALES), RestoBrain'dagi kabi.
  2. Avval `GET /resto/api/v2/reports/olap/columns?reportType=SALES` bilan fiskal ustunlarni topish. Buyruq §2.7 da.
  3. Fiskal ustun bo'lmasa, zaxira yo'l: FM → filial jadvali + QR'dagi sana-vaqt (sekundgacha) bo'yicha mos buyurtmani qidirish. Yoki ochiq soliq sahifasidan (`ofd.soliq.uz/check?...`) summani olish. Ikkalasining ham xavflari bor (§2.8).
- **Admin panelga ulash (tavsiya):** yangi servis alohida subdomen va o'z login'i bilan ishlaydi. RestoBrain panelida unga oddiy tashqi havola beriladi.
  - RestoBrain `JWT_SECRET` ini ulashmang: u bilan token **yasash** ham mumkin bo'ladi.
  - Panel `X-Frame-Options: DENY` yuboradi, ya'ni iframe ham qiyin.
- **RestoBrain'dan ma'lumot olish:** ommaviy yoki integratsiya API yo'q. Filiallar va xodimlar faqat JWT bilan, ruxsat orqali olinadi.
  - Eng oson yo'l: yangi servis uchun alohida RestoBrain foydalanuvchisi (faqat `hr.read`) va `GET /api/v1/hr/employees`.
  - To'g'ridan-to'g'ri bazaga ulanish **tavsiya etilmaydi**: RLS va tenant izolyatsiyasi bor.
- **Eng katta xavf / noma'lumlar:**
  1. iiko SALES'da fiskal raqam (FM, chek raqami) bormi — noma'lum.
  2. Chek **yopilish vaqti** RestoBrain'da so'ralmaydi (faqat ochilish vaqti `OpenTime`).
  3. Filiallar STIR/FM raqamlari bazada yo'q.
  4. Xodimlarning telefon raqamlari to'liq emas bo'lishi mumkin.

---

## 1. Stack va deploy

### 1.1 Stack

| Qism | Texnologiya | Dalil |
|---|---|---|
| Monorepo | pnpm workspace + Turborepo | `package.json`, `turbo.json` |
| API | NestJS 12, ESM, global prefix `api/v1` (`/health` tashqarida) | `apps/api/package.json`; `apps/api/src/bootstrap.ts:83` |
| Superadmin API | `apps/platform`, NestJS 12 | `apps/platform` |
| Bot | `apps/bot`, oddiy Node ESM webhook server (Nest emas) | `apps/bot/src/server.ts:6-7` |
| Frontend | Next.js 16.3.4 (App Router): `apps/admin` (kompaniya paneli), `apps/crm` (zal ilovasi), `apps/superadmin` | `apps/*/package.json` |
| Face ID | `apps/faceid-ps`, Hikvision terminallari uchun PowerShell ko'prigi | `apps/faceid-ps/README` |
| DB | PostgreSQL 17 (+ wal-g zaxira) | `infra/postgres/Dockerfile:2`, `infra/docker-compose.yml:29` |
| ORM | Prisma ^6.19.3, ko'p faylli sxema `libs/database/prisma/*.prisma` | `libs/database` |
| Navbat / cron | Redis va BullMQ **yo'q**. `@nestjs/schedule` `@Cron` + Postgres advisory lock | `apps/api/src/app.module.ts:81`, `apps/api/src/scheduler/jobs.service.ts:111+`, `apps/api/src/scheduler/job-locks.service.ts:7` |
| Kutubxonalar | `libs/`: ai, auth, database, i18n, provisioning, release, storage (disk/R2), supply, telegram, tenancy | `libs/*` |

### 1.2 Deploy

- **Prod compose:** `infra/prod/docker-compose.prod.yml`. Hamma port faqat `127.0.0.1` ga bog'langan:

  | Servis | Port | Compose satri |
  |---|---|---|
  | postgres | 5432 | l.70 |
  | api | 3000 | l.162 |
  | platform | 3001 | l.310 |
  | admin | 3100 | l.248 |
  | superadmin | 3200 | l.338 |
  | bot | 3300 | l.217 |
  | crm | 3400 | l.277 |

  `migrate` — tools profili (l.97).
- **Image ombori:** GHCR, `ghcr.io/raxmonovrx/restobrain/<servis>:<commit>` (`tools/deploy-local.sh:43`, `.github/workflows/deploy.yml`).
- **Server:** Contabo VPS, Ubuntu 24.04 (`docs/SERVER-TAYYORLASH.md:3`). Foydalanuvchi `restobrain`, papka `/opt/restobrain` (`tools/deploy-local.sh:45`).
- **Deploy oqimi:**
  1. `bash tools/deploy-local.sh` (Mac'da quradi, GitHub Actions daqiqasi ketmaydi) yoki `deploy.yml` (qo'lda).
  2. Faqat `main` dan va faqat ega (`raxmonovrx`) ishga tushira oladi.
  3. Versiya tekshiruvi.
  4. 6 ta image quriladi va GHCR'ga yuklanadi.
  5. Kod serverga rsync qilinadi (`.env`, `backups`, `storage` yuborilmaydi).
  6. Serverda `bash infra/prod/deploy.sh --pull`: migratsiya, huquqlar, RLS, seed, sog'lik tekshiruvi.
- **CI** faqat qo'lda (`.github/workflows/ci.yml:26`). Darvoza — lokal `pnpm check` va lint.
- **Env:** serverda `/opt/restobrain/.env` (`infra/prod/env-init.sh`). Namunasi `.env.example`.

### 1.3 Server, boshqa servislar, reverse proxy

`ssh fazo` orqali faqat o'qish buyruqlari bilan (2026-10-12):

- **Resurs:** 4 CPU, 7.8 GB RAM (~4.8 GB bo'sh), disk 96 GB (52 GB bo'sh), Ubuntu 24.04.5, nginx 1.24 (host'da), Docker 29.8.
- **Shu serverdagi konteynerlar** (hammasi `127.0.0.1` da):

  | Loyiha | Konteynerlar va portlar |
  |---|---|
  | RestoBrain | api 3000, platform 3001, admin 3100, superadmin 3200, bot 3300, crm 3400, postgres 5432 |
  | fazo-restaurant (alohida loyiha: `fazorestaurant.uz`, `admin.`, `api.`) | fazo-api-1 4100, fazo-web-1 4101, fazo-admin-1 4102, fazo-postgres-1 4103 |
  | biyhotel (`buyukipakyoli.uz`) | biyhotel-api 4500, biyhotel-web 4510, biyhotel-postgres 5442 |

  Repo hujjatlarida biyhotel bu serverda yo'q deyilgan, lekin u haqiqatda ishlab turibdi.
- **nginx saytlari** (`/etc/nginx/sites-enabled/`): `biyhotel`, `fazo.conf`, `restobrain`, `restobrain-bot`.
  - `restobrain.uz`, `www` — landing (`infra/prod/nginx-host.conf.example:40`).
  - `~^<tenant>-crm.restobrain.uz`: `/api/` → 3000, `/` → 3400 (l.76-102).
  - `~^<tenant>.restobrain.uz`: `/api/` → 3000, `/` → 3100 (l.115-143).
  - `admin.restobrain.uz`: `/platform/` → 3001, `/` → 3200 (l.169-197).
  - `bot.restobrain.uz`: `/telegram/` → 3300 (l.224-237).
  - Wildcard TLS: certbot DNS-01 (Cloudflare) (l.5).
- **Yangi servis uchun:**
  - Bo'sh port tanlang (masalan 4600-oralig'i band emas).
  - Host nginx'ga yangi `server` blok qo'shing.
  - `*.restobrain.uz` wildcard sertifikat bor. Lekin `<nom>.restobrain.uz` RestoBrain'ning tenant regex'iga tushadi (`~^[a-z0-9-]+\.restobrain\.uz$`). Shuning uchun aniq `server_name` bilan regex'dan **oldin** yozish yoki alohida domen kerak.

---

## 2. iiko ulanishi

### 2.1 Qaysi API

- **Faqat iikoServer (RMS) `/resto/api`.** Login va SHA1 parol bilan ishlaydi.
  - Mijoz kodi: `apps/api/src/pos-sync/iiko-server.client.ts`. Fayl boshidagi izohda endpoint'lar ro'yxati (l.1-27).
- **iikoCloud API ishlatilmaydi.**
  - Enum `IIKO_CLOUD` bor (`libs/database/prisma/pos.prisma:24`), lekin client yo'q.
  - Sinxron faqat `vendor: 'IIKO_SERVER'` (`apps/api/src/pos-sync/connections/connections.service.ts:349`; `docs/SHUBHALI.md:101` X9; `docs/IIKO-ULANISH.md:171`).
  - Faqat sinov skripti bor: `tools/iiko-cloud-probe.mjs`.

### 2.2 Endpoint'lar

| Endpoint | Nima uchun | `iiko-server.client.ts` |
|---|---|---|
| `GET /resto/api/auth?login=..&pass=<sha1>` | token | 462-477 |
| `GET /resto/api/logout?key=` | tokenni bo'shatish | 479-483 |
| `POST /resto/api/v2/reports/olap?key=` | OLAP: savdo, bekor qilinganlar, food cost, ofitsiant savdosi | 234-268, 399-422 |
| `GET /resto/api/v2/assemblyCharts/getAll` | tex-kartalar | 289-296 |
| `GET /resto/api/v2/entities/products/list?includeDeleted=true` | nomenklatura | 302-308 |
| `GET /resto/api/v2/entities/products/group/list` | guruhlar | 314-320 |
| `GET /resto/api/v2/entities/list?rootType=MeasureUnit` | birliklar | 323-329 |
| `GET /resto/api/v2/reports/balance/stores?timestamp=` | ombor qoldig'i | 332-341 |
| `GET /resto/api/v2/entities/list?rootType=Account` | omborlar | 356-361 |
| `GET /resto/api/employees/attendance?from&to` (XML) | davomat | 369-380 |
| `GET /resto/api/employees` (XML) | xodimlar | 383-393 |

To'liq xarita: `docs/IIKO-API-XARITASI.md`. Ulash yo'riqnomasi: `docs/IIKO-ULANISH.md`.

### 2.3 Auth va saqlash

- **Ulanish ma'lumotlari:** jadval `pos_connections` (`libs/database/prisma/pos.prisma:46-85`).
  - Ustunlar: `vendor`, `status`, `baseUrl`, `login`, `secretEncrypted`, `externalOrgId`, `config` (jsonb), `lastSyncAt`, `lastSyncError`, `isActive`, `branchId`.
  - Har filial va vendor uchun bitta ulanish: `@@unique([tenantId, branchId, vendor])` (l.81).
- **Parol shifrlangan:** AES-256-GCM, format `v1:iv:tag:ct`.
  - Kalit env **`POS_SECRET_KEY`** (32 bayt, base64), serverda `/opt/restobrain/.env`.
  - Kod `apps/api/src/pos-sync/secret-box.ts:14-46`. E'lon joylari: `.env.example:51`, `infra/prod/docker-compose.prod.yml:126`.
  - API javobida parol hech qachon qaytmaydi (`connections.service.ts:37-50`).
- **Token:** har ish uchun yangi sessiya: `auth` → ish → `logout` (`finally` ichida) (`iiko-server.client.ts:223-232`). Kesh ham, refresh ham yo'q.
- **🔴 Litsenziya:** bir login bir vaqtda faqat bitta sessiya. Logout qilinmasa, iikoOffice'dagi jonli foydalanuvchi chiqarib yuboriladi (`iiko-server.client.ts:22-24`, `docs/IIKO-API-XARITASI.md:62-64`).
  - Shuning uchun RestoBrain sinxronlari bitta `'pos-sync'` qulfida ketma-ket ishlaydi (`jobs.service.ts:190-203`).
  - **Yangi aksiya servisi o'sha login bilan bir vaqtda kirsa, to'qnashadi.** Unga alohida iiko foydalanuvchisi kerak.
- **Timeout va xatolar:** har so'rovga 30 s (`iiko-server.client.ts:178`, `:506`).
  - 401/403 → `AUTH_FAILED`, boshqasi → `UNREACHABLE` (`connections.service.ts:588-593`).
  - Log'da `key` va `pass` yashiriladi (`:212`, `:499`).

### 2.4 Filiallar va iiko bog'lanishi (prod, 2026-10-12)

`pos_connections` dan, maxfiy ustunlarsiz:

| Filial (RestoBrain) | slug | iiko server (host) | `config.department` (OLAP filtri) | Holat | Oxirgi sinxron |
|---|---|---|---|---|---|
| Fazo | `fazo` | `https://fazo-co.iiko.it` | `Fazo Family Restauraunt` | ACTIVE | 2026-10-12 06:30 UTC |
| Le Fazo | `le-fazo` | `https://fazo-co.iiko.it` | `Le Fazo` | ACTIVE | 2026-10-12 06:30 UTC |
| Boy bobo | `boy-bobo` | `https://to-raxon-boy-bobo-choyxonasi.iiko.it` | `To'raxon Boybobo Choyxonasi` | ACTIVE | 2026-10-12 06:00 UTC |

- **iiko identifikatori — Department *nomi* (matn).** organizationId, terminalGroupId, department UUID va storeId **saqlanmaydi**.
  - Nom OLAP filtriga `Department: IncludeValues` bo'lib qo'yiladi (`iiko-server.client.ts:253-255`; `connections.service.ts:60-64`).
  - `externalOrgId` maydoni bor (iikoCloud uchun mo'ljallangan, `pos.prisma:66-67`), lekin hamma joyda bo'sh.
- **Fazo va Le Fazo bitta iiko serverda**, department bilan ajratiladi. Boy bobo — alohida server (`docs/IIKO-ULANISH.md:80-92`).
  - Bitta serverda ulanishlar `baseUrl|login` bo'yicha birlashtiriladi (`apps/api/src/payroll/pos-sales.service.ts:118-136`).
  - Department belgilanmagan va serverda bir nechta bo'lsa, sinxron to'xtaydi: `POS_DEPARTMENT_REQUIRED` (`connections.service.ts:484-498`).
- **Ulanishlarning loginlari** (bitta yoki alohida) ushbu faylga yozilmadi.

### 2.5 Yopilgan savdoni sana oralig'i bo'yicha olish

- **Bor:** OLAP v2 `reportType: 'SALES'` (`iiko-server.client.ts:239-258`).
  - Sana filtri `'OpenDate.Typed'` (`DateRange`, `CUSTOM`, `from`, `to`, `includeLow` va `includeHigh` true).
  - Ixtiyoriy `Department: IncludeValues`. `buildSummary:false`.
- **RestoBrain so'raydigan ustunlar** (`connections.service.ts:53-54`):
  - `groupByRowFields`: `OpenDate.Typed`, `OpenTime`, `Department`, `PayTypes`, `OrderNum`
  - `aggregateFields`: `DishDiscountSumInt` (tushum, chegirmadan keyin), `DishSumInt`, `GuestNum`
- **Javobda bor:** summa, filial (`Department`), biznes kuni, **ochilish** vaqti (`OpenTime`), `OrderNum`.
- **Javobda yo'q:** yopilish vaqti (`CloseTime` kabi ustun hech qayerda so'ralmaydi) va fiskal ma'lumot.
- **O'chirilgan buyurtmalar filtrlanmaydi** — `OrderDeleted` filtri yuborilmaydi (`docs/SHUBHALI.md:404`, X15).
- **Boshqa SALES so'rovlari:**
  - Bekor qilinganlar (`apps/api/src/pos-sync/void-rows.ts:35-55`).
  - Ofitsiant savdosi: `OrderWaiter.Name` (`apps/api/src/payroll/pos-sales.service.ts:53-55`).
  - Taomlar (`apps/api/src/foodcost/foodcost.service.ts:61-83`).
- **Bizning bazada saqlanishi:**
  - `pos_raw_rows`: `reportType`, `rowKey`, `posBusinessDate`, `effectiveDate`, `openedAt`, `payload` (jsonb — OLAP qatorining o'zi), `importedAt` (`pos.prisma:93-132`).
    - Prod'da `SALES` qatorlari 12 766 ta, 2026-07-02 … 2026-10-11.
    - `rowKey` faqat raqam bo'lmagan maydonlardan sha1. `OrderNum` kalitga kirmaydi, shuning uchun ikki chek to'qnashishi mumkin (X19, `docs/SHUBHALI.md:408`).
  - `pos_daily_totals`: kunlik tushum, chek soni (`finance.prisma:270-300`).
  - `pos_voids`, `dish_costs`, `employee_daily_sales`.
  - **Har buyurtma uchun alohida jadval va `closedAt` yo'q.**
- **Jadval:** har 30 daqiqada (oxirgi 2 kun) va har kecha tenant vaqti bilan 04:00 da (14 kun) (`jobs.service.ts:111-157`, `:175-206`). Umumiy retry yo'q.
- **iiko tavsiyasi** (`docs/IIKO-API-XARITASI.md:65-70`): so'rovlar ketma-ket, davr ≤ 1 oy, `buildSummary=false`, ≤ 7 maydon. RestoBrain SALES'da 8 ta ishlatadi (X20).

### 2.6 Fiskal ma'lumot — topilganlari

- **Repo bo'yicha qidiruv** (kod, hujjat, SQL, testlar):
  - Qidirilgan so'zlar: fiscal, фиск, ККМ, ФР, ФМ, OFD, ОФД, NKM, FiscalCheque, CashRegister, SessionNum, UniqOrderId, ChequeNumber, serial, Чек, Касс.
  - **Natija: fiskal chek raqami, FM, fiskal belgi va kassa SN uchun hech qanday ustun yoki maydon so'ralmaydi va saqlanmaydi.**
  - Yagona chek identifikatori — `OrderNum` (raqam, smena ichida; `docs/IIKO-API-XARITASI.md:32`).
  - `UniqOrderId` faqat taklif sifatida tilga olingan (`docs/SHUBHALI.md:408`).
  - «OFD bilan solishtirish» — kelajak rejasi (`docs/MOLIYA-AUDIT.md:926`).
- **OLAP ustunlarining statik ro'yxati repoda yo'q.** Faqat soni o'lchangan: SALES — 285 ta (`docs/SHUBHALI.md:523`).
- **❗ 4495-chek testi (Fazo DT, 11.10.2026 20:52:51, 8 000 so'm) bajarilmadi.**
  1. Prod bazadagi saqlangan savdo qatorlarini (`pos_raw_rows.payload`) o'qishga urinish ruxsat tizimi tomonidan to'xtatildi (prod ma'lumotini o'qish). Chetlab o'tilmadi.
  2. iiko'ga jonli so'rov prod'dagi shifrlangan parol orqali ketadi va iikoOffice sessiyasini chiqarib yuborish xavfi bor (§2.3). Egasining aniq ruxsatisiz qilinmadi.
  - **Shunga qaramay ma'lum:** RestoBrain saqlaydigan qatorda faqat `OpenDate.Typed`, `OpenTime`, `Department`, `PayTypes`, `OrderNum`, `DishDiscountSumInt`, `DishSumInt`, `GuestNum` bor. Ya'ni bazada **4495 / LG420230613349 bo'yicha qidirib bo'lmaydi.** Faqat Department + kun + `OpenTime` + summa (8 000) bo'yicha taxminiy topish mumkin.

### 2.7 Jonli tekshiruv qanday qilinadi (egasi o'zi yoki ruxsat bilan)

Tayyor andoza: `tools/iiko-clients-probe.mjs`.
- Env: `IIKO_HOST`, `IIKO_LOGIN`, `IIKO_PASSWORD`.
- Ketma-ketlik: auth → `GET /resto/api/v2/reports/olap/columns?reportType=SALES` → … → `logout` (`finally`).
- Hozir u faqat mijoz, karta va telefon so'zlarini chiqaradi (l.103-135).

Qadamlar:
1. **iikoOffice'dan bo'sh vaqtda yoki alohida iiko foydalanuvchisi bilan** (sessiya to'qnashuvi, §2.3).
2. Ustunlar ro'yxatini oling va nomida quyidagilar borini filtrlang: `fiscal`, `Fiscal`, `ФР`, `ККМ`, `Касс`, `Чек`, `Cheque`, `Receipt`, `Session`, `Cash`, `Serial`, `OrderNum`, `UniqOrderId`, `CloseTime`. Javobdagi har ustunning `name` va `type` ini yozing.
3. Topilgan ustunlar bilan `fazo-co.iiko.it`, department `Fazo Family Restauraunt` uchun 2026-10-11 SALES OLAP oling. `OpenTime` ~20:5x va summasi 8 000 bo'lgan qatorni («Орбит жвачка») toping.
4. Javobni (maxfiy qiymatlarsiz) shu faylning §2.6 ga qo'shing.

### 2.8 Agar iiko'da fiskal raqam bo'lmasa — zaxira yo'llar

1. **FM → filial jadvali + vaqt bo'yicha moslash.**
   - QR'dagi `t` (FM) → filial (statik jadval, §6). `c` = chek vaqti (sekundgacha).
   - iiko'dan o'sha department va kun bo'yicha savdo olinib, yopilish vaqti eng yaqin chek topiladi. Buning uchun OLAP'da `CloseTime` yoki shunga o'xshash ustun kerak (aniqlash kerak).
   - **Xavf:** bir vaqtda yopilgan ikki chek, iiko va fiskal vaqt farqi.
2. **Ochiq soliq sahifasi** `https://ofd.soliq.uz/check?t=..&r=..&c=..&s=..`. Sahifada chek tafsiloti bor (topshiriqda NKM nomi va SN ko'ringani aytilgan). Summa ham shu yerda bo'lishi kutiladi — **aniqlash kerak**.
   - **Xavf:** sahifa tuzilishi o'zgarishi, so'rov limiti, foydalanish shartlari (huquqiy tomon).
   - **Afzallik:** iiko va litsenziya sessiyasi kerak emas, `s` fiskal belgi soxta QR'ni ham ushlaydi.
3. **iikoCloud API** (agar Fazo'da iikoCloud yoqilgan bo'lsa). RestoBrain'da client yo'q, sinov skripti `tools/iiko-cloud-probe.mjs` (env `IIKO_API_LOGIN`). Fiskal maydonlari aniqlash kerak.

---

## 3. Admin panel va auth

- **Texnologiya:** `apps/admin`, Next 16 App Router, `output: standalone`.
  - `/api/*` → `API_URL` ga rewrite (`apps/admin/next.config.ts`).
  - `X-Frame-Options: DENY` (`next.config.ts:37`) — panelni iframe'ga solib bo'lmaydi.
- **Kirish:** `POST /api/v1/auth/login` (tenant ichida: username + parol).
  - Javob tanasida access va refresh token qaytadi. Ular **localStorage** da (`rb.access`, `rb.refresh`) saqlanadi (`apps/admin/lib/auth-store.ts:1-11`).
  - **Access:** JWT HS256, 15 daqiqa. **Refresh:** tasodifiy 48 bayt, bazada SHA-256 hashi, 30 kun, har yangilashda almashadi (`libs/auth/src/token.service.ts:58-72`).
- **Tenant aniqlash:** subdomen (`fazo.restobrain.uz` → `fazo`), API buni Host'dan oladi (`libs/tenancy/src/tenant-resolver.ts:212,245`).
  - `x-tenant-slug` sarlavhasi faqat prod bo'lmagan muhitda hisobga olinadi (`libs/tenancy/src/tenant.middleware.ts:141,164`).
  - Token'dagi `tid` Host'dagi tenantdan farq qilsa → `TENANT_MISMATCH`.
- **Foydalanuvchi va huquqlar** (`libs/database/prisma/identity.prisma`):
  - `User` (username, phone, employeeId), `Role` (slug, isSuperUser, tier), `Permission` (kalit, masalan `crm.read`), `RolePermission`, `UserRole`.
  - `UserAssignment` — bo'lim va filial ko'lami.
  - Dekoratorlar: `@RequirePermission`, `@RequireAnyPermission`, `@Public`, `@NoTenant` (`libs/tenancy/src/guards.ts`).
- **JWT claim'lari** (`libs/auth/src/auth.types.ts`):
  - `sub` (userId), `tid` (tenantId), `usr` (username), `prm` (ruxsat kalitlari).
  - `brn?` (filiallar), `loc?`, `imp?`, `pwd?`, `sid?`, `exp`/`iat`.
  - Secret env **`JWT_SECRET`** (≥ 32 belgi, `libs/auth/src/auth.module.ts:36-48`). Public key, JWKS, issuer va audience **yo'q**.
  - Superadmin alohida: `PLATFORM_JWT_SECRET`.
- **Yangi menyu sahifasi qo'shish:**
  1. `apps/admin/components/nav-tree.ts` → `NAV_SECTIONS` (l.99). Element: `{ title, url, icon, perms, stable }`. Ko'rinish `visibleSections` bilan filtrlanadi (l.294).
  2. Sahifa: `apps/admin/app/(dashboard)/<bo'lim>/<sahifa>/page.tsx`. Havolalar Next `<Link>` orqali (`components/nav-main.tsx:98,210`).
  - **Tashqi havola yoki iframe tayyor emas.** nav modelida tashqi URL turi yo'q. Yagona tashqi havola — sarlavhadagi zal ilovasi tugmasi (`components/floor-app-link.tsx:46-58`).
- **Tashqi servisni ulash variantlari:**

  | Yo'l | Ish hajmi | Izoh |
  |---|---|---|
  | **Oddiy havola (tavsiya)** — nav'ga `target=_blank` tashqi URL, aksiya servisi o'z login'i bilan | Kichik: `nav-tree.ts` ga tashqi URL qo'llovi | Xavfsiz va mustaqil |
  | **Bir martalik SSO kodi** — panel API'dan qisqa umrli imzolangan kod oladi (HMAC, alohida secret), aksiya servisi uni tekshiradi | O'rta: RestoBrain'da yangi endpoint | Eski tizimda shunday edi: Fazo HR `GET /sso?t=<HMAC>`, `HR_SSO_SECRET`, 24 soat (`docs/audit/02-hr-tizimi-audit.md:23-24,114-117`) |
  | **RestoBrain JWT'sini qayta ishlatish** | — | ❌ `JWT_SECRET` ni ulashib bo'lmaydi: u bilan token **yasash** ham mumkin. Token boshqa origin'dagi localStorage'da, yangi servis uni o'qiy olmaydi |
  | **iframe** | — | ❌ panel `X-Frame-Options: DENY` |

- **Servisdan servisga auth:** umumiy `x-api-key` yoki integratsiya tokeni **yo'q**. Faqat Face ID qurilmasi `x-device-token` bilan (`apps/api/src/attendance/device-token.guard.ts:70`) va Telegram webhook secret.

---

## 4. DB va qayta ishlatsa bo'ladigan ma'lumotlar

- **Bazalar:** bitta PostgreSQL 17, baza `restobrain`. Ko'p mijozli: Prisma kengaytmasi `tenantId` + RLS.
  - Rollar: ilova `restobrain_app`, superadmin `restobrain_platform`, owner faqat migratsiya uchun.
  - Fazo — **bitta tenant** `fazo` («Fazo Group», legalName «Fazo Group MChJ»; `libs/database/sql/110_seed_tenant_fazo.sql:27`).
- **Asosiy jadvallar:**

  | Jadval | Asosiy maydonlar | Dalil |
  |---|---|---|
  | `tenants` | slug, name, legalName, status, contactPhone | `platform.prisma:32` |
  | `branches` | name, slug, type, primarySource, address, lat/lng, phone, timezone, isActive. **STIR va iiko maydoni yo'q** | `platform.prisma:261` |
  | `tax_firms` (yuridik shaxs) | name, `taxNumber` (STIR/INN), taxRegime, enterpriseType, address, region, `branchIds[]` | `tax.prisma:114` |
  | `pos_connections` | §2.3 | `pos.prisma:46` |
  | `employees` | first/last/middleName, **`phone`**, branchId, departmentId, position, `posEmployeeId`, emergencyPhone, status | `hr.prisma:57` |
  | `users` | username, **`phone`**, `employeeId` (1:1) | `identity.prisma:116` |
  | `user_telegrams` | telegramId, **`phone`** (bot orqali olingan) | `identity.prisma:454` |
  | `customers` (CRM) | fullName, **phone** (`@@unique([tenantId, phone])`), email, birthDate, loyaltyCardNo, visit statistikasi, consentMarketing | `crm.prisma:14` |
  | `tenant_bots`, `telegram_chats` | §5.3 | `integrations.prisma:196,243` |

- **Xodimlarning telefonlari (o'yindan chiqarish uchun):**
  - **3 ta manba:** `employees.phone` (ixtiyoriy, ko'pchilikda bo'sh bo'lishi mumkin), `users.phone`, `user_telegrams.phone` (botga ulanganlar uchun ishonchli).
  - Panel endi telefonni `+998901234567` ko'rinishida saqlaydi, eski yozuvlar boshqa formatda bo'lishi mumkin. Solishtirishda faqat raqamlarni olish kerak.
  - **Aniqlash kerak:** prod'da nechta faol xodimda telefon to'ldirilgan.
- **Yangi servis RestoBrain'dan qanday oladi:**
  - Ommaviy yoki integratsiya API yo'q. Hamma endpoint JWT va ruxsat bilan:

    | Endpoint | Ruxsat | Dalil |
    |---|---|---|
    | `GET /api/v1/catalog/branches` | istalgan kirgan foydalanuvchi | `catalog.controller.ts:28` |
    | `GET /api/v1/branches` | `settings.read` | `catalog/branches/branches.controller.ts:36-42` |
    | `GET /api/v1/hr/employees` (sahifalangan, `limit` ≤ 200) | `hr.read` | `hr/employees/employees.controller.ts:31-69` |
    | `GET /api/v1/hr/employees/options` | hr.read, attendance.read yoki payroll.read | o'sha joy |

  - **Tavsiya:** Fazo tenantida aksiya servisi uchun alohida foydalanuvchi (masalan `aksiya-bot`), faqat `hr.read` va `settings.read`. Servis `POST /api/v1/auth/login` bilan kiradi va tokenni refresh bilan yangilab turadi.
    - So'rov `https://fazo.restobrain.uz/api/v1/...` ga yuboriladi: tenant Host'dan aniqlanadi.
  - **To'g'ridan-to'g'ri DB — tavsiya etilmaydi:** ilova roli RLS bilan `app.tenant_id` sessiya o'zgaruvchisini talab qiladi, owner bilan ulanish izolyatsiyani chetlab o'tadi (`CLAUDE.md` §3).

---

## 5. CRM / Fazo HR / botlar

### 5.1 CRM
- **O'zimizniki:** `apps/crm` («Zal ilovasi»: zal xaritasi, stol broni), `<slug>-crm.restobrain.uz`. API va foydalanuvchilar bitta (`docs/CRM-SUBDOMEN-REJA.md:1-25`). amoCRM yoki Bitrix emas.
- **Mijoz qo'shish:** `POST /api/v1/customers`, ruxsat `crm.create` (`apps/api/src/crm/crm.controller.ts:268`).
  - Tana: `{ fullName?, phone?, birthDate?, note?, consentMarketing? }` — ism yoki telefondan kamida bittasi.
  - Telefon normallashtiriladi. Takror telefon → 409 (`crm.service.ts:299-321`).
- **Qidirish:** `GET /api/v1/customers?phone=` (`crm.read`).
- Aksiya qatnashchilarini CRM'ga yozish **mumkin**: o'sha servis foydalanuvchisiga `crm.create` va `crm.read` beriladi.

### 5.2 Fazo HR / Biznes Miyya
- **Eski tizimlar** (`docs/audit/00-UMUMIY-XULOSA.md:20-30`):
  - Biznes Miyya — FastAPI + Next.js + aiogram, Railway.
  - Fazo HR — Express + Supabase, `hr-tizimi.onrender.com`.
  - Fazo Mobile — Flask.
- **RestoBrain ularni almashtiradi**, ular bilan integratsiya yo'q. Eski ma'lumotni ko'chirish (ETL) hali ochiq (`docs/QILINGAN-ISHLAR.md:311`).
- **Xodimlar telefonlari endi RestoBrain'da** (§4).

### 5.3 Telegram botlar
- **Ko'p mijozli bot** (`apps/bot`): har kompaniya o'z botini panelda ulaydi (`docs/BOT-KONTRAKT.md:1-30`).
  - Token `tenant_bots.tokenEnc` da, `BOT_SECRET_KEY` bilan shifrlangan (rotatsiya uchun `BOT_SECRET_KEY_OLD`) (`libs/telegram/src/token-box.ts:40-46`).
  - Webhook: `POST <BOT_PUBLIC_URL>/telegram/<webhookSecret>` → `bot.restobrain.uz`.
  - Bot env: `BOT_PUBLIC_URL`, `BOT_PORT`, `BOT_MODE`, `BOT_HOST`, `ROOT_DOMAIN`, `TASKS_ENABLED`, `DATABASE_URL`, `R2_*`, `AI_SECRET_KEY`.
- **Fazo botining vazifasi:** xodimlar uchun — ta'minot (zayavka, xarid, chek), hisobot, vazifalar. Mijozlar uchun emas.
  - **Aksiya uchun alohida bot tokeni kerak:** bitta tokenga faqat bitta webhook ulanadi.
- **Bildirishnomalar:** outbox. API `notifications` qatorlarini yozadi, bot `app_claim_notifications` orqali yuboradi, kanallar TELEGRAM va SMS (`apps/api/src/notifications/notifications.service.ts:1-12`).
  - Guruhlar `telegram_chats` (bot qo'shilganda o'zi yoziladi), hozir yig'ilish e'lonlari uchun.
- **Egaga ogohlantirish beruvchi alohida bot yo'q.** Server hisoboti bazaga yoziladi (`infra/prod/health-report.sh:1-15`).

---

## 6. Filiallar jadvali

Prod `branches`, `tax_firms`, `pos_connections` (2026-10-12) va topshiriqdagi ma'lum faktlar:

| Filial (RestoBrain) | Brend / turi | Yuridik shaxs (`tax_firms`) / STIR | iiko | Kassa FM | Manzil |
|---|---|---|---|---|---|
| Fazo (`fazo`) | Fazo Restaurant / RESTAURANT | **Fazo DT** (`tax_firms.branchIds` → Fazo). STIR bazada bo'sh; topshiriqdan: **312163993** | `fazo-co.iiko.it`, department `Fazo Family Restauraunt` | **`LG420230613349`** (topshiriqdan, bitta). Boshqa kassalar — aniqlash kerak | Firma: Namangan, Davlatobod, Do'stlik ko'cha 9a. `branches.address` bo'sh |
| Le Fazo (`le-fazo`) | Le Fazo / RESTAURANT (seed'da BAKERY) | **Le Fazo** (`branchIds` → Le Fazo). STIR — aniqlash kerak | `fazo-co.iiko.it`, department `Le Fazo` | Aniqlash kerak | Firma: Namangan, Davlatobod, Do'stlik ko'cha 9a — aniqlash kerak |
| Boy bobo (`boy-bobo`) | To'raxon Boybobo choyxonasi / TEAHOUSE | **Boybobo** — firma bor, lekin filialga bog'lanmagan (`branchIds` bo'sh). STIR — aniqlash kerak | `to-raxon-boy-bobo-choyxonasi.iiko.it`, department `To'raxon Boybobo Choyxonasi` | Aniqlash kerak | Firma: Namangan, Davlatobod, Do'stlik ko'cha 9a — aniqlash kerak |

Izohlar:
- Uchala firmaning manzili bir xil yozilgan — ehtimol to'ldirilmagan yoki nusxa. Tekshirish kerak.
- Seed'da yana To'yimli (`toyimli`, B2B yetkazib berish) va Fazo Catering bor (`110_seed_tenant_fazo.sql:99-103`), lekin prod'da faqat 3 filial.
- Eski tizimlarda «Buyuk ipak yo'li mehmonxonasi» ham bor edi (`docs/audit/02-hr-tizimi-audit.md:13-15`).
- `tax_firms` modeli izohida «Fazo'da 5 ta firma bor» deyilgan (`tax.prisma:114`), prod'da 3 ta. Barcha firmalar va STIR'lar — egasidan so'rash kerak (`docs/MOLIYA-AUDIT.md:1379`, Q22).

---

## 7. Ochiq savollar (egasidan so'rash kerak)

1. **Jonli iiko tekshiruviga ruxsat:** kim va qachon (iikoOffice sessiyasi chiqib ketmasligi uchun)? Aksiya uchun alohida iiko foydalanuvchisi ochiladimi (har iiko server uchun)?
2. **SALES OLAP'da fiskal ustunlar** bormi (§2.7 natijasi)? Yo'q bo'lsa — soliq sahifasidan summa olish (§2.8-2) ma'qulmi, huquqiy jihatdan ham?
3. **Har filialning barcha kassalari FM raqamlari** (Fazo'da bittadan ko'p kassa bo'lishi mumkin). Le Fazo va Boy bobo FM'lari.
4. **Har filial qaysi yuridik shaxsga tegishli va STIR'lari.** Boybobo firmasi Boy bobo filialiga bog'lanadimi? Le Fazo STIR?
5. **Filial manzillari** (bazada bo'sh).
6. **iikoCloud** Fazo'da yoqilganmi (apiLogin bormi)? Bo'lsa, iikoCloud zaxira yo'l bo'la oladi.
7. **Aksiya servisi domeni:** `restobrain.uz` subdomeni bo'lsa, tenant regex bilan to'qnashmasligi kerak (§1.3). Yoki alohida domen, masalan `fazorestaurant.uz` ostida?
8. **«Fazo Restaurant» alohida loyihasi** (`fazorestaurant.uz`, shu serverdagi `fazo-*` konteynerlar) aksiyaga aloqadormi? Ma'lumoti va mijozlari kerakmi?
9. **Xodimlarni o'yindan chiqarish qoidasi:** `employees.phone`, `users.phone` va `user_telegrams.phone` dan qaysi biri asos? Ishdan ketgan xodimlar ham chiqariladimi?
10. **Aksiya qatnashchilari RestoBrain CRM'ga** (`customers`) yozilsinmi?
11. **Aksiya boti** — yangi Telegram bot (yangi token). Mini app domeni qaysi?

---

### Ilova: ushbu sessiyada bajarilgan buyruqlar (faqat o'qish)

- `ssh fazo 'docker ps …; ls /etc/nginx/sites-enabled; grep server_name …'` — servislar, portlar, domenlar.
- `ssh fazo 'nproc; free -h; df -h /; nginx -v; docker --version'` — resurslar.
- `ssh fazo "docker exec restobrain-postgres psql … information_schema …"` — jadval va ustun nomlari.
- `ssh fazo "… select … from branches / pos_connections (secretEncrypted va login'siz) / tax_firms / pos_raw_rows count"` — filiallar, iiko ulanishlari, firmalar, saqlangan qatorlar soni.
- **Rad etildi va bajarilmadi:** `pos_raw_rows.payload` ichini o'qish (prod savdo ma'lumoti). Jonli iiko so'rovi umuman yuborilmadi.
- Kod bo'yicha ma'lumotlar ikkita faqat o'qish rejimidagi tadqiqot agentidan olindi. Asosiy da'volar qo'lda tekshirildi:
  - `connections.service.ts:53-54`, `iiko-server.client.ts:1-27,236-260`, `auth.types.ts`.
  - biyhotel serverda yo'q degan da'vo noto'g'ri chiqdi: konteynerlar ishlab turibdi.
