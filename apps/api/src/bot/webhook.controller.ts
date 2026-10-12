import { timingSafeEqual } from 'node:crypto';

import { Body, Controller, ForbiddenException, Headers, HttpCode, Inject, Logger, Post } from '@nestjs/common';
import type { Bot } from 'grammy';
import type { Update } from 'grammy/types';

import { config } from '../config.js';
import { BOT } from '../telegram/bot.token.js';

@Controller('tg')
export class WebhookController {
  private readonly log = new Logger(WebhookController.name);

  constructor(@Inject(BOT) private readonly bot: Bot) {}

  @Post('webhook')
  @HttpCode(200)
  async handle(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: Update,
  ) {
    const expected = Buffer.from(config().BOT_WEBHOOK_SECRET);
    const got = Buffer.from(secret ?? '');
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      throw new ForbiddenException();
    }
    // Telegram ~10 s kutadi, keyin qayta yuboradi. Uzoq ish (rasm dekodlash)
    // fonda davom etadi, javob esa darhol qaytadi.
    const work = this.bot.handleUpdate(update).catch((e) => {
      this.log.error(`Update ${update.update_id}: ${(e as Error).message}`);
    });
    await Promise.race([work, new Promise((r) => setTimeout(r, 8_000))]);
    return { ok: true };
  }
}
