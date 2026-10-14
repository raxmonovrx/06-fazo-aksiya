'use client';

/**
 * Fazo Club mini app — bitta kompakt ekran, sahifa scroll bo'lmaydi.
 *   yuqorida: kuponlar soni + "Qoidalar"
 *   o'rtada:  cheklar ro'yxati (faqat ro'yxat ichida suriladi)
 *   pastda:   Telegram MainButton — "QR'ni skanerlash"
 * Qoidalar va skaner natijasi — Vaul drawer (surib yopiladi). Ranglar Telegram mavzusidan.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'vaul';

import { fmtShort } from '@/lib/format';

interface ReceiptRow {
  id: number;
  status: string;
  fiscalAt: string | null;
  amount: string | null;
  couponsCount: number;
  rejectReason: string | null;
  source: string;
  createdAt: string;
  branch: { name: string } | null;
}

interface Me {
  coupons: number;
  receipts: ReceiptRow[];
  campaign: { receiptWindowHours: number } | null;
  rules: { couponPrice: number | null; minSum: number | null };
  isStaff: boolean;
}

/** POST /api/miniapp/receipts — kassir bergan vaucher QR'i natijasi */
interface SubmitResult {
  code: string;
  message?: string;
  couponsCount?: number;
  amount?: number;
  branchName?: string;
  totalCoupons?: number;
  isStaff?: boolean;
}

type Tone = 'ok' | 'warn' | 'err';
interface Sheet {
  tone: Tone;
  title: string;
  body: string;
  /** MainButton drawer ochiqligida: true — "Boshqa chek" (skaner), aks holda "Yaxshi" (yopish) */
  rescan?: boolean;
}

const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'FazoClub_bot';
const BRAND = '#C8102E';
const PENDING = new Set(['PENDING', 'NEEDS_REVIEW', 'NOT_FOUND']);
const NO_SCANNER = new Set(['tdesktop', 'macos', 'web', 'weba', 'webk', 'unknown']);
const MOBILE = new Set(['ios', 'android', 'android_x']);
const ANDROID = new Set(['android', 'android_x']);

const sum = (n: number | string) => Math.round(Number(n)).toLocaleString('ru-RU').replace(/ /g, ' ');

export default function MiniApp() {
  const [tg, setTg] = useState<TgWebApp | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [state, setState] = useState<'loading' | 'outside' | 'unregistered' | 'offline' | 'ready'>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<Sheet | 'rules' | null>(null);
  // Drawer yopilish animatsiyasi davomida kontent yo'qolmasin — oxirgisini ushlab turamiz
  const [shown, setShown] = useState<Sheet | 'rules' | null>(null);
  useEffect(() => {
    if (sheet) setShown(sheet);
  }, [sheet]);
  const rootRef = useRef<HTMLDivElement>(null);

  const api = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`/api/miniapp${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', authorization: `tma ${tg?.initData ?? ''}`, ...init?.headers },
      }),
    [tg],
  );

  const load = useCallback(async () => {
    try {
      const res = await api('/me');
      if (res.status === 403 || res.status === 401) return setState('unregistered');
      if (!res.ok) return setState((s) => (s === 'ready' ? s : 'offline'));
      setMe(await res.json());
      setState('ready');
    } catch {
      setState((s) => (s === 'ready' ? s : 'offline'));
    }
  }, [api]);

  // ── Telegram sozlamalari ───────────────────────────────────────────────
  useEffect(() => {
    const w = window.Telegram?.WebApp;
    if (!w?.initData) return setState('outside');
    w.ready();
    w.expand();
    if (w.isVersionAtLeast('7.7')) w.disableVerticalSwipes?.(); // pastga tortib yopilmasin
    // X bosilganda Telegram "Yopilsinmi?" deb so'raydi (6.2+)
    if (w.isVersionAtLeast('6.2')) w.enableClosingConfirmation();
    if (w.isVersionAtLeast('8.0')) {
      w.lockOrientation?.();
      if (MOBILE.has(w.platform) && !w.isFullscreen) w.requestFullscreen?.();
    }
    if (w.isVersionAtLeast('6.1')) {
      w.setHeaderColor('bg_color');
      w.setBackgroundColor('bg_color');
    }
    if (w.isVersionAtLeast('7.10')) w.setBottomBarColor?.('bg_color');
    const onTheme = () => setScheme(w.colorScheme);
    onTheme();
    w.onEvent('themeChanged', onTheme);
    setTg(w);
    return () => w.offEvent('themeChanged', onTheme);
  }, []);

  useEffect(() => {
    if (!tg) return;
    void load();
    const onActive = () => void load(); // ilovaga qaytilganda (8.0+)
    tg.onEvent('activated', onActive);
    return () => tg.offEvent('activated', onActive);
  }, [tg, load]);

  const toBot = useCallback(() => tg?.openTelegramLink(`https://t.me/${BOT}`), [tg]);
  const hours = me?.campaign?.receiptWindowHours ?? 72;

  const submit = useCallback(
    async (text: string) => {
      setBusy(true);
      let res: SubmitResult;
      try {
        const r = await api('/receipts', { method: 'POST', body: JSON.stringify({ text }) });
        res = r.ok ? await r.json() : { code: 'ERROR', message: "Qayta urinib ko'ring." };
      } catch {
        res = { code: 'OFFLINE', message: "Internetni tekshirib, qayta urinib ko'ring." };
      }
      setBusy(false);
      const s = sheetFor(res, hours);
      setSheet(s);
      tg?.HapticFeedback?.notificationOccurred(s.tone === 'ok' ? 'success' : s.tone === 'err' ? 'error' : 'warning');
      void load();
    },
    [api, load, tg, hours],
  );

  const canScan = useMemo(() => Boolean(tg?.isVersionAtLeast('6.4') && !NO_SCANNER.has(tg.platform)), [tg]);

  const scan = useCallback(() => {
    if (!tg || busy) return;
    setSheet(null);
    if (!canScan) {
      tg.showAlert("QR skaner faqat telefondagi Telegram'da ishlaydi. Kassir bergan QR'ni telefon kamerasi bilan skanerlang.");
      return;
    }
    // Skaner bir QR'ni ketma-ket bir necha marta yuborishi mumkin — faqat birinchisi
    let done = false;
    tg.showScanQrPopup({ text: "Kassir bergan Fazo Club QR'ini skanerlang" }, (text) => {
      if (done) return true;
      // Bizning QR (t.me/<bot>?start=v_…) yoki soliq cheki QR'i (tushuntirish uchun) — boshqasi e'tiborsiz
      if (!/start=v_|ofd\.soliq\.uz/i.test(text)) {
        tg.HapticFeedback?.notificationOccurred('warning');
        return false; // begona QR — skaner ochiq qoladi
      }
      done = true;
      void submit(text);
      return true;
    });
  }, [tg, busy, canScan, submit]);

  // MainButton — ilovadagi yagona asosiy tugma (o'lcham/rang 1:1 native). Drawer ochiqligida
  // uning matni va harakati almashadi: "Tushunarli" / "Yaxshi" / "Boshqa chek".
  useEffect(() => {
    if (!tg) return;
    const mb = tg.MainButton;
    if (state !== 'ready') {
      mb.hide();
      return;
    }
    const close = () => setSheet(null);
    let text = "QR'ni skanerlash";
    let action: () => void = scan;
    if (sheet === 'rules') [text, action] = ['Tushunarli', close];
    else if (sheet) [text, action] = sheet.rescan ? ['Boshqa chek', scan] : ['Yaxshi', close];
    mb.setParams({ text, color: BRAND, text_color: '#FFFFFF', is_active: !busy });
    mb.show();
    if (busy) mb.showProgress(false);
    else mb.hideProgress();
    mb.onClick(action);
    // Telegram Android tugmani bir qadam kechikib chizadi (oldingi holatni ko'rsatadi) —
    // xuddi shu holatni qisqa pauzadan keyin yana yuboramiz, shunda to'g'ri matn chiziladi
    let repost: ReturnType<typeof setTimeout> | undefined;
    if (ANDROID.has(tg.platform)) {
      repost = setTimeout(() => {
        window.Telegram?.WebView?.postEvent('web_app_setup_main_button', false, {
          is_visible: true,
          is_active: !busy,
          is_progress_visible: busy,
          text,
          color: BRAND.toLowerCase(),
          text_color: '#ffffff',
          has_shine_effect: false,
        });
      }, 60);
    }
    return () => {
      clearTimeout(repost);
      mb.offClick(action);
    };
  }, [tg, state, sheet, busy, scan]);

  // "Chek rasmini botga yuborish": bot chatga yo'riqnoma, keyin mini app yopiladi (chatga qaytadi)
  const photoToBot = useCallback(async () => {
    tg?.HapticFeedback?.impactOccurred('light');
    await api('/photo-hint', { method: 'POST' }).catch(() => undefined);
    tg?.close();
  }, [api, tg]);

  // BackButton — faqat oyna ochiq bo'lganda, uni yopadi
  useEffect(() => {
    if (!tg?.isVersionAtLeast('6.1')) return;
    const back = () => setSheet(null);
    if (sheet) tg.BackButton.show();
    else tg.BackButton.hide();
    tg.BackButton.onClick(back);
    return () => tg.BackButton.offClick(back);
  }, [tg, sheet]);



  // ── Holatlar ───────────────────────────────────────────────────────────
  const root = (children: React.ReactNode) => (
    <div className="fc" data-scheme={scheme} ref={rootRef}>
      {children}
    </div>
  );

  if (state === 'loading') return root(<div className="center"><Spinner /></div>);
  if (state !== 'ready' || !me) {
    const s = {
      outside: { title: 'Telegram orqali oching', body: 'Bu sahifa Fazo Club botida ishlaydi.', btn: "Botga o'tish", on: () => (window.location.href = `https://t.me/${BOT}`) },
      unregistered: { title: "Avval ro'yxatdan o'ting", body: "Botda telefon raqamingizni yuboring va qoidalarga rozilik bering.", btn: "Botga o'tish", on: toBot },
      offline: { title: "Internet aloqasi yo'q", body: "Ulanishni tekshirib, qayta urinib ko'ring.", btn: 'Qayta urinish', on: () => { setState('loading'); void load(); } },
    }[state as 'outside' | 'unregistered' | 'offline'];
    return root(
      <div className="center">
        <h1 className="t-title">{s.title}</h1>
        <p className="t-sub c-sub">{s.body}</p>
        <button className="btn-text" onClick={s.on}>{s.btn}</button>
      </div>,
    );
  }

  const pending = me.receipts.filter((r) => PENDING.has(r.status)).length;
  const caption = me.isStaff
    ? "Xodimlar o'yinda qatnashmaydi"
    : pending > 0
      ? `${pending} ta chek tekshirilmoqda`
      : "Kassir bergan QR'ni skanerlang — kupon darhol qo'shiladi";

  return root(
    <>
      <header className="top">
        <div>
          <p className="count">
            <span className="count-n">{me.coupons}</span> kupon
          </p>
          <p className="t-foot c-sub">{caption}</p>
        </div>
        <button className="btn-chip" onClick={() => setSheet('rules')}>Qoidalar</button>
      </header>

      <h2 className="list-title">Cheklarim</h2>
      <div className="list">
        {me.receipts.length === 0 ? (
          <div className="empty">
            <p className="t-body">Hali chek yo&apos;q</p>
            <p className="t-foot c-sub">To'lovdan keyin kassirdan Fazo Club QR'ini so'rang</p>
          </div>
        ) : (
          me.receipts.map((r) => <Row key={r.id} r={r} />)
        )}
      </div>

      <Drawer.Root open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <Drawer.Portal container={rootRef.current}>
          <Drawer.Overlay className="overlay" />
          <Drawer.Content className="sheet" aria-describedby={undefined}>
            <Drawer.Handle className="handle" />
            {shown === 'rules' ? (
              <RulesSheet hours={hours} rules={me.rules} onBot={() => void photoToBot()} />
            ) : shown ? (
              <SheetView sheet={shown} />
            ) : null}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>,
  );
}

// ── Ro'yxat qatori ─────────────────────────────────────────────────────────

function Row({ r }: { r: ReceiptRow }) {
  const name = r.branch?.name ?? (r.source === 'PHOTO' ? 'Chek rasmi' : 'Chek');
  const meta = [fmtShort(r.fiscalAt ?? r.createdAt), r.amount && !PENDING.has(r.status) ? `${sum(r.amount)} so'm` : null]
    .filter(Boolean)
    .join(' · ');
  let right: React.ReactNode;
  if (r.status === 'APPROVED') right = <span className="c-brand t-body-sb">+{r.couponsCount}</span>;
  else if (PENDING.has(r.status)) right = <span className="c-warn t-foot">Tekshiruvda</span>;
  else if (r.status === 'BELOW_MIN') right = <span className="c-sub t-foot">Summa kam</span>;
  else right = <span className="c-err t-foot">Rad etildi</span>;
  return (
    <div className="row">
      <div className="row-main">
        <p className="t-body ellipsis">{name}</p>
        <p className="t-foot c-sub ellipsis">
          {meta}
          {r.status === 'REJECTED' && r.rejectReason && ` · ${r.rejectReason}`}
        </p>
      </div>
      {right}
    </div>
  );
}

// ── Oynalar ────────────────────────────────────────────────────────────────

function sheetFor(res: SubmitResult, hours: number): Sheet {
  const where = [res.branchName, res.amount != null ? `${sum(res.amount)} so'm` : null].filter(Boolean).join(' · ');
  switch (res.code) {
    case 'REDEEMED':
      return {
        tone: 'ok',
        title: `+${res.couponsCount} kupon`,
        body: res.isStaff ? `${where}. Fazo xodimlari o'yinda qatnashmaydi.` : `${where}. Jami: ${res.totalCoupons} ta kupon`,
      };
    case 'ALREADY_YOURS':
      return { tone: 'warn', title: "Bu QR'ni ishlatgansiz", body: 'Har bir QR faqat bir marta hisoblanadi.' };
    case 'USED':
      return { tone: 'err', title: 'QR allaqachon ishlatilgan', body: 'Har bir QR faqat bir marta hisoblanadi.', rescan: true };
    case 'EXPIRED':
      return { tone: 'err', title: "QR muddati o'tgan", body: `QR ${hours} soat amal qiladi. Kassirga murojaat qiling.` };
    case 'CANCELLED':
      return { tone: 'err', title: 'QR bekor qilingan', body: 'Kassirga murojaat qiling.' };
    case 'FISCAL_DISABLED':
      return { tone: 'warn', title: 'Bu soliq cheki QR\'i', body: "Kupon uchun kassirdan Fazo Club QR'ini so'rang.", rescan: true };
    case 'INVALID':
      return { tone: 'err', title: 'QR yaroqsiz', body: "Kassir bergan Fazo Club QR'ini skanerlang.", rescan: true };
    case 'RATE_LIMIT':
      return { tone: 'warn', title: "Juda ko'p urinish", body: "Birozdan keyin qayta urinib ko'ring." };
    case 'NO_CAMPAIGN':
      return { tone: 'warn', title: "Faol aksiya yo'q", body: '' };
    case 'BLOCKED':
      return { tone: 'err', title: 'Akkaunt bloklangan', body: '' };
    case 'OFFLINE':
      return { tone: 'err', title: "Internet yo'q", body: res.message ?? '', rescan: true };
    default:
      return { tone: 'err', title: 'Xatolik', body: res.message ?? "Qayta urinib ko'ring.", rescan: true };
  }
}

function SheetView({ sheet }: { sheet: Sheet }) {
  return (
    <div className="sheet-body sheet-result">
      <div className={`mark tone-${sheet.tone}`}>{sheet.tone === 'ok' ? <IconCheck /> : sheet.tone === 'warn' ? <IconClock /> : <IconX />}</div>
      <Drawer.Title className="t-title">{sheet.title}</Drawer.Title>
      {sheet.body && <p className="t-sub c-sub">{sheet.body}</p>}
    </div>
  );
}

function RulesSheet({ hours, rules, onBot }: { hours: number; rules: Me['rules']; onBot: () => void }) {
  const items: Array<[React.ReactNode, string, string]> = [
    [<IconScan key="s" />, "Kassirdan QR oling", "To'lovdan keyin kassir Fazo Club QR'ini beradi"],
    [<IconTime key="t" />, `${hours} soat ichida skanerlang`, "Telefon kamerasi yoki shu yerdagi skaner bilan"],
    [
      <IconTicket key="k" />,
      rules.couponPrice ? `Har ${sum(rules.couponPrice)} so'm — 1 kupon` : 'Summaga qarab kupon',
      rules.minSum && rules.couponPrice && rules.minSum > rules.couponPrice
        ? `Chek kamida ${sum(rules.minSum)} so'm. Kupon darhol qo'shiladi`
        : "Skanerlashingiz bilan kupon qo'shiladi",
    ],
    [<IconGift key="g" />, 'Sovrinlar', "Har oy sovg'alar, yil oxirida avtomobil"],
  ];
  return (
    <div className="sheet-body">
      <Drawer.Title className="sheet-title">Qoidalar</Drawer.Title>
      <ul className="info-list">
        {items.map(([icon, title, desc]) => (
          <li key={title} className="info-row">
            <span className="info-icon">{icon}</span>
            <span className="info-text">
              <span className="t-body-sb">{title}</span>
              <span className="t-foot c-sub">{desc}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="link-rows">
        <a className="link-row" href="/rules" target="_blank">
          <span>To&apos;liq qoidalar</span>
          <IconExternal />
        </a>
      </div>
    </div>
  );
}

// ── Ikonkalar ──────────────────────────────────────────────────────────────

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IconCheck = () => <Svg><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
const IconClock = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
const IconX = () => <Svg><path d="M7 7l10 10M17 7L7 17" /></Svg>;
const Small = ({ children, size = 18 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IconScan = () => <Small><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 12h8" /></Small>;
const IconTime = () => <Small><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Small>;
const IconTicket = () => <Small><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2z" /><path d="M14 6v12" strokeDasharray="2 2" /></Small>;
const IconGift = () => <Small><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></Small>;
const IconChevron = () => <span className="c-hint"><Small size={16}><path d="M9 6l6 6-6 6" /></Small></span>;
const IconExternal = () => <span className="c-hint"><Small size={16}><path d="M7 17L17 7M9 7h8v8" /></Small></span>;
const Spinner = () => (
  <svg className="spin" width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" aria-label="Yuklanmoqda">
    <circle cx="12" cy="12" r="9" stroke="var(--line)" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--hint)" />
  </svg>
);
