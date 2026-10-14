'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Card, ErrorBox, Field, Input, Pager, Select, StatusBadge, Table, useLoad } from '@/components/ui';
import { adminApi, qs } from '@/lib/api';
import { fmtDate, fmtSum, STATUS } from '@/lib/format';

export interface ReceiptItem {
  id: number;
  status: string;
  source: string;
  fm: string | null;
  receiptNumber: string | null;
  fiscalAt: string | null;
  amount: string | null;
  couponsCount: number;
  rejectCode: string | null;
  rejectReason: string | null;
  photoFileId: string | null;
  createdAt: string;
  branch: { id: number; name: string } | null;
  participant: { id: number; phone: string | null; firstName: string | null; lastName: string | null; isStaff: boolean };
}

interface Page {
  total: number;
  page: number;
  pageSize: number;
  items: ReceiptItem[];
}

export interface Filters {
  status: string;
  branchId: string;
  phone: string;
  q: string;
  from: string;
  to: string;
}

export function ReceiptsTable({ initial, lockStatus, showPhoto }: { initial: Filters; lockStatus?: boolean; showPhoto?: boolean }) {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);
  const branches = useLoad(() => adminApi<Array<{ id: number; name: string }>>('/branches'), []);
  const { data, error, loading } = useLoad(
    () =>
      adminApi<Page>(
        `/receipts${qs({
          status: applied.status,
          branchId: applied.branchId,
          phone: applied.phone,
          q: applied.q,
          from: applied.from && `${applied.from} 00:00`,
          to: applied.to && `${applied.to} 23:59`,
          page,
        })}`,
      ),
    [applied, page],
  );
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <Card>
      <form
        className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-7"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(filters);
        }}
      >
        {!lockStatus && (
          <Field label="Status">
            <Select value={filters.status} onChange={set('status')}>
              <option value="">Hammasi</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Filial">
          <Select value={filters.branchId} onChange={set('branchId')}>
            <option value="">Hammasi</option>
            {branches.data?.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Telefon">
          <Input value={filters.phone} onChange={set('phone')} placeholder="90 123" />
        </Field>
        <Field label="Chek №, FM yoki ID">
          <Input value={filters.q} onChange={set('q')} />
        </Field>
        <Field label="Qo'shilgan (dan)">
          <Input type="date" value={filters.from} onChange={set('from')} />
        </Field>
        <Field label="(gacha)">
          <Input type="date" value={filters.to} onChange={set('to')} />
        </Field>
        <div className="flex items-end">
          <Button type="submit" className="w-full">Qidirish</Button>
        </div>
      </form>
      <ErrorBox error={error} />
      <div className={loading ? 'opacity-60' : ''}>
        <Table
          head={['ID', ...(showPhoto ? ['Rasm'] : []), "Qo'shilgan", 'Ishtirokchi', 'Filial', 'Chek', 'Chek vaqti', 'Summa', 'Status', 'Kupon']}
          empty={data?.items.length === 0}
        >
          {data?.items.map((r) => (
            <tr key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/receipts/${r.id}`)}>
              <td className="text-muted-foreground">
                <Link href={`/admin/receipts/${r.id}`}>#{r.id}</Link>
              </td>
              {showPhoto && (
                <td>
                  {r.photoFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/admin/photos/${r.photoFileId}`} alt="" className="h-14 w-10 rounded object-cover" loading="lazy" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
              <td className="whitespace-nowrap">{fmtDate(r.createdAt)}</td>
              <td className="whitespace-nowrap">
                {r.participant.phone}
                {r.participant.isStaff && <span className="ml-1 rounded bg-secondary px-1 text-xs">xodim</span>}
                <div className="text-xs text-muted-foreground">{[r.participant.firstName, r.participant.lastName].filter(Boolean).join(' ')}</div>
              </td>
              <td>{r.branch?.name ?? <span className="text-muted-foreground">—</span>}</td>
              <td className="whitespace-nowrap">
                {r.receiptNumber ? `№${r.receiptNumber}` : '—'}
                <div className="text-xs text-muted-foreground">{r.fm ?? r.source}</div>
              </td>
              <td className="whitespace-nowrap">{fmtDate(r.fiscalAt)}</td>
              <td className="whitespace-nowrap">{fmtSum(r.amount)}</td>
              <td>
                <StatusBadge status={r.status} />
                {r.rejectReason && <div className="max-w-48 text-xs text-muted-foreground">{r.rejectReason}</div>}
              </td>
              <td className="font-semibold">{r.couponsCount || ''}</td>
            </tr>
          ))}
        </Table>
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </div>
    </Card>
  );
}
