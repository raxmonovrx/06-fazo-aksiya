// Boshlang'ich ma'lumot: aksiya, filiallar, ma'lum FM, birinchi admin.
// Qayta ishga tushirsa bo'ladi (idempotent) — mavjud yozuvlarni o'zgartirmaydi.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { tashkentToUtc } from './core/time.js';

const prisma = new PrismaClient();

const RULES = [
  '“KIA SONET MENIKI” aksiyasi qoidalari (qisqacha):',
  "1. Fazo Group filiallarida to'lovdan keyin kassir Fazo Group QR'ini beradi.",
  "2. QR'ni 72 soat ichida telefon kamerasi bilan skanerlang va botda «Start»ni bosing.",
  "3. Kupon soni chek summasiga qarab filial qoidasi bo'yicha beriladi. Har bir QR faqat bir marta ishlaydi.",
  "4. Kuponlar darhol qo'shiladi. Har oy sovg'alar, yil oxirida KIA Sonet avtomobili o'ynaladi.",
  "5. Fazo xodimlari ro'yxatdan o'tishi mumkin, lekin o'yinda qatnashmaydi.",
].join('\n');

const BRANCHES = [
  {
    name: 'Fazo Restaurant',
    brand: 'Fazo',
    minSum: 300_000,
    iikoRef: { host: 'https://fazo-co.iiko.it', department: 'Fazo Family Restauraunt' },
    devices: [{ fm: 'LG420230613349', legalName: '"Fazo DT" MChJ', stir: '312163993' }],
  },
  {
    name: 'Le Fazo',
    brand: 'Le Fazo',
    minSum: 200_000,
    iikoRef: { host: 'https://fazo-co.iiko.it', department: 'Le Fazo' },
    devices: [],
  },
  {
    name: 'Boy Bobo',
    brand: "To'raxon Boybobo choyxonasi",
    minSum: 200_000,
    iikoRef: { host: 'https://to-raxon-boy-bobo-choyxonasi.iiko.it', department: "To'raxon Boybobo Choyxonasi" },
    devices: [],
  },
];

async function main() {
  if (!(await prisma.campaign.findFirst())) {
    await prisma.campaign.create({
      data: {
        name: 'KIA SONET MENIKI',
        startsAt: tashkentToUtc(2026, 10, 15)!,
        receiptWindowHours: 72,
        rulesText: RULES,
      },
    });
    console.log('+ aksiya');
  }

  for (const b of BRANCHES) {
    let branch = await prisma.branch.findFirst({ where: { name: b.name } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: { name: b.name, brand: b.brand, minSum: b.minSum, iikoRef: b.iikoRef },
      });
      console.log(`+ filial ${b.name}`);
    }
    for (const d of b.devices) {
      const exists = await prisma.fiscalDevice.findUnique({ where: { fm: d.fm } });
      if (!exists) {
        await prisma.fiscalDevice.create({ data: { ...d, branchId: branch.id } });
        console.log(`+ FM ${d.fm}`);
      }
    }
  }

  const login = process.env.ADMIN_INIT_LOGIN;
  const password = process.env.ADMIN_INIT_PASSWORD;
  if (login && password && !(await prisma.adminUser.findUnique({ where: { login } }))) {
    await prisma.adminUser.create({
      data: { login, passwordHash: await bcrypt.hash(password, 12), role: 'ADMIN' },
    });
    console.log(`+ admin ${login}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
