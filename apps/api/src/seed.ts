// Boshlang'ich ma'lumot: aksiya, filiallar, birinchi admin.
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
  "6. Do'stingiz havolangiz orqali kelib, birinchi xaridini qilsa, sizga 1 bonus kupon beriladi (oyiga ko'pi bilan 10 ta).",
].join('\n');

const BRANCHES = [
  {
    name: 'Fazo Restaurant',
    brand: 'Fazo',
    minSum: 300_000,
  },
  {
    name: 'Le Fazo',
    brand: 'Le Fazo',
    minSum: 200_000,
  },
  {
    name: 'Boy Bobo',
    brand: "To'raxon Boybobo choyxonasi",
    minSum: 200_000,
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
    if (!(await prisma.branch.findFirst({ where: { name: b.name } }))) {
      await prisma.branch.create({ data: { name: b.name, brand: b.brand, minSum: b.minSum, couponPrice: b.minSum } });
      console.log(`+ filial ${b.name}`);
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
