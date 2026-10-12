import { Test } from '@nestjs/testing';
import { Bot } from 'grammy';
import type { Update } from 'grammy/types';

import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '../src/app.module.js';
import { setupApp } from '../src/setup-app.js';
import { BOT } from '../src/telegram/bot.token.js';

export interface SentCall {
  method: string;
  payload: Record<string, any>;
}

/** Tarmoqqa chiqmaydigan bot: barcha API chaqiruvlari `calls` ga yoziladi. */
export async function createTestApp() {
  process.env.BOT_MODE = 'off';
  const calls: SentCall[] = [];
  const bot = new Bot('123456:TEST_TOKEN_TEST_TOKEN_TEST', {
    botInfo: {
      id: 123456,
      is_bot: true,
      first_name: 'Fazo Club',
      username: 'FazoClub_bot',
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    } as any,
  });
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, any> });
    return { ok: true, result: method === 'getFile' ? { file_id: 'x', file_unique_id: 'x', file_path: 'photos/x.jpg' } : (true as any) } as any;
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(BOT)
    .useValue(bot)
    .compile();
  const app = setupApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
  await app.init();
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();

  let updateId = 1;
  const send = async (update: Omit<Update, 'update_id'>) => {
    await bot.handleUpdate({ update_id: updateId++, ...update } as Update);
  };
  return { app, bot, calls, send, baseUrl: baseUrl.replace('[::1]', '127.0.0.1') + '/api' };
}

export function textMessage(userId: number, text: string, extra: Record<string, unknown> = {}) {
  const entities = text.startsWith('/') ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] : undefined;
  return {
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: 'private', first_name: 'Test' },
      from: { id: userId, is_bot: false, first_name: 'Test', language_code: 'uz' },
      text,
      entities,
      ...extra,
    },
  } as any;
}

export function contactMessage(userId: number, phone: string, contactUserId = userId) {
  return {
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: 'private', first_name: 'Test' },
      from: { id: userId, is_bot: false, first_name: 'Test' },
      contact: { phone_number: phone, first_name: 'Test', user_id: contactUserId },
    },
  } as any;
}

export function callback(userId: number, data: string) {
  return {
    callback_query: {
      id: String(Math.random()),
      from: { id: userId, is_bot: false, first_name: 'Test' },
      chat_instance: '1',
      data,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: userId, type: 'private', first_name: 'Test' },
        text: 'x',
      },
    },
  } as any;
}

export function photoMessage(userId: number, fileId = 'PHOTO_FILE_ID') {
  return {
    message: {
      message_id: Math.floor(Math.random() * 1e6),
      date: Math.floor(Date.now() / 1000),
      chat: { id: userId, type: 'private', first_name: 'Test' },
      from: { id: userId, is_bot: false, first_name: 'Test' },
      photo: [
        { file_id: 'small', file_unique_id: 's', width: 90, height: 160 },
        { file_id: fileId, file_unique_id: 'b', width: 1080, height: 1920 },
      ],
    },
  } as any;
}
