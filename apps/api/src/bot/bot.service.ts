import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot, Context, InlineKeyboard, Keyboard } from 'grammy';

import { CampaignService } from '../campaign/campaign.service.js';
import type { Participant } from '@prisma/client';

import { config, isHttps } from '../config.js';
import { isRegistered, ParticipantsService, rulesVersionOf } from '../participants/participants.service.js';
import { BOT } from '../telegram/bot.token.js';
import { BTN, T } from './texts.js';
import { parseVoucherToken } from '../core/voucher-token.js';
import { VouchersService } from '../vouchers/vouchers.service.js';
import { redeemMessage } from '../vouchers/voucher-texts.js';

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(BotService.name);
  private readonly extraHandlers: Array<(bot: Bot) => void> = [];

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly participants: ParticipantsService,
    private readonly vouchers: VouchersService,
    private readonly campaigns: CampaignService,
  ) {}

  /** Vaucher QR'ini qo'llaydi va natijani yozadi. */
  async redeemAndReply(ctx: Context, p: Participant, token: string) {
    const res = await this.vouchers.redeem(p, token);
    return ctx.reply(redeemMessage(res), { parse_mode: 'HTML' });
  }

  /** Boshqa modullar (chek qo'shish) o'z handler'larini shu orqali ulaydi. */
  addHandlers(fn: (bot: Bot) => void) {
    this.extraHandlers.push(fn);
  }

  /** Versiya parametri — har deploy'da yangi URL, Telegram WebView eski keshni ochmaydi. */
  get miniAppUrl() {
    return `${config().PUBLIC_URL}/miniapp?v=${process.env.GIT_SHA ?? 'dev'}`;
  }

  get rulesUrl() {
    return `${config().PUBLIC_URL}/rules`;
  }

  /** Bosh xabar ostidagi inline tugmalar (doimiy klaviatura yo'q). */
  homeKeyboard(p: Participant) {
    // "Chek qo'shish" — pastdagi menyu tugmasida doim turadi, bu yerda takrorlanmaydi
    const kb = new InlineKeyboard();
    const ref = `https://t.me/${config().BOT_USERNAME}?start=ref_${p.refCode}`;
    kb.url(BTN.invite, `https://t.me/share/url?url=${encodeURIComponent(ref)}&text=${encodeURIComponent(T.inviteShare)}`);
    kb.text(BTN.contact, 'contact');
    return kb;
  }

  /**
   * Bosh xabar. Eski doimiy klaviaturani olib tashlash uchun remove_keyboard bilan
   * vaqtinchalik xabar yuborib, darhol o'chiramiz (inline tugmali xabar buni qila olmaydi).
   */
  async sendHome(ctx: Context, p: Participant) {
    const tmp = await ctx.reply('…', { reply_markup: { remove_keyboard: true } }).catch(() => null);
    if (tmp) await ctx.api.deleteMessage(tmp.chat.id, tmp.message_id).catch(() => undefined);
    const home = await ctx.reply(T.home(ctx.from?.first_name), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: this.homeKeyboard(p),
    });
    // Ro'yxatdan o'tmasdan skanerlangan QR — endi qo'llanadi
    const pending = await this.participants.takePendingVoucher(p.id);
    if (pending) await this.redeemAndReply(ctx, p, pending);
    return home;
  }

  async onApplicationBootstrap() {
    const mode = config().BOT_MODE;
    this.register();
    if (mode === 'off') return;
    try {
      await this.bot.init();
    } catch (e) {
      this.log.error(`Bot init xatosi (token?): ${(e as Error).message}`);
      return;
    }
    await this.setupCommands();

    if (mode === 'polling') {
      // Webhook'ni o'chiradi! Prod bot ishlab turganda lokal polling ishga tushirmang.
      void this.bot.start({
        drop_pending_updates: false,
        allowed_updates: ['message', 'callback_query', 'my_chat_member'],
        onStart: (me) => this.log.log(`Bot @${me.username} polling rejimida`),
      });
    } else {
      const url = `${config().PUBLIC_URL}/api/tg/webhook`;
      // Xato API'ni yiqitmasin (masalan, SSL hali tayyor emas) — keyingi restartda qayta urinadi
      try {
        await this.bot.api.setWebhook(url, {
          secret_token: config().BOT_WEBHOOK_SECRET,
          allowed_updates: ['message', 'callback_query', 'my_chat_member'],
          max_connections: 40,
        });
        this.log.log(`Webhook o'rnatildi: ${url}`);
      } catch (e) {
        this.log.error(`Webhook o'rnatilmadi: ${(e as Error).message}`);
      }
    }
  }

  async onApplicationShutdown() {
    if (this.bot.isRunning()) await this.bot.stop();
  }

  private async setupCommands() {
    try {
      await this.bot.api.setMyCommands([{ command: 'start', description: 'Boshlash / menyu' }]);
      if (isHttps()) {
        await this.bot.api.setChatMenuButton({
          menu_button: { type: 'web_app', text: 'Skaner', web_app: { url: this.miniAppUrl } },
        });
      }
    } catch (e) {
      this.log.warn(`Bot sozlamalari o'rnatilmadi: ${(e as Error).message}`);
    }
  }

  private register() {
    const bot = this.bot;

    bot.catch((err) => {
      this.log.error(`Bot xatosi (update ${err.ctx.update.update_id}): ${err.error instanceof Error ? err.error.stack : String(err.error)}`);
    });

    // Guruhlarda faqat /chatid ishlaydi (admin alert guruhini sozlash uchun)
    bot.chatType(['group', 'supergroup']).command('chatid', (ctx) => ctx.reply(`Chat ID: <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' }));

    const pm = bot.chatType('private');

    pm.command('start', async (ctx) => {
      const token = parseVoucherToken(ctx.match);
      const p = await this.participants.startOrGet(ctx.from, ctx.match);
      if (p.isBlocked) return ctx.reply(T.blocked);
      const pending = token ?? p.pendingVoucher;
      if (isRegistered(p)) return token ? this.redeemAndReply(ctx, p, token) : this.sendHome(ctx, p);
      // Ro'yxatdan o'tmagan: QR saqlanadi, bitta xabarda raqam so'raladi (rozilik — shu yerda)
      if (token) await this.participants.setPendingVoucher(ctx.from.id, token);
      return this.askPhone(ctx, pending ? await this.vouchers.peek(pending) : null);
    });

    pm.on('message:contact', async (ctx) => {
      const contact = ctx.message.contact;
      if (!contact.user_id || contact.user_id !== ctx.from.id) {
        return ctx.reply(T.notOwnPhone, { reply_markup: this.phoneKeyboard() });
      }
      await this.participants.startOrGet(ctx.from);
      const res = await this.participants.savePhone(ctx.from.id, contact.phone_number);
      if (!res.ok) {
        const text = res.error === 'INVALID_PHONE' ? T.invalidPhone : T.phoneTaken(config().SUPPORT_CONTACT);
        return ctx.reply(text, { parse_mode: 'HTML' });
      }
      // Raqam yuborildi — rozilik shu bilan berildi (xabarda qoidalar havolasi bor edi)
      const p = res.participant.rulesAcceptedAt ? res.participant : await this.acceptRules(ctx.from.id);
      return this.sendHome(ctx, p);
    });

    // Eski xabarlardagi "Roziman" tugmasi (yangi oqimda yo'q) — ishlashda davom etadi
    bot.callbackQuery('rules:accept', async (ctx) => {
      const p = await this.participants.findByTgId(ctx.from.id);
      if (!p?.phone) {
        await ctx.answerCallbackQuery();
        return this.askPhone(ctx, null);
      }
      const accepted = p.rulesAcceptedAt ? p : await this.acceptRules(ctx.from.id);
      await ctx.answerCallbackQuery({ text: '✅' });
      await ctx.editMessageReplyMarkup().catch(() => undefined);
      return this.sendHome(ctx, accepted);
    });

    bot.callbackQuery('contact', async (ctx) => {
      await ctx.answerCallbackQuery();
      return ctx.reply(T.contact(config().SUPPORT_CONTACT), { parse_mode: 'HTML' });
    });

    // Diqqat: grammY composer'i chaqirilgan joyida zanjirga qo'shiladi. Menyu va
    // catch-all boshqa modullar handler'laridan KEYIN turishi uchun yangi composer.
    for (const fn of this.extraHandlers) fn(bot);
    const menu = bot.chatType('private');

    // Eski klaviatura tugmalari va istalgan matn — bosh xabar (klaviatura olib tashlanadi)
    menu.on('message', async (ctx) => {
      const p = await this.participants.findByTgId(ctx.from.id);
      if (!isRegistered(p)) return ctx.reply(T.needRegister, { reply_markup: { remove_keyboard: true } });
      if (p.isBlocked) return ctx.reply(T.blocked);
      return this.sendHome(ctx, p);
    });
  }

  private phoneKeyboard() {
    return new Keyboard().requestContact(BTN.sendPhone).resized().oneTime();
  }

  private askPhone(ctx: Context, waitingCoupons: number | null) {
    return ctx.reply(T.welcome(ctx.from?.first_name, this.rulesUrl, waitingCoupons), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: this.phoneKeyboard(),
    });
  }

  private async acceptRules(tgId: number) {
    const campaign = await this.campaigns.getActive();
    return this.participants.acceptRules(tgId, campaign ? rulesVersionOf(campaign.rulesText) : null);
  }

  /** Ro'yxatdan o'tgan va bloklanmagan ishtirokchi uchun ishlaydi. */
  async withParticipant(ctx: Context, fn: (p: Participant) => unknown) {
    const p = await this.participants.findByTgId(ctx.from!.id);
    if (!isRegistered(p)) return ctx.reply(T.needRegister, { reply_markup: { remove_keyboard: true } });
    if (p.isBlocked) return ctx.reply(T.blocked);
    return fn(p);
  }
}
