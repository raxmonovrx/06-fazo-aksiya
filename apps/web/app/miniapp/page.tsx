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

interface SubmitResult {
  code: string;
  message: string;
  receipt?: { status: string; fiscalAt: string | null; branchName: string | null; amount: number | null; couponsCount: number };
}

type Tone = 'ok' | 'warn' | 'err';
interface Sheet {
  tone: Tone;
  title: string;
  body: string;
  primary: string;
  rescan?: boolean;
}

const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'FazoClub_bot';
const BRAND = '#C8102E';
const PENDING = new Set(['PENDING', 'NEEDS_REVIEW', 'NOT_FOUND']);
const NO_SCANNER = new Set(['tdesktop', 'macos', 'web', 'weba', 'webk', 'unknown']);
const MOBILE = new Set(['ios', 'android', 'android_x']);

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
      tg.showAlert("QR skaner faqat telefondagi Telegram'da ishlaydi. Chek rasmini botga yuboring.");
      return;
    }
    // Skaner bir QR'ni ketma-ket bir necha marta yuborishi mumkin — faqat birinchisi
    let done = false;
    tg.showScanQrPopup({ text: 'Chek pastidagi QR kodni skanerlang' }, (text) => {
      if (done) return true;
      if (!/ofd\.soliq\.uz/i.test(text)) {
        tg.HapticFeedback?.notificationOccurred('warning');
        return false; // fiskal QR emas — skaner ochiq qoladi
      }
      done = true;
      void submit(text);
      return true;
    });
  }, [tg, busy, canScan, submit]);

  // MainButton: oyna yopiq bo'lsa ko'rinadi; yuborilayotganda — yuklanish belgisi
  useEffect(() => {
    if (!tg) return;
    const mb = tg.MainButton;
    if (state === 'ready' && !sheet) {
      mb.setParams({ text: "QR'ni skanerlash", color: BRAND, text_color: '#FFFFFF', is_active: !busy });
      mb.show();
      if (busy) mb.showProgress(false);
      else mb.hideProgress();
    } else mb.hide();
    mb.onClick(scan);
    return () => mb.offClick(scan);
  }, [tg, state, sheet, busy, scan]);

  // BackButton — faqat oyna ochiq bo'lganda, uni yopadi
  useEffect(() => {
    if (!tg?.isVersionAtLeast('6.1')) return;
    const back = () => setSheet(null);
    if (sheet) tg.BackButton.show();
    else tg.BackButton.hide();
    tg.BackButton.onClick(back);
    return () => tg.BackButton.offClick(back);
  }, [tg, sheet]);

  useEffect(() => {
    if (!tg?.isVersionAtLeast('6.2')) return;
    if (busy) tg.enableClosingConfirmation();
    else tg.disableClosingConfirmation();
  }, [tg, busy]);

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
      : 'Kuponlar har kuni ertalab hisoblanadi';

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
            <p className="t-foot c-sub">Restoranda olingan chekdagi QR kodni skanerlang</p>
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
              <RulesSheet hours={hours} rules={me.rules} onClose={() => setSheet(null)} onBot={toBot} />
            ) : shown ? (
              <SheetView sheet={shown} onPrimary={() => (shown.rescan ? scan() : setSheet(null))} onClose={() => setSheet(null)} />
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
  const r = res.receipt;
  const where = [r?.branchName, r?.amount != null ? `${sum(r.amount)} so'm` : null].filter(Boolean).join(' · ');
  switch (res.code) {
    case 'ACCEPTED':
      if (r?.status === 'APPROVED' && r.couponsCount > 0)
        return { tone: 'ok', title: `+${r.couponsCount} kupon`, body: where, primary: 'Yaxshi' };
      if (r?.status === 'BELOW_MIN')
        return { tone: 'warn', title: 'Summa kam', body: `${where}. Kupon uchun summa yetarli emas.`, primary: 'Yaxshi' };
      return { tone: 'ok', title: 'Chek qabul qilindi', body: `${where ? `${where}. ` : ''}Kuponlar ertaga ertalab hisoblanadi.`, primary: 'Yaxshi' };
    case 'REVIEW':
      return { tone: 'warn', title: 'Tekshiruvga yuborildi', body: 'Natijasini botda xabar qilamiz.', primary: 'Yaxshi' };
    case 'ALREADY_YOURS':
      return { tone: 'warn', title: "Bu chek qo'shilgan", body: 'Bitta chek faqat bir marta hisoblanadi.', primary: 'Yaxshi' };
    case 'DUPLICATE':
      return { tone: 'err', title: "Bu chek allaqachon qo'shilgan", body: 'Bitta chek faqat bir marta hisoblanadi.', primary: 'Boshqa chek', rescan: true };
    case 'WINDOW_EXPIRED':
      return { tone: 'err', title: 'Chek eskirgan', body: `Faqat oxirgi ${hours} soatdagi cheklar qabul qilinadi.`, primary: 'Boshqa chek', rescan: true };
    case 'INVALID_QR':
      return { tone: 'err', title: 'Fiskal chek emas', body: 'Chek pastidagi soliq QR kodini skanerlang.', primary: 'Qayta skanerlash', rescan: true };
    case 'RATE_LIMIT':
      return { tone: 'warn', title: "Juda ko'p urinish", body: "Birozdan keyin qayta urinib ko'ring.", primary: 'Yaxshi' };
    case 'OFFLINE':
      return { tone: 'err', title: "Internet yo'q", body: res.message, primary: 'Qayta skanerlash', rescan: true };
    default:
      return { tone: 'err', title: 'Chek qabul qilinmadi', body: res.message, primary: 'Yaxshi' };
  }
}

function SheetView({ sheet, onPrimary, onClose }: { sheet: Sheet; onPrimary: () => void; onClose: () => void }) {
  return (
    <div className="sheet-body">
      <div className={`mark tone-${sheet.tone}`}>{sheet.tone === 'ok' ? <IconCheck /> : sheet.tone === 'warn' ? <IconClock /> : <IconX />}</div>
      <Drawer.Title className="t-title">{sheet.title}</Drawer.Title>
      {sheet.body && <p className="t-sub c-sub">{sheet.body}</p>}
      <button className="btn" onClick={onPrimary}>{sheet.primary}</button>
      {sheet.rescan && <button className="btn-text" onClick={onClose}>Yopish</button>}
    </div>
  );
}

function RulesSheet({ hours, rules, onClose, onBot }: { hours: number; rules: Me['rules']; onClose: () => void; onBot: () => void }) {
  const coupon = rules.couponPrice
    ? `Har ${sum(rules.couponPrice)} so'm uchun 1 kupon${rules.minSum && rules.minSum > rules.couponPrice ? ` (chek kamida ${sum(rules.minSum)} so'm)` : ''}.`
    : "Kupon soni chek summasiga bog'liq.";
  return (
    <div className="sheet-body">
      <Drawer.Title className="t-title">Qoidalar</Drawer.Title>
      <ol className="rules">
        <li>Fazo filialida olingan chekdagi QR kodni skanerlang.</li>
        <li>Chekni {hours} soat ichida qo&apos;shing.</li>
        <li>{coupon} Kuponlar har kuni ertalab hisoblanadi.</li>
        <li>Har oy sovg&apos;alar, yil oxirida avtomobil o&apos;ynaladi.</li>
      </ol>
      <p className="t-foot c-sub">
        Skaner ishlamasa — chek rasmini <button className="inline-link" onClick={onBot}>botga yuboring</button>.{' '}
        <a className="c-link" href="/rules" target="_blank">To&apos;liq qoidalar</a>
      </p>
      <button className="btn" onClick={onClose}>Tushunarli</button>
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
const Spinner = () => (
  <svg className="spin" width="28" height="28" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" aria-label="Yuklanmoqda">
    <circle cx="12" cy="12" r="9" stroke="var(--line)" />
    <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--hint)" />
  </svg>
);
