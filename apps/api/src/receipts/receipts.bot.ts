import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Bot, Context } from 'grammy';

import { BotService } from '../bot/bot.service.js';
import { config } from '../config.js';
import { BOT } from '../telegram/bot.token.js';
import { decodeQrFromImage } from './qr-decode.js';
import { ReceiptsService, type SubmitResult } from './receipts.service.js';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/** Botga yuborilgan chek rasmi (zaxira 1) va matn ko'rinishidagi QR havola. */
@Injectable()
export class ReceiptsBotHandlers implements OnModuleInit {
  private readonly log = new Logger(ReceiptsBotHandlers.name);

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly botService: BotService,
    private readonly receipts: ReceiptsService,
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
            return ctx.reply("Chekning rasmini yuboring (JPG yoki PNG).");
          }

          await ctx.replyWithChatAction('typing').catch(() => undefined);
          let text: string | null = null;
          try {
            const buf = await this.download(fileId);
            text = await decodeQrFromImage(buf);
          } catch (e) {
            this.log.error(`Rasm yuklab olinmadi/o'qilmadi: ${(e as Error).message}`);
          }
          const res = await this.receipts.submit({ participant: p, text, source: 'PHOTO', photoFileId: fileId });
          return this.replyResult(ctx, res);
        }),
      );

      // Foydalanuvchi QR havolasini matn qilib yuborsa (masalan, boshqa ilova bilan skanerlab)
      pm.hears(/ofd\.soliq\.uz\/\S+/i, (ctx) =>
        this.botService.withParticipant(ctx, async (p) => {
          const url = ctx.message!.text!.match(/https?:\/\/\S*ofd\.soliq\.uz\/\S+/i)?.[0] ?? ctx.message!.text!;
          const res = await this.receipts.submit({ participant: p, text: url, source: 'QR' });
          return this.replyResult(ctx, res);
        }),
      );
    });
  }

  private replyResult(ctx: Context, res: SubmitResult) {
    return ctx.reply(res.message);
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
