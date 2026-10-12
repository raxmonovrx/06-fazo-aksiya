import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot, Context, InlineKeyboard, Keyboard } from 'grammy';
import type { Participant } from '@prisma/client';

import { config, isHttps } from '../config.js';
import { CampaignService } from '../campaign/campaign.service.js';
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
    private readonly campaigns: CampaignService,
  ) {}

  /** Boshqa modullar (chek qo'shish) o'z handler'larini shu orqali ulaydi. */
  addHandlers(fn: (bot: Bot) => void) {
    this.extraHandlers.push(fn);
  }

  get miniAppUrl() {
    return `${config().PUBLIC_URL}/miniapp`;
  }

  get rulesUrl() {
    return `${config().PUBLIC_URL}/rules`;
  }

  mainMenu() {
    return new Keyboard()
      .text(BTN.addReceipt)
      .text(BTN.myCoupons)
      .row()
      .text(BTN.rules)
      .text(BTN.invite)
      .row()
      .text(BTN.contact)
      .resized()
      .persistent();
  }

  /** Mini app faqat HTTPS bilan ochiladi; lokal dev'da tugma ko'rsatilmaydi. */
  scanKeyboard(): InlineKeyboard | undefined {
    if (!isHttps()) return undefined;
    return new InlineKeyboard().webApp(BTN.scan, this.miniAppUrl);
  }

  async onApplicationBootstrap() {
    const mode = config().BOT_MODE;
    this.register();
    if (mode === 'off') return;
    await this.bot.init();
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
      await this.bot.api.setWebhook(url, {
        secret_token: config().BOT_WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query', 'my_chat_member'],
        max_connections: 40,
      });
      this.log.log(`Webhook o'rnatildi: ${url}`);
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
      return ctx.reply(T.registered, { parse_mode: 'HTML', reply_markup: this.mainMenu() });
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
      if (res.participant.rulesAcceptedAt) {
        return ctx.reply(T.registered, { parse_mode: 'HTML', reply_markup: this.mainMenu() });
      }
      return this.askRules(ctx);
    });

    bot.callbackQuery('rules:accept', async (ctx) => {
      const p = await this.participants.findByTgId(ctx.from.id);
      if (!p?.phone) {
        await ctx.answerCallbackQuery();
        return ctx.reply(T.askPhone, { reply_markup: this.phoneKeyboard() });
      }
      if (!p.rulesAcceptedAt) await this.participants.acceptRules(ctx.from.id);
      await ctx.answerCallbackQuery({ text: '✅' });
      await ctx.editMessageReplyMarkup().catch(() => undefined);
      return ctx.reply(T.registered, { parse_mode: 'HTML', reply_markup: this.mainMenu() });
    });

    for (const fn of this.extraHandlers) fn(bot);

    pm.hears(BTN.addReceipt, (ctx) =>
      this.withParticipant(ctx, () =>
        ctx.reply(T.addReceipt(isHttps()), { parse_mode: 'HTML', reply_markup: this.scanKeyboard() }),
      ),
    );

    pm.hears(BTN.myCoupons, (ctx) =>
      this.withParticipant(ctx, async (p) => {
        const s = await this.participants.summary(p.id);
        const pending = (s.receipts.PENDING ?? 0) + (s.receipts.NEEDS_REVIEW ?? 0) + (s.receipts.NOT_FOUND ?? 0);
        const kb = isHttps()
          ? new InlineKeyboard().webApp(BTN.openApp, `${this.miniAppUrl}?tab=coupons`)
          : undefined;
        return ctx.reply(T.coupons(s.coupons, pending, s.receipts.APPROVED ?? 0), {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
      }),
    );

    pm.hears(BTN.rules, async (ctx) => {
      const c = await this.campaigns.getActive();
      return ctx.reply(T.rulesShort(this.rulesUrl, c?.rulesText ?? ''), {
        link_preview_options: { is_disabled: true },
      });
    });

    pm.hears(BTN.invite, (ctx) =>
      this.withParticipant(ctx, (p) =>
        ctx.reply(T.invite(`https://t.me/${config().BOT_USERNAME}?start=ref_${p.refCode}`), {
          link_preview_options: { is_disabled: true },
        }),
      ),
    );

    pm.hears(BTN.contact, (ctx) => ctx.reply(T.contact(config().SUPPORT_CONTACT)));

    pm.on('message', async (ctx) => {
      const p = await this.participants.findByTgId(ctx.from.id);
      if (!isRegistered(p)) return ctx.reply(T.needRegister);
      return ctx.reply(T.unknown, { reply_markup: this.mainMenu() });
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
