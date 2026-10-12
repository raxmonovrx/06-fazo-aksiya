'use client';

/**
 * Fazo Club mini app — dizayn: "Fazo Club — Telegram Mini App" canvas, 1B varianti.
 * - Bosh ekran markazda; "Kuponlarim" va "Qoidalar" alohida ekran, orqaga — Telegram BackButton.
 * - Asosiy harakat — Telegram MainButton ("QR'ni skanerlash"); o'z app bar / tab bar yo'q.
 * - Ranglar Telegram mavzusidan (--tg-theme-*), ilovaning o'zi — --fc-* (globals.css).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fmtDate, fmtShort } from '@/lib/format';

type View = 'home' | 'coupons' | 'rules';
type Tone = 'ok' | 'warn' | 'info' | 'err';

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
  participant: { firstName: string | null; refCode: string };
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

const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'FazoClub_bot';
const BRAND = '#C8102E';
const PENDING = new Set(['PENDING', 'NEEDS_REVIEW', 'NOT_FOUND']);
const NO_SCANNER = new Set(['tdesktop', 'macos', 'web', 'weba', 'webk', 'unknown']);
const MOBILE = new Set(['ios', 'android', 'android_x']);

const BADGE: Record<string, { label: string; tone: 'warn' | 'ok' | 'gray' | 'err' }> = {
  PENDING: { label: 'Tekshirilmoqda', tone: 'warn' },
  NEEDS_REVIEW: { label: 'Tekshirilmoqda', tone: 'warn' },
  NOT_FOUND: { label: 'Tekshirilmoqda', tone: 'warn' },
  APPROVED: { label: 'Tasdiqlandi', tone: 'ok' },
  BELOW_MIN: { label: 'Summa kam', tone: 'gray' },
  REJECTED: { label: 'Rad etildi', tone: 'err' },
};

const sum = (n: number | string) => `${Math.round(Number(n)).toLocaleString('ru-RU').replace(/ /g, ' ')}`;

export default function MiniApp() {
  const [tg, setTg] = useState<TgWebApp | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark'>('light');
  const [state, setState] = useState<'loading' | 'outside' | 'unregistered' | 'offline' | 'ready'>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<View>('home');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

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
    if (new URLSearchParams(window.location.search).get('tab') === 'coupons') setView('coupons');
    if (!w?.initData) return setState('outside');
    w.ready();
    w.expand();
    // Pastga tortganda ilova yopilib ketmasin (Bot API 7.7+)
    if (w.isVersionAtLeast('7.7')) w.disableVerticalSwipes?.();
    if (w.isVersionAtLeast('8.0')) {
      w.lockOrientation?.();
      // Fullscreen — faqat telefonda. Telegram tugmalari kontent ustida chiqadi,
      // shuning uchun joy --tg-safe-area-inset-* va --tg-content-safe-area-inset-* bilan qoldiriladi (globals.css)
      if (MOBILE.has(w.platform) && !w.isFullscreen) w.requestFullscreen?.();
    }
    if (w.isVersionAtLeast('6.1')) {
      w.setHeaderColor('secondary_bg_color');
      w.setBackgroundColor('secondary_bg_color');
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

  const go = useCallback(
    (v: View) => {
      tg?.HapticFeedback?.selectionChanged();
      setView(v);
      window.scrollTo({ top: 0 });
    },
    [tg],
  );

  const toBot = useCallback(() => tg?.openTelegramLink(`https://t.me/${BOT}`), [tg]);

  const submit = useCallback(
    async (text: string) => {
      setBusy(true);
      let body: SubmitResult;
      try {
        const res = await api('/receipts', { method: 'POST', body: JSON.stringify({ text }) });
        body = res.ok ? await res.json() : { code: 'ERROR', message: "Xatolik yuz berdi. Qayta urinib ko'ring." };
      } catch {
        body = { code: 'OFFLINE', message: "Ulanishni tekshirib, qayta urinib ko'ring." };
      }
      setBusy(false);
      setResult(body);
      const tone = sheetFor(body, me?.campaign?.receiptWindowHours ?? 72).tone;
      tg?.HapticFeedback?.notificationOccurred(tone === 'ok' ? 'success' : tone === 'err' ? 'error' : 'warning');
      void load();
    },
    [api, load, tg, me],
  );

  const canScan = useMemo(() => Boolean(tg?.isVersionAtLeast('6.4') && !NO_SCANNER.has(tg.platform)), [tg]);

  const scan = useCallback(() => {
    if (!tg || busy) return;
    setResult(null);
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

  // Telegram MainButton — faqat bosh ekranda, natija oynasi yopiq bo'lganda
  useEffect(() => {
    if (!tg) return;
    const mb = tg.MainButton;
    const visible = state === 'ready' && view === 'home' && !result && !busy;
    if (visible) {
      mb.setParams({ text: "QR'ni skanerlash", color: BRAND, text_color: '#FFFFFF', is_active: true });
      mb.show();
    } else mb.hide();
    mb.onClick(scan);
    return () => mb.offClick(scan);
  }, [tg, state, view, result, busy, scan]);

  // Telegram BackButton: natija oynasini yopadi yoki bosh ekranga qaytaradi
  useEffect(() => {
    if (!tg?.isVersionAtLeast('6.1')) return;
    const back = () => (result ? setResult(null) : go('home'));
    if (view !== 'home' || result) tg.BackButton.show();
    else tg.BackButton.hide();
    tg.BackButton.onClick(back);
    return () => tg.BackButton.offClick(back);
  }, [tg, view, result, go]);

  // Chek yuborilayotganda ilovani yopishdan oldin tasdiq so'raladi
  useEffect(() => {
    if (!tg?.isVersionAtLeast('6.2')) return;
    if (busy) tg.enableClosingConfirmation();
    else tg.disableClosingConfirmation();
  }, [tg, busy]);

  const invite = () => {
    if (!me) return;
    const link = `https://t.me/${BOT}?start=ref_${me.participant.refCode}`;
    const text = "Fazo'da ovqatlaning, chekdagi QR kodni skanerlang — oylik sovg'alar va yil oxirida avtomobil o'yini.";
    tg?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  };

  // ── Holatlar ───────────────────────────────────────────────────────────
  const root = (children: React.ReactNode, plain = false) => (
    <div className={`fc ${plain ? 'fc-plain' : ''}`} data-scheme={scheme}>
      {children}
    </div>
  );

  if (state === 'loading') return root(<HomeSkeleton />);
  if (state === 'outside')
    return root(
      <FullState icon={<IconUser />} title="Telegram orqali oching" body="Bu sahifa Fazo Club botining ichida ishlaydi.">
        <a className="btn btn-primary" href={`https://t.me/${BOT}`}>Botga o&apos;tish</a>
      </FullState>,
      true,
    );
  if (state === 'unregistered')
    return root(
      <FullState icon={<IconUser />} title="Avval botda ro'yxatdan o'ting" body="Kupon olish uchun Fazo Club botida ro'yxatdan o'tishingiz kerak.">
        <button className="btn btn-primary" onClick={toBot}>Botga o&apos;tish</button>
      </FullState>,
      true,
    );
  if (state === 'offline' || !me)
    return root(
      <FullState icon={<IconOffline />} title="Internet aloqasi yo'q" body="Ulanishni tekshirib, qayta urinib ko'ring." inline>
        <button className="btn-pill" onClick={() => { setState('loading'); void load(); }}>Qayta urinish</button>
      </FullState>,
      true,
    );

  const hours = me.campaign?.receiptWindowHours ?? 72;
  const approved = me.receipts.filter((r) => r.status === 'APPROVED').length;
  const pending = me.receipts.filter((r) => PENDING.has(r.status)).length;
  const card = <CouponCard coupons={me.coupons} approved={approved} pending={pending} onClick={view === 'home' ? () => go('coupons') : undefined} />;

  return root(
    <>
      {view === 'home' && (
        <main className="screen">
          <section className="stack-8">
            {card}
            {me.isStaff ? (
              <p className="t-foot c-sub px-16">Fazo xodimlari ro&apos;yxatdan o&apos;tishi mumkin, lekin o&apos;yinda qatnashmaydi.</p>
            ) : (
              <p className="t-foot c-sub px-16">
                Chekni {hours} soat ichida qo&apos;shing. Skaner ishlamasa — chek rasmini{' '}
                <button className="inline-link" onClick={toBot}>botga yuboring</button>.
              </p>
            )}
          </section>

          <section className="stack-8">
            <div className="section-head px-16">
              <h2 className="t-caps c-header">Oxirgi cheklar</h2>
              {me.receipts.length > 0 && <button className="t-sub c-link" onClick={() => go('coupons')}>Hammasi</button>}
            </div>
            <ReceiptList rows={me.receipts.slice(0, 3)} />
          </section>

          <nav aria-label="Bo'limlar" className="card">
            <button className="nav-row" onClick={() => go('coupons')}>
              <span className="grow t-body c-text">Kuponlarim</span>
              <span className="t-body c-sub">{me.coupons}</span>
              <IconChevron />
            </button>
            <div className="sep-inset" />
            <button className="nav-row" onClick={() => go('rules')}>
              <span className="grow t-body c-text">Qoidalar</span>
              <IconChevron />
            </button>
          </nav>
        </main>
      )}

      {view === 'coupons' && (
        <main className="screen">
          {card}
          <button className="card nav-row c-link" onClick={invite}>
            <IconInvite />
            <span className="grow t-body">Do&apos;stlarni taklif qilish</span>
            <IconChevron />
          </button>
          <section className="stack-8">
            <h2 className="t-caps c-header px-16">Barcha cheklar · {me.receipts.length}</h2>
            <ReceiptList rows={me.receipts} />
          </section>
        </main>
      )}

      {view === 'rules' && <Rules hours={hours} rules={me.rules} />}

      {busy && <WaitingSheet />}
      {result && !busy && (
        <ResultSheet
          sheet={sheetFor(result, hours)}
          onAction={(a) => {
            setResult(null);
            if (a === 'scan') scan();
            else if (a === 'coupons') go('coupons');
            else if (a === 'bot') toBot();
          }}
        />
      )}
    </>,
  );
}

// ── Natija oynasi mantig'i ─────────────────────────────────────────────────

type Action = 'scan' | 'close' | 'coupons' | 'bot';
interface Sheet {
  tone: Tone;
  title: string;
  body: string;
  details: Array<[string, string]>;
  primary: [string, Action];
  secondary?: [string, Action];
}

function sheetFor(res: SubmitResult, hours: number): Sheet {
  const r = res.receipt;
  const details: Array<[string, string]> = [];
  if (r?.branchName) details.push(['Filial', r.branchName]);
  if (r?.fiscalAt) details.push(['Sana', fmtDate(r.fiscalAt)]);
  if (r?.amount != null) details.push(['Summa', `${sum(r.amount)} so'm`]);
  if (r && r.couponsCount > 0) details.push(['Kupon', `+${r.couponsCount}`]);
  const close: [string, Action] = ['Yopish', 'close'];
  const again: [string, Action] = ['Boshqa chekni skanerlash', 'scan'];

  switch (res.code) {
    case 'ACCEPTED': {
      const body =
        r?.status === 'APPROVED' && r.couponsCount > 0
          ? `${r.couponsCount} ta kupon qo'shildi.`
          : r?.status === 'BELOW_MIN'
            ? "Summa kupon olish uchun yetarli emas."
            : 'Kuponlar ertaga ertalab hisoblanadi.';
      return { tone: 'ok', title: 'Chek qabul qilindi', body, details, primary: ['Yana skanerlash', 'scan'], secondary: close };
    }
    case 'REVIEW':
      return { tone: 'warn', title: 'Tekshiruvga yuborildi', body: 'Chekni tekshirib, natijasini botda xabar qilamiz.', details, primary: ['Tushunarli', 'close'] };
    case 'ALREADY_YOURS':
      return { tone: 'info', title: "Bu chekni siz allaqachon qo'shgansiz", body: 'Bitta chek faqat bir marta hisoblanadi.', details, primary: ["Kuponlarimga o'tish", 'coupons'], secondary: close };
    case 'DUPLICATE':
      return { tone: 'err', title: "Bu chek allaqachon qo'shilgan", body: 'Bitta chek faqat bir marta hisoblanadi.', details: [], primary: again, secondary: close };
    case 'WINDOW_EXPIRED':
      return { tone: 'err', title: `Chek ${hours} soatdan oldin chiqarilgan`, body: `Faqat oxirgi ${hours} soat ichida chiqarilgan cheklar qabul qilinadi.`, details: [], primary: again, secondary: close };
    case 'INVALID_QR':
      return {
        tone: 'err',
        title: 'Bu fiskal chek QR kodi emas',
        body: 'Chekdagi soliq QR kodini skanerlang. Skaner ishlamasa — chek rasmini botga yuboring.',
        details: [],
        primary: ['Qayta skanerlash', 'scan'],
        secondary: ['Chek rasmini botga yuborish', 'bot'],
      };
    case 'BEFORE_CAMPAIGN':
      return { tone: 'err', title: 'Aksiya hali boshlanmagan', body: res.message, details: [], primary: ['Tushunarli', 'close'] };
    case 'AFTER_CAMPAIGN':
      return { tone: 'err', title: 'Aksiya tugagan', body: res.message, details: [], primary: ['Tushunarli', 'close'] };
    case 'FUTURE':
      return { tone: 'err', title: "Chek sanasi noto'g'ri", body: "Xato deb hisoblasangiz, botdagi «Aloqa» orqali yozing.", details: [], primary: again, secondary: close };
    case 'BRANCH_INACTIVE':
      return { tone: 'err', title: 'Bu filial aksiyada emas', body: res.message, details: [], primary: again, secondary: close };
    case 'RATE_LIMIT':
      return { tone: 'warn', title: "Juda ko'p urinish", body: "Birozdan keyin qayta urinib ko'ring.", details: [], primary: ['Tushunarli', 'close'] };
    case 'OFFLINE':
      return { tone: 'err', title: "Internet aloqasi yo'q", body: res.message, details: [], primary: ['Qayta skanerlash', 'scan'], secondary: close };
    default:
      return { tone: 'err', title: 'Xatolik yuz berdi', body: res.message, details: [], primary: ['Qayta skanerlash', 'scan'], secondary: close };
  }
}

// ── Komponentlar ─────────────────────────────────────────────────────────

function CouponCard({ coupons, approved, pending, onClick }: { coupons: number; approved: number; pending: number; onClick?: () => void }) {
  const inner = (
    <>
      <div className="coupon-top">
        <div className="section-head">
          <span className="t-caps-sb c-sub">Jami kuponlar</span>
          {onClick && <IconChevron />}
        </div>
        <div className="coupon-value">
          <span className="t-display c-brand">{coupons}</span>
          <span className="t-body-sb c-text">kupon</span>
        </div>
        <div className="t-foot c-sub with-icon">
          <IconClock size={14} />
          Kuponlar har kuni ertalab hisoblanadi
        </div>
      </div>
      <div className="sep-inset" />
      <div className="coupon-stats">
        <div>
          <span className="t-body-sb c-text">{approved}</span>
          <span className="t-foot c-sub">Tasdiqlangan chek</span>
        </div>
        <div className="stat-right">
          <span className="t-body-sb c-text">{pending}</span>
          <span className="t-foot c-sub">Tekshiruvda</span>
        </div>
      </div>
    </>
  );
  return onClick ? (
    <button className="card coupon-card" onClick={onClick} aria-label={`Kuponlarim: ${coupons} kupon`}>{inner}</button>
  ) : (
    <section className="card coupon-card" aria-label="Kuponlar">{inner}</section>
  );
}

function ReceiptList({ rows }: { rows: ReceiptRow[] }) {
  if (!rows.length)
    return (
      <div className="card empty">
        <IconReceipt />
        <p className="t-body-sb c-text">Hali chek yo&apos;q</p>
        <p className="t-sub c-sub">Restoranda olingan chekdagi QR kodni skanerlang — kuponlar shu yerda ko&apos;rinadi.</p>
      </div>
    );
  return (
    <ul className="card list">
      {rows.map((r) => {
        const b = BADGE[r.status] ?? { label: r.status, tone: 'gray' as const };
        const showSum = r.amount && !PENDING.has(r.status);
        return (
          <li key={r.id} className="row">
            <div className="row-inner">
              <div className="row-line">
                <span className="grow t-body c-text ellipsis">{r.branch?.name ?? (r.source === 'PHOTO' ? 'Chek rasmi' : 'Chek')}</span>
                {r.status === 'APPROVED' && r.couponsCount > 0 && <span className="t-body-sb c-brand">+{r.couponsCount}</span>}
              </div>
              <div className="row-line">
                <span className="grow t-sub c-sub ellipsis">
                  {fmtShort(r.fiscalAt ?? r.createdAt).replace(' ', ' · ')}
                  {showSum && ` · ${sum(r.amount!)} so'm`}
                  {r.status === 'REJECTED' && r.rejectReason && <span className="c-err"> · {r.rejectReason}</span>}
                </span>
                <span className={`badge badge-${b.tone}`}>{b.label}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Rules({ hours, rules }: { hours: number; rules: Me['rules'] }) {
  const steps: Array<[string, string]> = [
    ['Chekni skanerlang', 'Fazo restoranlaridagi fiskal chekning QR kodi.'],
    [`${hours} soat ichida qo'shing`, "Kechroq qo'shilgan cheklar qabul qilinmaydi."],
    [
      'Kupon oling',
      rules.couponPrice
        ? `Har ${sum(rules.couponPrice)} so'm uchun 1 kupon. Har kuni ertalab hisoblanadi.`
        : "Kupon soni chek summasiga bog'liq. Har kuni ertalab hisoblanadi.",
    ],
  ];
  return (
    <main className="screen screen-rules">
      <header className="px-16 stack-4">
        <h1 className="t-title1 c-text">Qanday ishlaydi</h1>
        <p className="t-sub c-sub">Uch qadam — va siz o&apos;yindasiz.</p>
      </header>

      <ol aria-label="Qadamlar" className="card list">
        {steps.map(([title, desc], i) => (
          <li key={title} className="step">
            <span className="step-n">{i + 1}</span>
            <div className="step-body">
              <span className="t-step c-text">{title}</span>
              <span className="t-step-sub c-sub">{desc}</span>
            </div>
          </li>
        ))}
      </ol>

      <section className="stack-8">
        <h2 className="t-caps c-header px-16">Sovrinlar</h2>
        <div className="card list">
          <div className="prize">
            <span className="prize-icon"><IconGift /></span>
            <div className="prize-body"><span className="t-step c-text">Har oy</span><span className="t-sub c-sub">Sovg&apos;alar</span></div>
          </div>
          <div className="prize">
            <span className="prize-icon"><IconCar /></span>
            <div className="prize-body"><span className="t-step c-text">Yil oxirida</span><span className="t-sub c-sub">Avtomobil</span></div>
          </div>
        </div>
        <p className="t-foot c-sub px-16">Har bir kupon — o&apos;yinda bitta imkoniyat.</p>
      </section>

      <section className="stack-8">
        <a href="/rules" target="_blank" className="card nav-row c-link">
          <span className="grow t-step">To&apos;liq qoidalar</span>
          <IconExternal />
        </a>
        <p className="t-foot c-sub px-16">
          Qaytarilgan, takroriy va {rules.minSum ? `${sum(rules.minSum)} so'mdan` : 'minimal summadan'} kam cheklar hisobga olinmaydi.
        </p>
      </section>
    </main>
  );
}

function ResultSheet({ sheet, onAction }: { sheet: Sheet; onAction: (a: Action) => void }) {
  const icon = { ok: <IconCheck />, warn: <IconClock size={32} />, info: <IconCopy />, err: <IconX /> }[sheet.tone];
  return (
    <div className="overlay" onClick={() => onAction('close')}>
      <section role="dialog" aria-label={sheet.title} className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head">
          <div className={`status-icon tone-${sheet.tone}`}>{icon}</div>
          <div className="stack-8">
            <h2 className="t-title c-text">{sheet.title}</h2>
            <p className="t-sub c-sub">{sheet.body}</p>
          </div>
        </div>
        {sheet.details.length > 0 && (
          <div className="details">
            {sheet.details.map(([k, v]) => (
              <div key={k} className="detail-row">
                <div className="detail-inner t-sub">
                  <span className="c-sub">{k}</span>
                  <span className={k === 'Kupon' ? 'c-brand t-sub-sb' : 'c-text'}>{v}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="stack-8">
          <button className="btn btn-primary" onClick={() => onAction(sheet.primary[1])}>{sheet.primary[0]}</button>
          {sheet.secondary && <button className="btn btn-secondary" onClick={() => onAction(sheet.secondary![1])}>{sheet.secondary[0]}</button>}
        </div>
      </section>
    </div>
  );
}

function WaitingSheet() {
  return (
    <div className="overlay">
      <section role="dialog" aria-label="Chek tekshirilmoqda" aria-busy="true" className="sheet">
        <div className="grabber" />
        <div className="sheet-head waiting">
          <svg className="spin" width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" role="img" aria-label="Yuklanmoqda">
            <circle cx="12" cy="12" r="9" stroke="var(--fc-skeleton)" />
            <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--link)" />
          </svg>
          <div className="stack-8">
            <h2 className="t-title c-text">Chek tekshirilmoqda</h2>
            <p className="t-sub c-sub">Iltimos, oynani yopmang.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function FullState({ icon, title, body, children, inline }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div className="full">
      <main className="full-main">
        <div className="status-icon tone-gray">{icon}</div>
        <div className="stack-8">
          <h2 className="t-title c-text">{title}</h2>
          <p className="t-sub c-sub">{body}</p>
        </div>
        {inline && <div className="full-inline">{children}</div>}
      </main>
      {!inline && <div className="full-bottom">{children}</div>}
    </div>
  );
}

function HomeSkeleton() {
  const rows = [['152px', '120px'], ['96px', '184px'], ['144px', '168px']];
  return (
    <main className="screen" aria-busy="true" aria-label="Yuklanmoqda">
      <section className="stack-8">
        <div className="card">
          <div className="coupon-top skel-gap">
            <div className="sk" style={{ width: 104, height: 12 }} />
            <div className="sk-value"><div className="sk" style={{ width: 56, height: 56, borderRadius: 12 }} /><div className="sk" style={{ width: 48, height: 16 }} /></div>
            <div className="sk" style={{ width: 232, height: 12 }} />
          </div>
          <div className="sep-inset" />
          <div className="coupon-stats">
            <div className="skel-gap-6"><div className="sk" style={{ width: 24, height: 18 }} /><div className="sk" style={{ width: 112, height: 12 }} /></div>
            <div className="stat-right skel-gap-6"><div className="sk" style={{ width: 24, height: 18 }} /><div className="sk" style={{ width: 88, height: 12 }} /></div>
          </div>
        </div>
        <div className="sk mx-16" style={{ width: 280, height: 12 }} />
      </section>
      <section className="stack-8">
        <div className="sk mx-16" style={{ width: 104, height: 12 }} />
        <div className="card list">
          {rows.map(([a, b], i) => (
            <div key={i} className="row">
              <div className="row-inner skel-gap">
                <div className="sk-line"><div className="sk" style={{ width: a, height: 16 }} /><div className="sk" style={{ width: 24, height: 16 }} /></div>
                <div className="sk-line"><div className="sk" style={{ width: b, height: 12 }} /><div className="sk" style={{ width: 88, height: 20, borderRadius: 10 }} /></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// ── Ikonkalar (stroke, currentColor) ─────────────────────────────────────

const svg = (size: number, children: React.ReactNode, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IconChevron = () => <span className="c-hint chev">{svg(16, <path d="M9 6l6 6-6 6" />, 2.5)}</span>;
const IconClock = ({ size }: { size: number }) => svg(size, <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
const IconCheck = () => svg(32, <path d="M5 12.5l4.5 4.5L19 7.5" />);
const IconCopy = () => svg(32, <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>);
const IconX = () => svg(32, <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></>);
const IconUser = () => svg(32, <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>, 1.75);
const IconOffline = () => svg(32, <path d="M2 8.5a15 15 0 0 1 4.5-2.7M10 5.1A15 15 0 0 1 22 8.5M5 12.5a10 10 0 0 1 4-2.2M15.5 10.6a10 10 0 0 1 3.5 1.9M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />, 1.75);
const IconInvite = () => svg(24, <><circle cx="9" cy="8" r="3.5" /><path d="M15 19c0-2.8-2.7-5-6-5s-6 2.2-6 5M19 8v6M16 11h6" /></>, 1.75);
const IconExternal = () => svg(16, <path d="M7 17L17 7M9 7h8v8" />);
const IconGift = () => svg(16, <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>);
const IconCar = () => svg(16, <><path d="M5 17H3v-5l2-5h11l4 5h1v5h-2" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" /><path d="M9 17h6M3 12h18" /></>);
const IconReceipt = () => (
  <span className="c-hint">
    {svg(40, <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>, 1.5)}
  </span>
);
