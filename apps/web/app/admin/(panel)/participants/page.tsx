'use client';

import { RiCloseLine, RiSearchLine } from '@remixicon/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  ErrorAlert,
  Pager,
  TableEmpty,
  TableLoading,
  useLoad,
} from '@/components/admin/kit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
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

// '' (hammasi) Select'da 'all' bilan ifodalanadi
const STAFF_ITEMS = [
  { value: 'all', label: 'Hammasi' },
  { value: 'false', label: 'Mijozlar' },
  { value: 'true', label: 'Xodimlar' },
];

const COLS = 7;

export default function ParticipantsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [staff, setStaff] = useState('');
  const [applied, setApplied] = useState({ q: '', staff: '' });
  const [page, setPage] = useState(1);
  const { data, error, loading } = useLoad(
    () =>
      adminApi<{ total: number; page: number; pageSize: number; items: P[] }>(
        `/participants${qs({ ...applied, page })}`,
      ),
    [applied, page],
  );

  const apply = (next: { q: string; staff: string }) => {
    setPage(1);
    setApplied(next);
  };
  const dirty = !!(q || staff || applied.q || applied.staff);

  return (
    <div className="flex flex-col gap-4">
      <Card size="sm">
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              apply({ q, staff });
            }}
          >
            <Field>
              <FieldLabel htmlFor="p-q">Qidiruv</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <RiSearchLine />
                </InputGroupAddon>
                <InputGroupInput
                  id="p-q"
                  value={q}
                  placeholder="Telefon, ism, @username, referal kod"
                  onChange={(e) => setQ(e.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel>Turi</FieldLabel>
              <Select
                items={STAFF_ITEMS}
                value={staff || 'all'}
                onValueChange={(v) => {
                  // turi tanlanishi bilan darhol qo'llanadi
                  const raw = (v as string | null) ?? 'all';
                  const next = raw === 'all' ? '' : raw;
                  setStaff(next);
                  apply({ q, staff: next });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Hammasi" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ITEMS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 sm:flex-none">
                <RiSearchLine data-icon="inline-start" />
                Qidirish
              </Button>
              {dirty && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setQ('');
                    setStaff('');
                    apply({ q: '', staff: '' });
                  }}
                >
                  <RiCloseLine data-icon="inline-start" />
                  Tozalash
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <ErrorAlert error={error} />

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Ishtirokchi</TableHead>
              <TableHead>Ism</TableHead>
              <TableHead>Manba</TableHead>
              <TableHead>Ro&apos;yxatdan o&apos;tgan</TableHead>
              <TableHead className="text-right">Cheklar</TableHead>
              <TableHead className="text-right">Kuponlar</TableHead>
              <TableHead className="pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data ? (
              <TableLoading colSpan={COLS} />
            ) : !data?.items.length ? (
              <TableEmpty colSpan={COLS}>Ishtirokchilar topilmadi</TableEmpty>
            ) : (
              data.items.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/participants/${p.id}`)}
                >
                  <TableCell className="pl-4">
                    <div className="font-medium tabular-nums">
                      {p.phone ?? (
                        <span className="font-normal text-muted-foreground">
                          kontakt yo&apos;q
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      #{p.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    {[p.firstName, p.lastName].filter(Boolean).join(' ') || '—'}
                    {p.username && (
                      <div className="text-xs text-muted-foreground">
                        @{p.username}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.source ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.rulesAcceptedAt ? (
                      fmtDate(p.rulesAcceptedAt)
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        tugallanmagan
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p._count.receipts}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {p._count.coupons}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      {p.isStaff && <Badge variant="secondary">xodim</Badge>}
                      {p.isBlocked && (
                        <Badge variant="destructive">bloklangan</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {data && (
        <div className={loading ? 'opacity-60' : undefined}>
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}
