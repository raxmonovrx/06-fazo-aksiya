import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module.js';
import { config } from './config.js';

// BigInt (tgId) JSON'ga satr bo'lib chiqsin
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const cfg = config();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  app.set('trust proxy', 'loopback');
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '2mb' });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen(cfg.PORT, '0.0.0.0');
  Logger.log(`API :${cfg.PORT} da ishlayapti (bot: ${cfg.BOT_MODE})`, 'Bootstrap');
}

void bootstrap();
