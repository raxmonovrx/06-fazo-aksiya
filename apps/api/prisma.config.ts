// `.env` repo ildizida. Prisma CLI uni apps/api dan topmaydi — o'zimiz yuklaymiz.
// Docker'da `.env` yo'q, DATABASE_URL muhitdan keladi.
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'prisma/config';

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  loadEnvFile(path.join(here, '../../.env'));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}

export default defineConfig({
  schema: path.join(here, 'prisma/schema.prisma'),
});
