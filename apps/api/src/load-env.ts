// Lokal ishga tushirishda (pnpm dev:api) repo ildizidagi .env ni yuklaydi.
// Docker'da .env yo'q — o'zgaruvchilar compose'dan keladi, fayl topilmasa jim o'tadi.
// main.ts'da BIRINCHI import bo'lishi kerak: ESM import'lari fayl boshiga ko'tariladi.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env'),
  quiet: true,
});
