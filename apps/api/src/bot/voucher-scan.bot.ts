import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Bot } from 'grammy';

import { BotService } from './bot.service.js';
import { config } from '../config.js';
import { BOT } from '../telegram/bot.token.js';
import { parseVoucherToken } from '../core/voucher-token.js';
import { FISCAL_DISABLED, PHOTO_NO_QR } from '../vouchers/voucher-texts.js';
import { decodeQrFromImage } from './qr-decode.js';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Kamerasiz yo'l: kassa QR'ining rasmi yoki havolasi botga yuborilsa — kupon qo'shiladi.
 * Soliq cheki QR'i yuborilsa — kassirdan Fazo Group QR'ini so'rash aytiladi.
 */
@Injectable()
export class VoucherScanHandlers implements OnModuleInit {
  private readonly log = new Logger(VoucherScanHandlers.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly botService: BotService,
  ) {}

  onModuleInit() {
    this.botService.addHandlers((bot) => {
      const pm = bot.chatType('private');

      pm.on(['message:photo', 'message:document'], (ctx) =>
        this.botService.withParticipant(ctx, async (p) => {
          const msg = ctx.message;
          let fileId: string;
          if (msg.photo?.length) {
            fileId = msg.photo[msg.photo.length - 1].file_id; // eng katta o'lcham
          } else if (msg.document?.mime_type?.startsWith('image/')) {
            if ((msg.document.file_size ?? 0) > MAX_IMAGE_BYTES) return ctx.reply('Rasm juda katta (15 MB dan oshmasin).');
            fileId = msg.document.file_id;
          } else {
            return ctx.reply(PHOTO_NO_QR);
          }
          await ctx.replyWithChatAction('typing').catch(() => undefined);
          let text: string | null = null;
          try {
            text = await decodeQrFromImage(await this.download(fileId));
          } catch (e) {
            this.log.error(`Rasm yuklab olinmadi/o'qilmadi: ${(e as Error).message}`);
          }
          const token = parseVoucherToken(text);
          if (token) return this.botService.redeemAndReply(ctx, p, token);
          if (text && /ofd\.soliq\.uz/i.test(text)) return ctx.reply(FISCAL_DISABLED, { parse_mode: 'HTML' });
          return ctx.reply(PHOTO_NO_QR);
        }),
      );

      // Matn ko'rinishidagi havola: vaucher yoki soliq cheki QR'i
      pm.hears(/t\.me\/\S+start=v_|ofd\.soliq\.uz\/\S+/i, (ctx) =>
        this.botService.withParticipant(ctx, async (p) => {
          const text = ctx.message!.text!;
          const token = parseVoucherToken(text.match(/\S*start=v_\S+/)?.[0] ?? text);
          if (token) return this.botService.redeemAndReply(ctx, p, token);
          return ctx.reply(FISCAL_DISABLED, { parse_mode: 'HTML' });
        }),
      );
    });
  }

  private async download(fileId: string): Promise<Buffer> {
    const file = await this.bot.api.getFile(fileId);
    if (!file.file_path) throw new Error('file_path yo\'q');
    const res = await fetch(`https://api.telegram.org/file/bot${config().BOT_TOKEN}/${file.file_path}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) throw new Error('juda katta');
    return buf;
  }
}
