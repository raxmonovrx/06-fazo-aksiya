import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Bot } from 'grammy';

import { config } from '../config.js';
import { BOT } from './bot.token.js';

/** Admin Telegram guruhiga ogohlantirishlar (ADMIN_ALERT_CHAT_ID). */
@Injectable()
export class AlertsService {
  private readonly log = new Logger(AlertsService.name);
  // Bir xil xabar bilan guruhni to'ldirib yubormaslik uchun
  private readonly recent = new Map<string, number>();

  constructor(@Inject(BOT) private readonly bot: Bot) {}

  /** `dedupeKey` berilsa, shu kalit bilan 1 soatda bir martadan ko'p yuborilmaydi. */
  async send(text: string, dedupeKey?: string): Promise<void> {
    const chatId = config().ADMIN_ALERT_CHAT_ID;
    if (dedupeKey) {
      const last = this.recent.get(dedupeKey);
      if (last && Date.now() - last < 60 * 60 * 1000) return;
      this.recent.set(dedupeKey, Date.now());
    }
    if (!chatId) {
      this.log.warn(`ALERT (ADMIN_ALERT_CHAT_ID yo'q): ${text}`);
      return;
    }
    try {
      await this.bot.api.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
    } catch (e) {
      this.log.error(`Alert yuborilmadi: ${(e as Error).message}`);
    }
  }
}
