'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { fmtDate, fmtSum, STATUS } from '@/lib/format';

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

export default function MiniApp() {
  const [tg, setTg] = useState<TgWebApp | null>(null);
  const [state, setState] = useState<'loading' | 'outside' | 'unregistered' | 'error' | 'ready'>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>('scan');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`/api/miniapp${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', authorization: `tma ${tg?.initData ?? ''}`, ...init?.headers },
      });
      return res;
    },
    [tg],
  );

  const load = useCallback(async () => {
    const res = await api('/me');
    if (res.status === 403) return setState('unregistered');
    if (!res.ok) return setState('error');
    setMe(await res.json());
    setState('ready');
  }, [api]);

  useEffect(() => {
    const w = window.Telegram?.WebApp;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'coupons') setTab('coupons');
    if (!w?.initData) return setState('outside');
    w.ready();
    w.expand();
    setTg(w);
  }, []);

  useEffect(() => {
    if (tg) void load();
  }, [tg, load]);

  const submit = useCallback(
    async (text: string) => {
      setBusy(true);
      setResult(null);
      try {
        const res = await api('/receipts', { method: 'POST', body: JSON.stringify({ text }) });
        const body: SubmitResult = res.ok ? await res.json() : { code: 'ERROR', message: "Xatolik yuz berdi. Qayta urinib ko'ring." };
        setResult(body);
        tg?.HapticFeedback?.notificationOccurred(OK_CODES.has(body.code) ? 'success' : 'error');
        await load();
      } catch {
        setResult({ code: 'ERROR', message: "Internet bilan muammo. Qayta urinib ko'ring." });
      } finally {
        setBusy(false);
      }
    },
    [api, load, tg],
  );

  const canScan = useMemo(() => Boolean(tg?.isVersionAtLeast('6.4') && tg.platform !== 'tdesktop' && tg.platform !== 'macos' && tg.platform !== 'web' && tg.platform !== 'weba'), [tg]);

  const scan = () => {
    if (!tg) return;
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
        return false; // bu fiskal QR emas — skaner ochiq qoladi
      }
      done = true;
      void submit(text);
      return true;
    });
  };

  if (state === 'loading') return <Shell><p className="py-20 text-center" style={{ color: 'var(--hint)' }}>Yuklanmoqda…</p></Shell>;
  if (state === 'outside')
    return (
      <Shell>
        <Card>
          <p className="mb-4">Bu sahifa Telegram ichida ochiladi.</p>
          <a className="btn" href={`https://t.me/${BOT}`}>Botni ochish</a>
        </Card>
      </Shell>
    );
  if (state === 'unregistered')
    return (
      <Shell>
        <Card>
          <p className="mb-4">Avval botda ro&apos;yxatdan o&apos;ting: telefon raqamingizni yuboring va qoidalarga rozilik bering.</p>
          <button className="btn" onClick={() => tg?.close()}>Botga qaytish</button>
        </Card>
      </Shell>
    );
  if (state === 'error' || !me)
    return (
      <Shell>
        <Card>
          <p className="mb-4">Ma&apos;lumotni yuklab bo&apos;lmadi.</p>
          <button className="btn" onClick={() => void load()}>Qayta urinish</button>
        </Card>
      </Shell>
    );

  return (
    <Shell>
      <nav className="sticky top-0 z-10 flex gap-1 p-2" style={{ background: 'var(--bg2)' }}>
        {(
          [
            ['scan', "🧾 Chek qo'shish"],
            ['coupons', '🎟 Kuponlarim'],
            ['rules', '📜 Qoidalar'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 rounded-lg px-2 py-2 text-sm font-medium transition"
            style={tab === key ? { background: 'var(--btn)', color: 'var(--btn-text)' } : { background: 'var(--section)' }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'scan' && (
        <div className="space-y-3 px-3 pb-8">
          <Card>
            <div className="text-center">
              <div className="mb-2 text-5xl">🧾</div>
              <p className="mb-4 text-sm" style={{ color: 'var(--hint)' }}>
                Fiskal chek pastidagi QR kodni skanerlang. Chekni {me.campaign?.receiptWindowHours ?? 72} soat ichida qo&apos;shing.
              </p>
              <button className="btn w-full py-4 text-lg" onClick={scan} disabled={busy}>
                {busy ? 'Yuborilmoqda…' : "📷 QR'ni skanerlash"}
              </button>
              {!canScan && (
                <p className="mt-3 text-xs" style={{ color: 'var(--hint)' }}>
                  Kompyuterda skaner ishlamaydi — chek rasmini botga yuboring.
                </p>
              )}
            </div>
          </Card>
          {result && (
            <Card>
              <p className={`whitespace-pre-line text-center font-medium ${OK_CODES.has(result.code) ? '' : 'text-red-600'}`}>
                {result.message}
              </p>
            </Card>
          )}
          <Section title="Oxirgi cheklar">
            <ReceiptList rows={me.receipts.slice(0, 5)} />
          </Section>
          <p className="px-2 text-center text-xs" style={{ color: 'var(--hint)' }}>
            Skaner ishlamasa, chek rasmini botga yuboring.
          </p>
        </div>
      )}

      {tab === 'coupons' && (
        <div className="space-y-3 px-3 pb-8">
          <Card>
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--hint)' }}>Jami kuponlaringiz</p>
              <p className="text-5xl font-bold" style={{ color: 'var(--btn)' }}>{me.coupons}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--hint)' }}>Kuponlar har kuni ertalab hisoblanadi</p>
            </div>
          </Card>
          <Section title={`Cheklar (${me.receipts.length})`}>
            <ReceiptList rows={me.receipts} />
          </Section>
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-3 px-3 pb-8">
          <Card>
            <p className="whitespace-pre-line text-sm leading-relaxed">{me.campaign?.rulesText}</p>
            <a className="mt-3 block text-sm" style={{ color: 'var(--link)' }} href="/rules" target="_blank">
              To&apos;liq qoidalar va filiallar bo&apos;yicha shartlar →
            </a>
          </Card>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="tg mx-auto max-w-lg">
      <style>{`.btn{display:inline-block;border-radius:12px;padding:12px 18px;font-weight:600;background:var(--btn);color:var(--btn-text)}.btn:disabled{opacity:.6}`}</style>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--section)' }}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 px-2 text-xs font-semibold uppercase" style={{ color: 'var(--hint)' }}>{title}</h3>
      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--section)' }}>
        {children}
      </div>
    </div>
  );
}

function ReceiptList({ rows }: { rows: ReceiptRow[] }) {
  if (!rows.length) return <p className="p-4 text-center text-sm" style={{ color: 'var(--hint)' }}>Hali chek qo&apos;shilmagan</p>;
  return (
    <ul>
      {rows.map((r, i) => {
        const s = STATUS[r.status] ?? { label: r.status, emoji: '•' };
        return (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3" style={i ? { borderTop: '1px solid color-mix(in srgb, var(--hint) 20%, transparent)' } : undefined}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.branch?.name ?? (r.source === 'PHOTO' ? 'Chek rasmi' : 'Chek')}{r.receiptNumber && ` · №${r.receiptNumber}`}</p>
              <p className="text-xs" style={{ color: 'var(--hint)' }}>
                {fmtDate(r.fiscalAt ?? r.createdAt)}
                {r.amount && ` · ${fmtSum(r.amount)}`}
              </p>
              {r.status === 'REJECTED' && r.rejectReason && <p className="text-xs text-red-600">{r.rejectReason}</p>}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs">{s.emoji} {s.label}</p>
              {r.couponsCount > 0 && <p className="text-sm font-semibold" style={{ color: 'var(--btn)' }}>+{r.couponsCount} 🎟</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
