'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { fmtShort, fmtSum } from '@/lib/format';

type Tab = 'scan' | 'coupons' | 'rules';

interface ReceiptRow {
  id: number;
  status: string;
  fiscalAt: string | null;
  receiptNumber: string | null;
  amount: string | null;
  couponsCount: number;
  rejectReason: string | null;
  source: string;
  createdAt: string;
  branch: { name: string } | null;
}

interface Me {
  participant: { firstName: string | null; phone: string; refCode: string };
  coupons: number;
  receipts: ReceiptRow[];
  campaign: { name: string; startsAt: string; receiptWindowHours: number; rulesText: string } | null;
}

interface SubmitResult {
  code: string;
  message: string;
}

const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'FazoClub_bot';
const OK_CODES = new Set(['ACCEPTED', 'REVIEW', 'ALREADY_YOURS']);
const PENDING = new Set(['PENDING', 'NEEDS_REVIEW', 'NOT_FOUND']);

// Status belgilari — rang mavzudan mustaqil (yorug' va qorong'i fonda ham o'qiladi)
const CHIP: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Tekshirilmoqda', color: '#f59e0b' },
  NEEDS_REVIEW: { label: 'Tekshirilmoqda', color: '#0ea5e9' },
  NOT_FOUND: { label: 'Tekshirilmoqda', color: '#f97316' },
  APPROVED: { label: 'Tasdiqlandi', color: '#16a34a' },
  BELOW_MIN: { label: 'Summa kam', color: '#64748b' },
  REJECTED: { label: 'Rad etildi', color: '#dc2626' },
};

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'scan', label: 'Chek', icon: '🧾' },
  { key: 'coupons', label: 'Kuponlar', icon: '🎟' },
  { key: 'rules', label: 'Qoidalar', icon: '📜' },
];

export default function MiniApp() {
  const [tg, setTg] = useState<TgWebApp | null>(null);
  const [state, setState] = useState<'loading' | 'outside' | 'unregistered' | 'error' | 'ready'>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>('scan');
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
      if (res.status === 403) return setState('unregistered');
      if (!res.ok) return setState((s) => (s === 'ready' ? s : 'error'));
      setMe(await res.json());
      setState('ready');
    } catch {
      setState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [api]);

  // ── Telegram sozlamalari ───────────────────────────────────────────────
  useEffect(() => {
    const w = window.Telegram?.WebApp;
    if (new URLSearchParams(window.location.search).get('tab') === 'coupons') setTab('coupons');
    if (!w?.initData) return setState('outside');
    w.ready();
    w.expand();
    // Pastga tortganda ilova yopilib ketmasin (Bot API 7.7+)
    if (w.isVersionAtLeast('7.7')) w.disableVerticalSwipes?.();
    if (w.isVersionAtLeast('8.0')) w.lockOrientation?.();
    if (w.isVersionAtLeast('6.1')) {
      w.setHeaderColor('secondary_bg_color');
      w.setBackgroundColor('secondary_bg_color');
    }
    if (w.isVersionAtLeast('7.10')) w.setBottomBarColor?.('secondary_bg_color');
    setTg(w);
  }, []);

  useEffect(() => {
    if (!tg) return;
    void load();
    // Ilovaga qaytilganda (8.0+) — yangi ma'lumot
    const onActive = () => void load();
    tg.onEvent('activated', onActive);
    return () => tg.offEvent('activated', onActive);
  }, [tg, load]);

  // Telegram'ning "Orqaga" tugmasi: boshqa tabdan bosh sahifaga, natija oynasini yopish
  useEffect(() => {
    if (!tg?.isVersionAtLeast('6.1')) return;
    const back = () => (result ? setResult(null) : setTab('scan'));
    if (tab !== 'scan' || result) tg.BackButton.show();
    else tg.BackButton.hide();
    tg.BackButton.onClick(back);
    return () => tg.BackButton.offClick(back);
  }, [tg, tab, result]);

  // Chek yuborilayotganda yopishdan oldin tasdiq so'raladi
  useEffect(() => {
    if (!tg?.isVersionAtLeast('6.2')) return;
    if (busy) tg.enableClosingConfirmation();
    else tg.disableClosingConfirmation();
  }, [tg, busy]);

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    tg?.HapticFeedback?.selectionChanged();
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  const submit = useCallback(
    async (text: string) => {
      setBusy(true);
      try {
        const res = await api('/receipts', { method: 'POST', body: JSON.stringify({ text }) });
        const body: SubmitResult = res.ok ? await res.json() : { code: 'ERROR', message: "Xatolik yuz berdi. Qayta urinib ko'ring." };
        setResult(body);
        tg?.HapticFeedback?.notificationOccurred(OK_CODES.has(body.code) ? 'success' : 'error');
        await load();
      } catch {
        setResult({ code: 'ERROR', message: "Internet bilan muammo. Qayta urinib ko'ring." });
        tg?.HapticFeedback?.notificationOccurred('error');
      } finally {
        setBusy(false);
      }
    },
    [api, load, tg],
  );

  const canScan = useMemo(
    () => Boolean(tg?.isVersionAtLeast('6.4') && !['tdesktop', 'macos', 'web', 'weba', 'webk', 'unknown'].includes(tg.platform)),
    [tg],
  );

  const scan = () => {
    if (!tg || busy) return;
    tg.HapticFeedback?.impactOccurred('medium');
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
  };

  const invite = () => {
    if (!me) return;
    const link = `https://t.me/${BOT}?start=ref_${me.participant.refCode}`;
    const text = "Fazo'da ovqatlan, chek QR'ini skanerla — oylik sovg'alar va avtomobil o'yini! 🚗";
    tg?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  };

  // ── Holatlar ───────────────────────────────────────────────────────────
  if (state === 'loading') return <Shell><Skeleton /></Shell>;
  if (state !== 'ready' || !me) {
    const info = {
      outside: { icon: '📱', text: 'Bu sahifa Telegram ichida ochiladi.', btn: 'Botni ochish', on: () => (window.location.href = `https://t.me/${BOT}`) },
      unregistered: { icon: '👋', text: "Avval botda ro'yxatdan o'ting: telefon raqamingizni yuboring va qoidalarga rozilik bering.", btn: 'Botga qaytish', on: () => tg?.close() },
      error: { icon: '😕', text: "Ma'lumotni yuklab bo'lmadi. Internetni tekshiring.", btn: 'Qayta urinish', on: () => { setState('loading'); void load(); } },
    }[state as 'outside' | 'unregistered' | 'error'];
    return (
      <Shell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-6xl">{info.icon}</div>
          <p className="text-[15px] leading-snug">{info.text}</p>
          <button className="btn-primary w-full max-w-xs" onClick={info.on}>{info.btn}</button>
        </div>
      </Shell>
    );
  }

  const pending = me.receipts.filter((r) => PENDING.has(r.status)).length;
  const approved = me.receipts.filter((r) => r.status === 'APPROVED').length;
  const firstName = me.participant.firstName?.split(' ')[0];

  return (
    <Shell>
      <div className="px-4 pt-3 pb-28">
        {/* Hero */}
        <section className="hero relative overflow-hidden rounded-3xl p-5 text-white">
          <div className="pointer-events-none absolute -top-10 -right-8 text-[120px] leading-none opacity-15 select-none">🚗</div>
          <p className="text-[13px] font-medium opacity-85">{firstName ? `Salom, ${firstName}!` : 'Salom!'} · Omad Fazosi</p>
          <div className="mt-3 flex items-end gap-2">
            <span key={me.coupons} className="pop text-[52px] leading-none font-extrabold tracking-tight">{me.coupons}</span>
            <span className="mb-1.5 text-[15px] font-semibold opacity-90">kupon</span>
          </div>
          <p className="mt-1 text-[13px] opacity-85">Ovqatlan — mashina yut!</p>
          {pending > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[12px] font-medium backdrop-blur">
              <span className="dot" /> {pending} ta chek tekshirilmoqda
            </p>
          )}
        </section>

        {tab === 'scan' && (
          <div className="fade mt-4 space-y-4">
            <section className="card flex flex-col items-center px-5 pt-7 pb-5 text-center">
              <button onClick={scan} disabled={busy} className="scan-btn" aria-label="QR'ni skanerlash">
                {busy ? <span className="spinner" /> : <QrIcon />}
              </button>
              <h2 className="mt-5 text-[19px] font-bold">{busy ? 'Yuborilmoqda…' : "QR'ni skanerlash"}</h2>
              <p className="hint mt-1 text-[13px] leading-snug">
                Fiskal chek pastidagi QR kodni skanerlang. Chekni {me.campaign?.receiptWindowHours ?? 72} soat ichida qo&apos;shing.
              </p>
              {!canScan && <p className="mt-3 text-[12px] text-orange-500">Kompyuterda skaner ishlamaydi — chek rasmini botga yuboring.</p>}
            </section>

            <section className="card sep-y px-4">
              {[
                ['📷', 'Skanerlang', "Chekdagi QR — 2 soniyalik ish"],
                ['🌅', 'Ertalab kupon', 'Har kuni ertalab hisoblanadi'],
                ['🎁', "O'ynang", "Oylik sovg'alar va yil oxirida avtomobil"],
              ].map(([icon, title, text]) => (
                <div key={title} className="flex items-center gap-3 py-3">
                  <div className="icon-bubble">{icon}</div>
                  <div>
                    <p className="text-[15px] font-semibold">{title}</p>
                    <p className="hint text-[13px]">{text}</p>
                  </div>
                </div>
              ))}
            </section>

            <ReceiptSection title="Oxirgi cheklar" rows={me.receipts.slice(0, 3)} more={me.receipts.length > 3 ? () => switchTab('coupons') : undefined} />
            <p className="hint px-6 text-center text-[12px]">Skaner ishlamasa, chek rasmini to&apos;g&apos;ridan-to&apos;g&apos;ri botga yuboring.</p>
          </div>
        )}

        {tab === 'coupons' && (
          <div className="fade mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat value={me.coupons} label="Kupon" accent />
              <Stat value={approved} label="Tasdiqlangan" />
              <Stat value={pending} label="Tekshiruvda" />
            </div>
            <button onClick={invite} className="card flex w-full items-center gap-3 px-4 py-3.5 text-left active:opacity-70">
              <div className="icon-bubble">👥</div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold">Do&apos;stlarni taklif qilish</p>
                <p className="hint text-[13px]">Havolangizni ulashing</p>
              </div>
              <span className="hint text-xl">›</span>
            </button>
            <ReceiptSection title={`Barcha cheklar · ${me.receipts.length}`} rows={me.receipts} />
          </div>
        )}

        {tab === 'rules' && (
          <div className="fade mt-4 space-y-4">
            <section className="card px-4 py-4">
              <p className="text-[15px] leading-relaxed whitespace-pre-line">{me.campaign?.rulesText}</p>
            </section>
            <a href="/rules" target="_blank" className="card flex items-center gap-3 px-4 py-3.5 active:opacity-70">
              <div className="icon-bubble">📋</div>
              <div className="flex-1">
                <p className="text-[15px] font-semibold">To&apos;liq qoidalar</p>
                <p className="hint text-[13px]">Filiallar bo&apos;yicha kupon shartlari</p>
              </div>
              <span className="hint text-xl">›</span>
            </a>
          </div>
        )}
      </div>

      {/* Pastki tab-bar */}
      <nav className="tabbar fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => switchTab(t.key)} className={`tab ${tab === t.key ? 'tab-active' : ''}`}>
              <span className="text-[22px] leading-none">{t.icon}</span>
              <span className="mt-1 text-[11px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {result && <ResultSheet result={result} onClose={() => setResult(null)} onAgain={() => { setResult(null); scan(); }} />}
    </Shell>
  );
}

// ── Komponentlar ─────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="tg mx-auto max-w-lg">{children}</div>;
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="card px-2 py-3 text-center">
      <p className={`text-[24px] leading-none font-extrabold ${accent ? 'accent' : ''}`}>{value}</p>
      <p className="hint mt-1.5 text-[11px] font-medium">{label}</p>
    </div>
  );
}

function ReceiptSection({ title, rows, more }: { title: string; rows: ReceiptRow[]; more?: () => void }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between px-4">
        <h3 className="hint text-[12px] font-semibold tracking-wide uppercase">{title}</h3>
        {more && <button onClick={more} className="link text-[13px] font-medium">Hammasi</button>}
      </div>
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <div className="text-4xl">🧾</div>
            <p className="hint mt-2 text-[14px]">Hali chek qo&apos;shilmagan</p>
          </div>
        ) : (
          <ul className="sep-y">
            {rows.map((r) => {
              const chip = CHIP[r.status] ?? { label: r.status, color: '#64748b' };
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="icon-bubble">{r.source === 'PHOTO' ? '📷' : '🧾'}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{r.branch?.name ?? (r.source === 'PHOTO' ? 'Chek rasmi' : 'Chek')}</p>
                    <p className="hint truncate text-[13px]">
                      {fmtShort(r.fiscalAt ?? r.createdAt)}
                      {r.amount && ` · ${fmtSum(r.amount)}`}
                    </p>
                    {r.status === 'REJECTED' && r.rejectReason && <p className="truncate text-[12px] text-red-500">{r.rejectReason}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="chip" style={{ '--c': chip.color } as React.CSSProperties}>{chip.label}</span>
                    {r.couponsCount > 0 && <span className="accent text-[14px] font-bold">+{r.couponsCount} 🎟</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ResultSheet({ result, onClose, onAgain }: { result: SubmitResult; onClose: () => void; onAgain: () => void }) {
  const ok = OK_CODES.has(result.code);
  const icon = result.code === 'ACCEPTED' ? '✅' : result.code === 'REVIEW' ? '🔎' : result.code === 'ALREADY_YOURS' ? '👌' : '⚠️';
  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="sheet mx-auto w-full max-w-lg rounded-t-3xl px-6 pt-3 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-current opacity-20" />
        <div className="pop text-6xl">{icon}</div>
        <p className={`mt-4 text-[16px] leading-snug font-medium whitespace-pre-line ${ok ? '' : 'text-red-500'}`}>{result.message}</p>
        <div className="mt-6 flex gap-2">
          <button className="btn-secondary flex-1" onClick={onAgain}>Yana chek</button>
          <button className="btn-primary flex-1" onClick={onClose}>Yaxshi</button>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4 px-4 pt-3">
      <div className="skeleton h-[168px] rounded-3xl" />
      <div className="skeleton h-[230px] rounded-2xl" />
      <div className="skeleton h-[180px] rounded-2xl" />
    </div>
  );
}

function QrIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <rect x="7.5" y="7.5" width="3.5" height="3.5" rx=".5" />
      <rect x="13" y="7.5" width="3.5" height="3.5" rx=".5" />
      <rect x="7.5" y="13" width="3.5" height="3.5" rx=".5" />
      <path d="M13 13h1.5v1.5M16.5 13v3.5H13" />
    </svg>
  );
}
