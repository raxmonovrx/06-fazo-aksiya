import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4600),
  DATABASE_URL: z.string().min(1),
  // Mini app va admin manzili (https://club.fazorestaurant.uz)
  PUBLIC_URL: z.string().url(),
  BOT_TOKEN: z.string().min(20),
  BOT_USERNAME: z.string().min(3),
  // polling — lokal; webhook — prod
  BOT_MODE: z.enum(['polling', 'webhook', 'off']).default('webhook'),
  BOT_WEBHOOK_SECRET: z.string().min(16),
  ADMIN_ALERT_CHAT_ID: z.string().optional().default(''),
  JWT_SECRET: z.string().min(32),
  ADMIN_INIT_LOGIN: z.string().optional(),
  ADMIN_INIT_PASSWORD: z.string().optional(),
  SUPPORT_CONTACT: z.string().default(''),
  // Rasm va eksport fayllari uchun papka
  STORAGE_DIR: z.string().default('./storage'),
});

export type Config = z.infer<typeof schema>;

let cached: Config | null = null;

export function config(): Config {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
console.log('ENV CHECK:', {
  DATABASE_URL: Boolean(process.env.DATABASE_URL),
  PUBLIC_URL: Boolean(process.env.PUBLIC_URL),
  BOT_TOKEN: Boolean(process.env.BOT_TOKEN),
  BOT_USERNAME: Boolean(process.env.BOT_USERNAME),
  BOT_WEBHOOK_SECRET: Boolean(process.env.BOT_WEBHOOK_SECRET),
  JWT_SECRET: Boolean(process.env.JWT_SECRET),
});
      throw new Error(`.env noto'g'ri:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const isHttps = () => config().PUBLIC_URL.startsWith('https://');
