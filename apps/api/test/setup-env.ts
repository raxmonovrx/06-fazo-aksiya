import path from 'node:path';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile(path.resolve(__dirname, '../../../.env'));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
}
process.env.BOT_MODE = 'off';
