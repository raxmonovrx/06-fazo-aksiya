import 'reflect-metadata';
import './load-env.js';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { config } from './config.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const cfg = config();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setupApp(app);
  app.enableShutdownHooks();
  await app.listen(cfg.PORT, '0.0.0.0');
  Logger.log(`API :${cfg.PORT} da ishlayapti (bot: ${cfg.BOT_MODE})`, 'Bootstrap');
}

void bootstrap();
