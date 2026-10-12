import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

// BigInt (tgId) JSON'ga satr bo'lib chiqsin
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

/** main.ts va testlar uchun umumiy sozlama. */
export function setupApp(app: NestExpressApplication) {
  app.set('trust proxy', 'loopback');
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '2mb' });
  app.setGlobalPrefix('api');
  return app;
}
