'use client';

import Link from 'next/link';

import { Card, ErrorBox, Stat, StatusBadge, Table, useLoad } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { fmtSum, STATUS } from '@/lib/format';

interface Dashboard {
  participants: { total: number; today: number; staff: number };
  receipts: { today: number; byStatus: Record<string, number> };
  coupons: { eligible: number; today: number };
  unknownFms: number;
  branches: Array<{ id: number | null; name: string; receipts: number; approved: number; amount: number; coupons: number }>;
}

export default function DashboardPage() {
  const { data, error } = useLoad(() => adminApi<Dashboard>('/dashboard'), []);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <p className="text-neutral-400">Yuklanmoqda…</p>;
  const review = (data.receipts.byStatus.NEEDS_REVIEW ?? 0) + (data.receipts.byStatus.NOT_FOUND ?? 0);
  const totalReceipts = Object.values(data.receipts.byStatus).reduce((a, b) => a + b, 0);

  return (
    <>
      <h1 className="text-xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ishtirokchilar" value={data.participants.total} sub={`bugun +${data.participants.today} · xodim ${data.participants.staff}`} />
        <Stat label="Cheklar" value={totalReceipts} sub={`bugun +${data.receipts.today}`} />
        <Stat label="Kuponlar (o'yinda)" value={data.coupons.eligible} sub={`bugun +${data.coupons.today}`} />
        <Stat
          label="Moderatsiya kutmoqda"
          value={<Link href="/admin/moderation" className={review ? 'text-sky-700 underline' : ''}>{review}</Link>}
          sub={data.unknownFms ? `noma'lum FM: ${data.unknownFms}` : undefined}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Cheklar statuslar bo'yicha">
          <ul className="space-y-2">
            {Object.keys(STATUS).map((s) => (
              <li key={s} className="flex items-center justify-between">
                <Link href={`/admin/receipts?status=${s}`}>
                  <StatusBadge status={s} />
                </Link>
                <span className="font-semibold">{data.receipts.byStatus[s] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Filiallar kesimida" className="lg:col-span-2">
          <Table head={['Filial', 'Cheklar', 'Tasdiqlangan', 'Summa', 'Kuponlar']}>
            {data.branches.map((b) => (
              <tr key={b.id ?? 'none'}>
                <td>{b.name}</td>
                <td>{b.receipts}</td>
                <td>{b.approved}</td>
                <td>{fmtSum(b.amount)}</td>
                <td className="font-semibold">{b.coupons}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}
