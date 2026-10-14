'use client';

import {
  RiAddLine,
  RiAlertLine,
  RiCalculatorLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiLoader4Line,
  RiMore2Fill,
  RiStore2Line,
} from '@remixicon/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DataTableCard } from '@/components/admin/data-table';
import { ErrorAlert, TableLoading, useLoad } from '@/components/admin/kit';
import {
  EmptyState,
  PageContainer,
  PageIntro,
} from '@/components/admin/layout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminApi } from '@/lib/api';
import { fmtShort, fmtSum } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Device {
  id: number;
  fm: string;
  legalName: string | null;
  stir: string | null;
  note: string | null;
}
interface Branch {
  id: number;
  name: string;
  brand: string | null;
  isActive: boolean;
  minSum: string;
  couponPrice: string;
  maxPerReceipt: number;
  iikoRef: { host?: string; department?: string } | null;
  devices: Device[];
}
interface UnknownFm {
  fm: string;
  firstSeen: string;
  lastSeen: string;
  hits: number;
}

type Run = (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>;
type EditorTab = 'general' | 'rule' | 'iiko' | 'devices';

/** 100000 → "100 000" (so'msiz) */
const fmtNum = (v: number | string) =>
  Math.round(Number(v)).toLocaleString('ru-RU').replace(/\s/g, ' ');
const hostLabel = (h?: string) => h?.replace(/^https?:\/\//, '') ?? '';

export default function BranchesPage() {
  const branches = useLoad(() => adminApi<Branch[]>('/branches'), []);
  const unknown = useLoad(() => adminApi<UnknownFm[]>('/unknown-fms'), []);
  const [adding, setAdding] = useState(false);
  const [editor, setEditor] = useState<{ id: number; tab: EditorTab } | null>(
    null,
  );
  const [toggling, setToggling] = useState<number | null>(null);

  const reloadAll = async () => {
    await Promise.all([branches.reload(), unknown.reload()]);
  };
  // Amal: muvaffaqiyat — toast, xato — toast.error; true/false qaytaradi
  const run: Run = async (fn, ok) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      await reloadAll();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    }
  };

  // Jadvaldagi «Aksiyada» — darhol saqlanadi (PATCH qisman: faqat isActive)
  const toggleActive = async (b: Branch, isActive: boolean) => {
    setToggling(b.id);
    await run(
      () =>
        adminApi(`/branches/${b.id}`, {
          method: 'PATCH',
          json: { isActive },
        }),
      isActive
        ? `${b.name} aksiyaga qo'shildi`
        : `${b.name} aksiyadan chiqarildi`,
    );
    setToggling(null);
  };

  const list = branches.data ?? [];
  const branchItems = list.map((b) => ({ value: String(b.id), label: b.name }));
  const editing = editor ? list.find((b) => b.id === editor.id) : undefined;
  const open = (id: number, tab: EditorTab = 'general') =>
    setEditor({ id, tab });

  return (
    <PageContainer size="wide">
      <PageIntro
        description="Filiallar, ularning kassalari (FM) va kupon qoidalari."
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <RiAddLine data-icon="inline-start" />
            Filial qo&apos;shish
          </Button>
        }
      />

      <ErrorAlert error={branches.error ?? unknown.error} />

      {!!unknown.data?.length && (
        <UnknownFms items={unknown.data} branchItems={branchItems} run={run} />
      )}

      <DataTableCard>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Filial</TableHead>
              <TableHead className="w-36">Holat</TableHead>
              <TableHead>Kupon qoidasi</TableHead>
              <TableHead className="w-28">Kassalar</TableHead>
              <TableHead>iiko</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.loading && !branches.data && (
              <TableLoading colSpan={6} rows={3} />
            )}
            {branches.data && !list.length && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState
                    icon={RiStore2Line}
                    title="Hali filial yo'q"
                    description="Filial qo'shing, so'ng uning kassalari va kupon qoidasini sozlang."
                    action={
                      <Button size="sm" onClick={() => setAdding(true)}>
                        <RiAddLine data-icon="inline-start" />
                        Filial qo&apos;shish
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {list.map((b) => (
              <TableRow
                key={b.id}
                tabIndex={0}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => open(b.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target === e.currentTarget)
                    open(b.id);
                }}
              >
                <TableCell>
                  <div className="font-medium">{b.name}</div>
                  {b.brand && (
                    <div className="text-xs text-muted-foreground">
                      {b.brand}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {/* Portal ichidagi hodisalar ham qatorga yetmasin */}
                  <div
                    className="flex w-fit items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Switch
                      size="sm"
                      checked={b.isActive}
                      disabled={toggling === b.id}
                      aria-label={`${b.name} aksiyada`}
                      onCheckedChange={(c) => void toggleActive(b, c)}
                    />
                    <span
                      className={cn(
                        'text-sm',
                        !b.isActive && 'text-muted-foreground',
                      )}
                    >
                      {b.isActive ? 'Aksiyada' : "O'chiq"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="tabular-nums">
                    {fmtSum(b.couponPrice)}{' '}
                    <span className="text-muted-foreground">/ kupon</span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    min {fmtNum(b.minSum)} · maks {b.maxPerReceipt} ta / chek
                  </div>
                </TableCell>
                <TableCell>
                  {b.devices.length ? (
                    <Badge variant="secondary" className="tabular-nums">
                      <RiCalculatorLine data-icon="inline-start" />
                      {b.devices.length}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="font-normal text-muted-foreground"
                    >
                      yo&apos;q
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-64">
                  {b.iikoRef?.department || b.iikoRef?.host ? (
                    <>
                      <div className="truncate">
                        {b.iikoRef.department ?? '—'}
                      </div>
                      {b.iikoRef.host && (
                        <div className="truncate text-xs text-muted-foreground">
                          {hostLabel(b.iikoRef.host)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Ulanmagan</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Amallar"
                          />
                        }
                      >
                        <RiMore2Fill />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => open(b.id)}>
                          <RiEdit2Line />
                          Tahrirlash
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => open(b.id, 'devices')}>
                          <RiCalculatorLine />
                          Kassalar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void toggleActive(b, !b.isActive)}
                        >
                          <RiStore2Line />
                          {b.isActive
                            ? 'Aksiyadan chiqarish'
                            : "Aksiyaga qo'shish"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableCard>

      <Sheet
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditor(null);
        }}
      >
        <SheetContent
          side="right"
          className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[560px]"
        >
          {editing && editor && (
            <BranchEditor
              key={editing.id}
              b={editing}
              initialTab={editor.tab}
              run={run}
              onClose={() => setEditor(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <NewBranchDialog open={adding} onOpenChange={setAdding} run={run} />
    </PageContainer>
  );
}

function UnknownFms({
  items,
  branchItems,
  run,
}: {
  items: UnknownFm[];
  branchItems: { value: string; label: string }[];
  run: Run;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-amber-500/40 bg-card">
      <div className="flex items-start gap-3 border-b bg-amber-500/5 px-4 py-3">
        <RiAlertLine className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            Noma&apos;lum FM&apos;lar
            <Badge variant="outline" className="tabular-nums">
              {items.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Bu kassalardan cheklar kelmoqda, lekin ular filialga
            bog&apos;lanmagan. Biriktirilgach, kutayotgan cheklar qayta
            ishlanadi.
          </p>
        </div>
      </div>
      <ul className="divide-y">
        {items.map((u) => (
          <li
            key={u.fm}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5"
          >
            <div className="grid gap-0.5">
              <span className="font-mono text-sm">{u.fm}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {u.hits} ta chek · oxirgi {fmtShort(u.lastSeen)}
              </span>
            </div>
            <Select
              items={branchItems}
              value={null}
              onValueChange={(v) => {
                const id = v as string | null;
                if (!id) return;
                void run(
                  () =>
                    adminApi(`/branches/${id}/devices`, {
                      method: 'POST',
                      json: { fm: u.fm },
                    }),
                  `${u.fm} bog'landi`,
                );
              }}
            >
              <SelectTrigger size="sm" className="w-full sm:w-56">
                <SelectValue placeholder="Filialga biriktirish" />
              </SelectTrigger>
              <SelectContent>
                {branchItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MoneyInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        // Ko'rinishda guruhlab ("100 000"), holatda faqat raqamlar
        value={value ? fmtNum(value) : ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
        className="tabular-nums"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>so&apos;m</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}

function BranchEditor({
  b,
  initialTab,
  run,
  onClose,
}: {
  b: Branch;
  initialTab: EditorTab;
  run: Run;
  onClose: () => void;
}) {
  const initial = {
    name: b.name,
    brand: b.brand ?? '',
    minSum: String(Math.round(Number(b.minSum))),
    couponPrice: String(Math.round(Number(b.couponPrice))),
    maxPerReceipt: String(b.maxPerReceipt),
    isActive: b.isActive,
    department: b.iikoRef?.department ?? '',
    host: b.iikoRef?.host ?? '',
  };
  const [f, setF] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [tab, setTab] = useState<EditorTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const set =
    (k: keyof typeof f) =>
    (v: string): void =>
      setF({ ...f, [k]: v });
  const num = (s: string) => Number(s.replace(/\s/g, ''));
  const id = (k: string) => `b${b.id}-${k}`;

  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const valid =
    !!f.name.trim() &&
    Number.isFinite(num(f.minSum)) &&
    num(f.couponPrice) > 0 &&
    Number.isInteger(num(f.maxPerReceipt)) &&
    num(f.maxPerReceipt) >= 1;

  const save = async () => {
    setBusy(true);
    const ok = await run(
      () =>
        adminApi(`/branches/${b.id}`, {
          method: 'PATCH',
          json: {
            name: f.name,
            brand: f.brand || null,
            minSum: num(f.minSum),
            couponPrice: num(f.couponPrice),
            maxPerReceipt: num(f.maxPerReceipt),
            isActive: f.isActive,
            iikoRef:
              f.department || f.host
                ? {
                    department: f.department || undefined,
                    host: f.host || undefined,
                  }
                : null,
          },
        }),
      `${f.name} saqlandi`,
    );
    setBusy(false);
    if (ok) setSaved(f);
  };

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle>{b.name}</SheetTitle>
        <SheetDescription>
          {b.brand ? `${b.brand} · ` : ''}
          {b.devices.length} ta kassa
        </SheetDescription>
      </SheetHeader>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as EditorTab)}
        className="min-h-0 flex-1 gap-0"
      >
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="general">Umumiy</TabsTrigger>
            <TabsTrigger value="rule">Kupon qoidasi</TabsTrigger>
            <TabsTrigger value="iiko">iiko</TabsTrigger>
            <TabsTrigger value="devices">
              Kassalar
              <span className="text-xs text-muted-foreground tabular-nums">
                {b.devices.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <TabsContent value="general">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={id('name')}>Nomi</FieldLabel>
                <Input
                  id={id('name')}
                  value={f.name}
                  onChange={(e) => set('name')(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={id('brand')}>Brend</FieldLabel>
                <Input
                  id={id('brand')}
                  value={f.brand}
                  placeholder="Masalan: Fazo"
                  onChange={(e) => set('brand')(e.target.value)}
                />
              </Field>
              <Field orientation="horizontal" className="rounded-lg border p-3">
                <FieldContent>
                  <FieldLabel htmlFor={id('active')}>Aksiyada</FieldLabel>
                  <FieldDescription>
                    O&apos;chirilsa, bu filial cheklari kupon bermaydi.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id={id('active')}
                  checked={f.isActive}
                  onCheckedChange={(c) => setF({ ...f, isActive: c })}
                />
              </Field>
            </FieldGroup>
          </TabsContent>

          <TabsContent value="rule">
            <FieldGroup>
              <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Natija: </span>
                har {fmtSum(num(f.couponPrice))} uchun 1 kupon, chek kamida{' '}
                {fmtSum(num(f.minSum))}, ko&apos;pi bilan{' '}
                {num(f.maxPerReceipt) || 0} ta kupon.
              </div>
              <Field>
                <FieldLabel htmlFor={id('min')}>Minimal chek</FieldLabel>
                <MoneyInput
                  id={id('min')}
                  value={f.minSum}
                  onChange={set('minSum')}
                />
                <FieldDescription>
                  Bundan kichik cheklar kupon bermaydi.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={id('price')}>1 kupon narxi</FieldLabel>
                <MoneyInput
                  id={id('price')}
                  value={f.couponPrice}
                  onChange={set('couponPrice')}
                />
                <FieldDescription>
                  Chek summasi shu songa bo&apos;linadi.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={id('max')}>Maks. kupon / chek</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={id('max')}
                    value={f.maxPerReceipt}
                    onChange={(e) => set('maxPerReceipt')(e.target.value)}
                    inputMode="numeric"
                    className="tabular-nums"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>ta</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <RiAlertLine className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                O&apos;zgarish faqat bundan keyin tasdiqlanadigan cheklarga
                ta&apos;sir qiladi.
              </p>
            </FieldGroup>
          </TabsContent>

          <TabsContent value="iiko">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={id('dep')}>Department</FieldLabel>
                <Input
                  id={id('dep')}
                  value={f.department}
                  placeholder="iiko'dagi bo'lim nomi"
                  onChange={(e) => set('department')(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={id('host')}>Server</FieldLabel>
                <Input
                  id={id('host')}
                  value={f.host}
                  placeholder="https://….iiko.it"
                  className="font-mono"
                  onChange={(e) => set('host')(e.target.value)}
                />
                <FieldDescription>
                  Ikkalasi ham bo&apos;sh bo&apos;lsa, iiko solishtiruvi
                  o&apos;chadi.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </TabsContent>

          <TabsContent value="devices" className="flex flex-col gap-4">
            <DevicesList devices={b.devices} run={run} />
            <AddDeviceForm branchId={b.id} run={run} />
          </TabsContent>
        </div>
      </Tabs>

      <SheetFooter className="flex-row items-center justify-end border-t">
        {tab === 'devices' && (
          <span className="mr-auto hidden text-xs text-muted-foreground sm:inline">
            Kassalar darhol saqlanadi
          </span>
        )}
        <Button variant="outline" onClick={onClose} disabled={busy}>
          Bekor qilish
        </Button>
        <Button disabled={busy || !dirty || !valid} onClick={() => void save()}>
          {busy && (
            <RiLoader4Line data-icon="inline-start" className="animate-spin" />
          )}
          Saqlash
        </Button>
      </SheetFooter>
    </>
  );
}

function DevicesList({ devices, run }: { devices: Device[]; run: Run }) {
  if (!devices.length)
    return (
      <div className="rounded-lg border border-dashed">
        <EmptyState
          className="py-8"
          icon={RiCalculatorLine}
          title="Kassa qo'shilmagan"
          description="Quyida FM raqamini kiriting — shu kassa cheklari filialga bog'lanadi."
        />
      </div>
    );

  return (
    <DataTableCard className="rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>FM</TableHead>
            <TableHead>Yuridik shaxs</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices.map((d) => (
            <TableRow key={d.id}>
              <TableCell>
                <div className="font-mono text-xs">{d.fm}</div>
                {d.note && (
                  <div className="text-xs text-muted-foreground">{d.note}</div>
                )}
              </TableCell>
              <TableCell>
                <div>{d.legalName ?? '—'}</div>
                {d.stir && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    STIR {d.stir}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="O'chirish"
                        className="text-muted-foreground hover:text-destructive"
                      />
                    }
                  >
                    <RiDeleteBinLine />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {d.fm} o&apos;chirilsinmi?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Bu kassadan keladigan cheklar yana noma&apos;lum FM
                        bo&apos;lib qoladi.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                      <AlertDialogAction
                        render={<Button variant="destructive" />}
                        onClick={() =>
                          void run(
                            () =>
                              adminApi(`/devices/${d.id}`, {
                                method: 'DELETE',
                              }),
                            "FM o'chirildi",
                          )
                        }
                      >
                        O&apos;chirish
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataTableCard>
  );
}

function AddDeviceForm({ branchId, run }: { branchId: number; run: Run }) {
  const [dev, setDev] = useState({ fm: '', legalName: '', stir: '', note: '' });
  const [busy, setBusy] = useState(false);
  const id = (k: string) => `dev${branchId}-${k}`;

  return (
    <form
      className="grid gap-3 rounded-lg border bg-muted/30 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await run(async () => {
          const res = await adminApi<{ released: number }>(
            `/branches/${branchId}/devices`,
            {
              method: 'POST',
              json: {
                ...dev,
                legalName: dev.legalName || null,
                stir: dev.stir || null,
                note: dev.note || null,
              },
            },
          );
          // Yuridik shaxs va STIR keyingi kassa uchun qoladi
          setDev({
            fm: '',
            legalName: dev.legalName,
            stir: dev.stir,
            note: '',
          });
          return res;
        }, "FM qo'shildi");
        setBusy(false);
      }}
    >
      <div className="text-sm font-medium">Kassa qo&apos;shish</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={id('fm')}>FM raqami</FieldLabel>
          <Input
            id={id('fm')}
            placeholder="LG42…"
            className="font-mono"
            value={dev.fm}
            onChange={(e) => setDev({ ...dev, fm: e.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={id('note')}>Izoh</FieldLabel>
          <Input
            id={id('note')}
            placeholder="Masalan: 1-kassa"
            value={dev.note}
            onChange={(e) => setDev({ ...dev, note: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={id('legal')}>Yuridik shaxs</FieldLabel>
          <Input
            id={id('legal')}
            placeholder="«…» MChJ"
            value={dev.legalName}
            onChange={(e) => setDev({ ...dev, legalName: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={id('stir')}>STIR</FieldLabel>
          <Input
            id={id('stir')}
            placeholder="9 raqam"
            inputMode="numeric"
            className="tabular-nums"
            value={dev.stir}
            onChange={(e) => setDev({ ...dev, stir: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={busy || dev.fm.trim().length < 6}
        >
          {busy ? (
            <RiLoader4Line data-icon="inline-start" className="animate-spin" />
          ) : (
            <RiAddLine data-icon="inline-start" />
          )}
          Qo&apos;shish
        </Button>
      </div>
    </form>
  );
}

function NewBranchDialog({
  open,
  onOpenChange,
  run,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  run: Run;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const ok = await run(
              () => adminApi('/branches', { method: 'POST', json: { name } }),
              `${name} qo'shildi`,
            );
            setBusy(false);
            if (ok) {
              setName('');
              onOpenChange(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Yangi filial</DialogTitle>
            <DialogDescription>
              Kupon qoidasi va kassalarni keyin sozlaysiz.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="new-branch-name">Filial nomi</FieldLabel>
            <Input
              id="new-branch-name"
              placeholder="Masalan: Fazo Chilonzor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && (
                <RiLoader4Line
                  data-icon="inline-start"
                  className="animate-spin"
                />
              )}
              Qo&apos;shish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
