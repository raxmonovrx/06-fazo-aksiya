'use client';

import { RiImageLine, RiSearchLine } from '@remixicon/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  ErrorAlert,
  Pager,
  StatusBadge,
  TableEmpty,
  TableLoading,
  useLoad,
} from '@/components/admin/kit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi, qs } from '@/lib/api';
import { fmtDate, fmtSum, STATUS } from '@/lib/format';
import { cn } from '@/lib/utils';

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
  participant: {
    id: number;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    isStaff: boolean;
  };
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

// Select'da "Hammasi" — API uchun bo'sh satr
const ALL = 'all';

const EMPTY: Filters = {
  status: '',
  branchId: '',
  phone: '',
  q: '',
  from: '',
  to: '',
};

export function ReceiptsTable({
  initial,
  lockStatus,
  showPhoto,
}: {
  initial: Filters;
  lockStatus?: boolean;
  showPhoto?: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);
  const branches = useLoad(
    () => adminApi<Array<{ id: number; name: string }>>('/branches'),
    [],
  );
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
  const set = (k: keyof Filters) => (v: string) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const statusItems = [
    { value: ALL, label: 'Hammasi' },
    ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label })),
  ];
  const branchItems = [
    { value: ALL, label: 'Hammasi' },
    ...(branches.data ?? []).map((b) => ({
      value: String(b.id),
      label: b.name,
    })),
  ];

  const reset = () => {
    // Moderatsiyada status qulflangan — uni saqlab qolamiz
    const next = { ...EMPTY, status: lockStatus ? initial.status : '' };
    setFilters(next);
    setPage(1);
    setApplied(next);
  };

  const colSpan = showPhoto ? 10 : 9;
  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardContent>
          <form
            className={cn(
              'grid gap-3 sm:grid-cols-2',
              lockStatus ? 'lg:grid-cols-5' : 'lg:grid-cols-6',
            )}
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setApplied(filters);
            }}
          >
            {!lockStatus && (
              <Field>
                <FieldLabel htmlFor="rf-status">Status</FieldLabel>
                <Select
                  items={statusItems}
                  value={filters.status || ALL}
                  onValueChange={(v) => {
                    const s = (v as string | null) ?? ALL;
                    set('status')(s === ALL ? '' : s);
                  }}
                >
                  <SelectTrigger id="rf-status" className="w-full">
                    <SelectValue placeholder="Hammasi" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusItems.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="rf-branch">Filial</FieldLabel>
              <Select
                items={branchItems}
                value={filters.branchId || ALL}
                onValueChange={(v) => {
                  const s = (v as string | null) ?? ALL;
                  set('branchId')(s === ALL ? '' : s);
                }}
              >
                <SelectTrigger id="rf-branch" className="w-full">
                  <SelectValue placeholder="Hammasi" />
                </SelectTrigger>
                <SelectContent>
                  {branchItems.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="rf-phone">Telefon</FieldLabel>
              <Input
                id="rf-phone"
                value={filters.phone}
                onChange={(e) => set('phone')(e.target.value)}
                placeholder="90 123"
                inputMode="tel"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rf-q">Chek №, FM yoki ID</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <RiSearchLine />
                </InputGroupAddon>
                <InputGroupInput
                  id="rf-q"
                  value={filters.q}
                  onChange={(e) => set('q')(e.target.value)}
                  placeholder="Qidirish…"
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="rf-from">Qo&apos;shilgan (dan)</FieldLabel>
              <DatePicker
                id="rf-from"
                value={filters.from}
                onChange={set('from')}
                max={filters.to || undefined}
                placeholder="Boshlanish"
                clearable
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rf-to">(gacha)</FieldLabel>
              <DatePicker
                id="rf-to"
                value={filters.to}
                onChange={set('to')}
                min={filters.from || undefined}
                placeholder="Tugash"
                clearable
              />
            </Field>
            <div className="flex items-end justify-end gap-2 sm:col-span-full">
              <Button type="button" variant="ghost" onClick={reset}>
                Tozalash
              </Button>
              <Button type="submit">
                <RiSearchLine data-icon="inline-start" />
                Qidirish
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ErrorAlert error={error} />

      <Card className="py-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              {showPhoto && <TableHead className="w-16">Rasm</TableHead>}
              <TableHead>Qo&apos;shilgan</TableHead>
              <TableHead>Ishtirokchi</TableHead>
              <TableHead>Filial</TableHead>
              <TableHead>Chek</TableHead>
              <TableHead>Chek vaqti</TableHead>
              <TableHead className="text-right">Summa</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Kupon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              <TableLoading colSpan={colSpan} />
            ) : items.length === 0 ? (
              <TableEmpty colSpan={colSpan}>Cheklar topilmadi</TableEmpty>
            ) : (
              items.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn('cursor-pointer', loading && 'opacity-60')}
                  onClick={() => router.push(`/admin/receipts/${r.id}`)}
                >
                  <TableCell className="text-muted-foreground tabular-nums">
                    <Link
                      href={`/admin/receipts/${r.id}`}
                      className="hover:text-foreground hover:underline"
                    >
                      #{r.id}
                    </Link>
                  </TableCell>
                  {showPhoto && (
                    <TableCell>
                      {r.photoFileId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/admin/photos/${r.photoFileId}`}
                          alt=""
                          className="h-14 w-10 rounded-md object-cover ring-1 ring-foreground/10"
                          loading="lazy"
                        />
                      ) : (
                        <span className="grid h-14 w-10 place-items-center rounded-md bg-muted text-muted-foreground">
                          <RiImageLine className="size-4" />
                        </span>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="tabular-nums">
                    {fmtDate(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums">
                        {r.participant.phone ?? '—'}
                      </span>
                      {r.participant.isStaff && (
                        <Badge variant="secondary">xodim</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[r.participant.firstName, r.participant.lastName]
                        .filter(Boolean)
                        .join(' ')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.branch?.name ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="tabular-nums">
                      {r.receiptNumber ? `№${r.receiptNumber}` : '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.fm ?? r.source}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {fmtDate(r.fiscalAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtSum(r.amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                    {r.rejectReason && (
                      <div className="mt-1 max-w-48 text-xs whitespace-normal text-muted-foreground">
                        {r.rejectReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {r.couponsCount || ''}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {data && (
        <Pager
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onPage={setPage}
        />
      )}
    </div>
  );
}
