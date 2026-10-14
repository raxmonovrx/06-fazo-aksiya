'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, ErrorBox, Field, Input, Pager, Select, Table, useLoad } from '@/components/ui';
import { adminApi, qs } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface P {
  id: number;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  source: string | null;
  isStaff: boolean;
  isBlocked: boolean;
  rulesAcceptedAt: string | null;
  createdAt: string;
  _count: { receipts: number; coupons: number };
}

export default function ParticipantsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [staff, setStaff] = useState('');
  const [applied, setApplied] = useState({ q: '', staff: '' });
  const [page, setPage] = useState(1);
  const { data, error, loading } = useLoad(
    () => adminApi<{ total: number; page: number; pageSize: number; items: P[] }>(`/participants${qs({ ...applied, page })}`),
    [applied, page],
  );

  return (
    <>
      <h1 className="text-xl font-bold">Ishtirokchilar</h1>
      <Card>
        <form
          className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setApplied({ q, staff });
          }}
        >
          <Field label="Qidiruv (telefon, ism, @username, referal kod)">
            <Input value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="Turi">
            <Select value={staff} onChange={(e) => setStaff(e.target.value)}>
              <option value="">Hammasi</option>
              <option value="false">Mijozlar</option>
              <option value="true">Xodimlar</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button type="submit">Qidirish</Button>
          </div>
        </form>
        <ErrorBox error={error} />
        <div className={loading ? 'opacity-60' : ''}>
          <Table head={['ID', 'Telefon', 'Ism', 'Manba', "Ro'yxatdan o'tgan", 'Cheklar', 'Kuponlar', '']} empty={data?.items.length === 0}>
            {data?.items.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/participants/${p.id}`)}>
                <td className="text-muted-foreground">#{p.id}</td>
                <td>{p.phone ?? <span className="text-muted-foreground">kontakt yo&apos;q</span>}</td>
                <td>
                  {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                  {p.username && <div className="text-xs text-muted-foreground">@{p.username}</div>}
                </td>
                <td>{p.source ?? '—'}</td>
                <td>{p.rulesAcceptedAt ? fmtDate(p.rulesAcceptedAt) : <span className="text-muted-foreground">tugallanmagan</span>}</td>
                <td>{p._count.receipts}</td>
                <td className="font-semibold">{p._count.coupons}</td>
                <td className="space-x-1">
                  {p.isStaff && <span className="rounded bg-secondary px-1 text-xs">xodim</span>}
                  {p.isBlocked && <span className="rounded bg-red-100 dark:bg-red-500/15 px-1 text-xs text-red-700 dark:text-red-400">bloklangan</span>}
                </td>
              </tr>
            ))}
          </Table>
          {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
        </div>
      </Card>
    </>
  );
}
