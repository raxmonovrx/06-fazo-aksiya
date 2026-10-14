'use client';

import {
  RiAddLine,
  RiAlertLine,
  RiDeleteBinLine,
  RiSave3Line,
  RiStore2Line,
} from '@remixicon/react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  ErrorAlert,
  PageToolbar,
  TableEmpty,
  useLoad,
} from '@/components/admin/kit';
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
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/lib/api';
import { fmtDate, fmtSum } from '@/lib/format';

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

export default function BranchesPage() {
  const branches = useLoad(() => adminApi<Branch[]>('/branches'), []);
  const unknown = useLoad(() => adminApi<UnknownFm[]>('/unknown-fms'), []);
  const [adding, setAdding] = useState(false);

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

  const branchItems = (branches.data ?? []).map((b) => ({
    value: String(b.id),
    label: b.name,
  }));

  return (
    <div className="flex flex-col gap-4">
      <PageToolbar description="Filiallar, ularning kassalari (FM raqamlari) va kupon qoidalari.">
        <Button onClick={() => setAdding(true)}>
          <RiAddLine data-icon="inline-start" />
          Filial qo&apos;shish
        </Button>
      </PageToolbar>

      <ErrorAlert error={branches.error ?? unknown.error} />

      {!!unknown.data?.length && (
        <Card className="ring-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RiAlertLine className="size-4 text-destructive" />
              Noma&apos;lum FM&apos;lar
              <Badge variant="destructive">{unknown.data.length}</Badge>
            </CardTitle>
            <CardDescription>
              Shu kassalardan cheklar keldi, lekin ular hech qaysi filialga
              bog&apos;lanmagan. Filialni tanlang — moderatsiyada kutayotgan
              cheklar avtomatik qayta ishlanadi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>FM</TableHead>
                  <TableHead>Cheklar</TableHead>
                  <TableHead>Birinchi</TableHead>
                  <TableHead>Oxirgi</TableHead>
                  <TableHead className="w-56">Filialga bog&apos;lash</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unknown.data.map((u) => (
                  <TableRow key={u.fm}>
                    <TableCell className="font-mono">{u.fm}</TableCell>
                    <TableCell className="tabular-nums">{u.hits}</TableCell>
                    <TableCell>{fmtDate(u.firstSeen)}</TableCell>
                    <TableCell>{fmtDate(u.lastSeen)}</TableCell>
                    <TableCell>
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
                        <SelectTrigger className="w-full" size="sm">
                          <SelectValue placeholder="— filial —" />
                        </SelectTrigger>
                        <SelectContent>
                          {branchItems.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                              {i.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {branches.loading && !branches.data && (
        <>
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </>
      )}

      {branches.data && !branches.data.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
            <RiStore2Line className="size-6 opacity-60" />
            Hali filial qo&apos;shilmagan.
            <Button variant="outline" onClick={() => setAdding(true)}>
              <RiAddLine data-icon="inline-start" />
              Filial qo&apos;shish
            </Button>
          </CardContent>
        </Card>
      )}

      {branches.data?.map((b) => (
        <BranchCard key={b.id} b={b} run={run} />
      ))}

      <NewBranchDialog open={adding} onOpenChange={setAdding} run={run} />
    </div>
  );
}

function BranchCard({ b, run }: { b: Branch; run: Run }) {
  const [f, setF] = useState({
    name: b.name,
    brand: b.brand ?? '',
    minSum: String(Math.round(Number(b.minSum))),
    couponPrice: String(Math.round(Number(b.couponPrice))),
    maxPerReceipt: String(b.maxPerReceipt),
    isActive: b.isActive,
    department: b.iikoRef?.department ?? '',
    host: b.iikoRef?.host ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  const num = (s: string) => Number(s.replace(/\s/g, ''));
  const id = (k: string) => `b${b.id}-${k}`;

  const save = () =>
    run(
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {b.name}
          {b.isActive ? (
            <Badge variant="secondary">aksiyada</Badge>
          ) : (
            <Badge variant="outline">aksiyada emas</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {b.brand ? `${b.brand} · ` : ''}
          {b.devices.length} ta kassa
        </CardDescription>
        <CardAction>
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel htmlFor={id('active')} className="text-xs">
              Aksiyada qatnashadi
            </FieldLabel>
            <Switch
              id={id('active')}
              checked={f.isActive}
              onCheckedChange={(c) => setF({ ...f, isActive: c })}
            />
          </Field>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={id('name')}>Nomi</FieldLabel>
            <Input id={id('name')} value={f.name} onChange={set('name')} />
          </Field>
          <Field>
            <FieldLabel htmlFor={id('brand')}>Brend</FieldLabel>
            <Input id={id('brand')} value={f.brand} onChange={set('brand')} />
          </Field>
        </FieldGroup>

        {/* Chegara div'da — fieldset'da bo'lsa legend chiziq ustida chiziladi */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <FieldSet>
            <FieldLegend>Kupon qoidasi</FieldLegend>
            <FieldDescription>
              Qoida o&apos;zgarishi faqat keyingi tasdiqlanadigan cheklarga
              ta&apos;sir qiladi.
            </FieldDescription>
            <FieldGroup className="grid gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor={id('min')}>Minimal chek</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={id('min')}
                    value={f.minSum}
                    onChange={set('minSum')}
                    inputMode="numeric"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>so&apos;m</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  min_sum · {fmtSum(num(f.minSum))}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={id('price')}>1 kupon narxi</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={id('price')}
                    value={f.couponPrice}
                    onChange={set('couponPrice')}
                    inputMode="numeric"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>so&apos;m</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  coupon_price · {fmtSum(num(f.couponPrice))}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor={id('max')}>Maks. kupon / chek</FieldLabel>
                <Input
                  id={id('max')}
                  value={f.maxPerReceipt}
                  onChange={set('maxPerReceipt')}
                  inputMode="numeric"
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        </div>

        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={id('dep')}>iiko department</FieldLabel>
            <Input
              id={id('dep')}
              value={f.department}
              onChange={set('department')}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={id('host')}>iiko server</FieldLabel>
            <Input id={id('host')} value={f.host} onChange={set('host')} />
          </Field>
        </FieldGroup>

        <div className="flex justify-end">
          <Button onClick={() => void save()}>
            <RiSave3Line data-icon="inline-start" />
            Saqlash
          </Button>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        <div className="text-sm font-medium">Kassalar (FM raqamlari)</div>
        <DevicesTable devices={b.devices} run={run} />
        <AddDeviceForm branchId={b.id} run={run} />
      </CardFooter>
    </Card>
  );
}

function DevicesTable({ devices, run }: { devices: Device[]; run: Run }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>FM</TableHead>
            <TableHead>Yuridik shaxs</TableHead>
            <TableHead>STIR</TableHead>
            <TableHead>Izoh</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!devices.length && (
            <TableEmpty colSpan={5}>Kassa qo&apos;shilmagan</TableEmpty>
          )}
          {devices.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-mono">{d.fm}</TableCell>
              <TableCell>{d.legalName ?? '—'}</TableCell>
              <TableCell className="tabular-nums">{d.stir ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">
                {d.note ?? ''}
              </TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="O'chirish"
                        className="text-destructive hover:text-destructive"
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
    </div>
  );
}

function AddDeviceForm({ branchId, run }: { branchId: number; run: Run }) {
  const [dev, setDev] = useState({ fm: '', legalName: '', stir: '', note: '' });

  return (
    <form
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
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
      }}
    >
      <Input
        aria-label="FM"
        placeholder="FM (LG42…)"
        className="font-mono"
        value={dev.fm}
        onChange={(e) => setDev({ ...dev, fm: e.target.value })}
        required
      />
      <Input
        aria-label="Yuridik shaxs"
        placeholder="Yuridik shaxs"
        value={dev.legalName}
        onChange={(e) => setDev({ ...dev, legalName: e.target.value })}
      />
      <Input
        aria-label="STIR"
        placeholder="STIR"
        inputMode="numeric"
        value={dev.stir}
        onChange={(e) => setDev({ ...dev, stir: e.target.value })}
      />
      <Input
        aria-label="Izoh"
        placeholder="Izoh (masalan: 1-kassa)"
        value={dev.note}
        onChange={(e) => setDev({ ...dev, note: e.target.value })}
      />
      <Button
        type="submit"
        variant="secondary"
        className="sm:col-span-2 lg:col-span-1"
      >
        <RiAddLine data-icon="inline-start" />
        FM qo&apos;shish
      </Button>
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
              Qoidalar va kassalarni qo&apos;shilgandan keyin sozlaysiz.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="new-branch-name">Filial nomi</FieldLabel>
            <FieldContent>
              <Input
                id="new-branch-name"
                placeholder="Filial nomi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </FieldContent>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              Qo&apos;shish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
