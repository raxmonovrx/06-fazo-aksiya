'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, ErrorBox, StatusBadge, Table, useLoad } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { fmtDate, fmtSum } from '@/lib/format';
import { useAdmin } from '../../admin-context';

interface Detail {
  id: number;
  tgId: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  refCode: string;
  source: string | null;
  startPayload: string | null;
  isStaff: boolean;
  isBlocked: boolean;
  botBlockedAt: string | null;
  rulesAcceptedAt: string | null;
  createdAt: string;
  referredBy: { id: number; phone: string | null; firstName: string | null } | null;
  _count: { referrals: number };
  coupons: { eligible: number; ineligible: number };
  receipts: Array<{ id: number; status: string; fiscalAt: string | null; receiptNumber: string | null; amount: string | null; couponsCount: number; createdAt: string; branch: { name: string } | null }>;
}

export default function ParticipantPage() {
  const { id } = useParams<{ id: string }>();
  const me = useAdmin();
  const { data: p, error, reload } = useLoad(() => adminApi<Detail>(`/participants/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <ErrorBox error={error} />;
  if (!p) return <p className="text-neutral-400">Yuklanmoqda…</p>;

  const patch = async (data: Partial<Pick<Detail, 'isBlocked' | 'isStaff'>>) => {
    setBusy(true);
    setActionError(null);
    try {
      await adminApi(`/participants/${p.id}`, { method: 'PATCH', json: data });
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/participants" className="text-sm text-neutral-500 hover:underline">← Ishtirokchilar</Link>
        <h1 className="text-xl font-bold">{p.phone ?? `#${p.id}`}</h1>
        {p.isStaff && <span className="rounded bg-neutral-200 px-2 text-sm">xodim</span>}
        {p.isBlocked && <span className="rounded bg-red-100 px-2 text-sm text-red-700">bloklangan</span>}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Profil" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
            <div><dt className="text-xs text-neutral-500">Ism</dt><dd>{[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}</dd></div>
            <div><dt className="text-xs text-neutral-500">Telegram</dt><dd>{p.username ? `@${p.username}` : '—'} <span className="text-xs text-neutral-400">{p.tgId}</span></dd></div>
            <div><dt className="text-xs text-neutral-500">Manba</dt><dd>{p.source ?? '—'} <span className="text-xs text-neutral-400">{p.startPayload}</span></dd></div>
            <div><dt className="text-xs text-neutral-500">Referal kodi</dt><dd>{p.refCode} · taklif qilganlari: {p._count.referrals}</dd></div>
            <div><dt className="text-xs text-neutral-500">Kim taklif qilgan</dt><dd>{p.referredBy ? <Link className="text-sky-700" href={`/admin/participants/${p.referredBy.id}`}>{p.referredBy.phone}</Link> : '—'}</dd></div>
            <div><dt className="text-xs text-neutral-500">Ro&apos;yxatdan o&apos;tgan</dt><dd>{fmtDate(p.rulesAcceptedAt)}</dd></div>
            <div><dt className="text-xs text-neutral-500">Kuponlar</dt><dd className="font-semibold">{p.coupons.eligible} <span className="text-xs font-normal text-neutral-400">(o&apos;yindan tashqari: {p.coupons.ineligible})</span></dd></div>
            <div><dt className="text-xs text-neutral-500">Botni bloklagan</dt><dd>{p.botBlockedAt ? fmtDate(p.botBlockedAt) : 'yo\'q'}</dd></div>
          </dl>
        </Card>
        {me.role === 'ADMIN' && (
          <Card title="Amallar">
            <div className="flex flex-col gap-2">
              <Button variant={p.isBlocked ? 'secondary' : 'danger'} disabled={busy} onClick={() => patch({ isBlocked: !p.isBlocked })}>
                {p.isBlocked ? 'Blokdan chiqarish' : 'Bloklash'}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => patch({ isStaff: !p.isStaff })}>
                {p.isStaff ? 'Xodim belgisini olib tashlash' : 'Xodim deb belgilash'}
              </Button>
              <p className="text-xs text-neutral-400">Xodim kuponlari o&apos;yinda qatnashmaydi.</p>
              <ErrorBox error={actionError} />
            </div>
          </Card>
        )}
      </div>
      <Card title={`Cheklar (${p.receipts.length})`}>
        <Table head={['ID', "Qo'shilgan", 'Filial', 'Chek', 'Chek vaqti', 'Summa', 'Status', 'Kupon']} empty={!p.receipts.length}>
          {p.receipts.map((r) => (
            <tr key={r.id}>
              <td><Link className="text-sky-700" href={`/admin/receipts/${r.id}`}>#{r.id}</Link></td>
              <td>{fmtDate(r.createdAt)}</td>
              <td>{r.branch?.name ?? '—'}</td>
              <td>{r.receiptNumber ?? '—'}</td>
              <td>{fmtDate(r.fiscalAt)}</td>
              <td>{fmtSum(r.amount)}</td>
              <td><StatusBadge status={r.status} /></td>
              <td>{r.couponsCount || ''}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
