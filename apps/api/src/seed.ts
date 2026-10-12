// Boshlang'ich ma'lumot: aksiya, filiallar, ma'lum FM, birinchi admin.
// Qayta ishga tushirsa bo'ladi (idempotent) — mavjud yozuvlarni o'zgartirmaydi.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { tashkentToUtc } from './core/time.js';

const prisma = new PrismaClient();

const RULES = [
  '"Omad Fazosi" aksiyasi qoidalari (qisqacha):',
  '1. Fazo Group filiallarida olingan fiskal chek bilan qatnashiladi.',
  "2. Chek 72 soat ichida botga qo'shilishi kerak.",
  "3. Har bir filialda chek summasiga qarab kupon beriladi. Bitta chek faqat bir marta ishlatiladi.",
  "4. Kuponlar har kuni ertalab hisoblanadi. Har oy sovg'alar, yil oxirida avtomobil o'ynaladi.",
  "5. Fazo xodimlari ro'yxatdan o'tishi mumkin, lekin o'yinda qatnashmaydi.",
].join('\n');

const BRANCHES = [
  {
    name: 'Fazo Restaurant',
    brand: 'Fazo',
    iikoRef: { host: 'https://fazo-co.iiko.it', department: 'Fazo Family Restauraunt' },
    devices: [{ fm: 'LG420230613349', legalName: '"Fazo DT" MChJ', stir: '312163993' }],
  },
  {
    name: 'Le Fazo',
    brand: 'Le Fazo',
    iikoRef: { host: 'https://fazo-co.iiko.it', department: 'Le Fazo' },
    devices: [],
  },
  {
    name: 'Boy Bobo',
    brand: "To'raxon Boybobo choyxonasi",
    iikoRef: { host: 'https://to-raxon-boy-bobo-choyxonasi.iiko.it', department: "To'raxon Boybobo Choyxonasi" },
    devices: [],
  },
];

async function main() {
  if (!(await prisma.campaign.findFirst())) {
    await prisma.campaign.create({
      data: {
        name: 'Omad Fazosi',
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
        data: { name: b.name, brand: b.brand, iikoRef: b.iikoRef },
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
