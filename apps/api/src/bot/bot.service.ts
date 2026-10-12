import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot, Context, InlineKeyboard, Keyboard } from 'grammy';
import type { Participant } from '@prisma/client';

import { config, isHttps } from '../config.js';
import { isRegistered, ParticipantsService } from '../participants/participants.service.js';
import { BOT } from '../telegram/bot.token.js';
import { BTN, T } from './texts.js';

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(BotService.name);
  private readonly extraHandlers: Array<(bot: Bot) => void> = [];

  constructor(
    @Inject(BOT) private readonly bot: Bot,
    private readonly participants: ParticipantsService,
  ) {}

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
    const kb = new InlineKeyboard();
    if (isHttps()) kb.webApp(BTN.addReceipt, this.miniAppUrl).row();
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
    return ctx.reply(T.home(ctx.from?.first_name), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: this.homeKeyboard(p),
    });
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
          menu_button: { type: 'web_app', text: 'Chek qo\'shish', web_app: { url: this.miniAppUrl } },
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
      const p = await this.participants.startOrGet(ctx.from, ctx.match);
      if (p.isBlocked) return ctx.reply(T.blocked);
      if (!p.phone) {
        return ctx.reply(T.welcome(ctx.from.first_name), {
          parse_mode: 'HTML',
          reply_markup: this.phoneKeyboard(),
        });
      }
      if (!p.rulesAcceptedAt) return this.askRules(ctx);
      return this.sendHome(ctx, p);
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
      if (res.participant.rulesAcceptedAt) return this.sendHome(ctx, res.participant);
      return this.askRules(ctx);
    });

    bot.callbackQuery('rules:accept', async (ctx) => {
      const p = await this.participants.findByTgId(ctx.from.id);
      if (!p?.phone) {
        await ctx.answerCallbackQuery();
        return ctx.reply(T.askPhone, { reply_markup: this.phoneKeyboard() });
      }
      const accepted = p.rulesAcceptedAt ? p : await this.participants.acceptRules(ctx.from.id);
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

  private askRules(ctx: Context) {
    return ctx.reply(T.rulesPrompt(this.rulesUrl), {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: new InlineKeyboard().text(BTN.agree, 'rules:accept'),
    });
  }

  /** Ro'yxatdan o'tgan va bloklanmagan ishtirokchi uchun ishlaydi. */
  async withParticipant(ctx: Context, fn: (p: Participant) => unknown) {
    const p = await this.participants.findByTgId(ctx.from!.id);
    if (!isRegistered(p)) return ctx.reply(T.needRegister, { reply_markup: { remove_keyboard: true } });
    if (p.isBlocked) return ctx.reply(T.blocked);
    return fn(p);
  }
}
