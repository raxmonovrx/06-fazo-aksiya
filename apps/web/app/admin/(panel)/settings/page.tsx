'use client';

import {
  RiKey2Line,
  RiLoader4Line,
  RiUserAddLine,
  RiUserFollowLine,
  RiUserForbidLine,
} from '@remixicon/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import {
  ErrorAlert,
  TableEmpty,
  TableLoading,
  useLoad,
} from '@/components/admin/kit';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { DateTimePicker } from '@/components/ui/date-time-picker';
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
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
import { Textarea } from '@/components/ui/textarea';
import { adminApi } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { useAdmin } from '../admin-context';

interface Campaign {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string | null;
  receiptWindowHours: number;
  rulesText: string;
}
interface User {
  id: number;
  login: string;
  role: 'ADMIN' | 'OPERATOR';
  isActive: boolean;
  createdAt: string;
}

const ROLES = [
  { value: 'OPERATOR', label: 'Operator' },
  { value: 'ADMIN', label: 'Admin' },
];

// DateTimePicker qiymati (YYYY-MM-DDTHH:mm) Toshkent vaqti sifatida
const toLocal = (iso: string | null) =>
  iso
    ? new Date(new Date(iso).getTime() + 5 * 3600_000)
        .toISOString()
        .slice(0, 16)
    : '';
const fromLocal = (v: string) => (v ? `${v}:00+05:00` : null);

const EMPTY_USER = { login: '', password: '', role: 'OPERATOR' };

export default function SettingsPage() {
  const me = useAdmin();
  const campaign = useLoad(() => adminApi<Campaign>('/settings/campaign'), []);
  const users = useLoad(() => adminApi<User[]>('/users'), []);
  const [f, setF] = useState({
    name: '',
    startsAt: '',
    endsAt: '',
    receiptWindowHours: '72',
    rulesText: '',
  });
  const [nu, setNu] = useState(EMPTY_USER);
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [toggleUser, setToggleUser] = useState<User | null>(null);
  const [pwUser, setPwUser] = useState<User | null>(null);
  const [newPw, setNewPw] = useState('');

  useEffect(() => {
    const c = campaign.data;
    if (c)
      setF({
        name: c.name,
        startsAt: toLocal(c.startsAt),
        endsAt: toLocal(c.endsAt),
        receiptWindowHours: String(c.receiptWindowHours),
        rulesText: c.rulesText,
      });
  }, [campaign.data]);

  /** Amalni bajaradi; muvaffaqiyatda toast + qayta yuklash, true qaytaradi */
  const run = async (
    key: string,
    fn: () => Promise<unknown>,
    ok: string,
  ): Promise<boolean> => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await Promise.all([campaign.reload(), users.reload()]);
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveCampaign = () =>
    run(
      'campaign',
      () =>
        adminApi('/settings/campaign', {
          method: 'PATCH',
          json: {
            name: f.name,
            startsAt: fromLocal(f.startsAt),
            endsAt: fromLocal(f.endsAt),
            receiptWindowHours: Number(f.receiptWindowHours),
            rulesText: f.rulesText,
          },
        }),
      'Aksiya sozlamalari saqlandi',
    );

  const toggleActive = (u: User) =>
    run(
      `toggle-${u.id}`,
      () =>
        adminApi(`/users/${u.id}`, {
          method: 'PATCH',
          json: { isActive: !u.isActive },
        }),
      'Saqlandi',
    );

  return (
    <div className="flex flex-col gap-4">
      <ErrorAlert error={campaign.error ?? users.error} />

      {/* Aksiya sozlamalari */}
      <Card>
        <CardHeader>
          <CardTitle>Aksiya</CardTitle>
          <CardDescription>
            Aksiya muddati, chek qabul qilish oynasi va qoidalar matni
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="campaign-form"
            onSubmit={(e) => {
              e.preventDefault();
              void saveCampaign();
            }}
          >
            <FieldGroup>
              <div className="grid gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="c-name">Nomi</FieldLabel>
                  <Input
                    id="c-name"
                    value={f.name}
                    onChange={(e) => setF({ ...f, name: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="c-window">Chek oynasi (soat)</FieldLabel>
                  <Input
                    id="c-window"
                    value={f.receiptWindowHours}
                    onChange={(e) =>
                      setF({ ...f, receiptWindowHours: e.target.value })
                    }
                    inputMode="numeric"
                  />
                  <FieldDescription>
                    Chek shu vaqt ichida qo&apos;shilishi kerak
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="c-start">
                    Boshlanishi (Toshkent)
                  </FieldLabel>
                  <DateTimePicker
                    id="c-start"
                    value={f.startsAt}
                    onChange={(v) => setF({ ...f, startsAt: v })}
                  />
                  <FieldDescription>
                    Bundan oldingi cheklar qabul qilinmaydi
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="c-end">Tugashi (ixtiyoriy)</FieldLabel>
                  <DateTimePicker
                    id="c-end"
                    value={f.endsAt}
                    onChange={(v) => setF({ ...f, endsAt: v })}
                    defaultTime="23:59"
                    clearable
                  />
                  <FieldDescription>
                    Bo&apos;sh qoldirilsa — muddatsiz
                  </FieldDescription>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="c-rules">Qoidalar matni</FieldLabel>
                <Textarea
                  id="c-rules"
                  rows={10}
                  value={f.rulesText}
                  onChange={(e) => setF({ ...f, rulesText: e.target.value })}
                />
                <FieldDescription>
                  Bot va mini app&apos;da ko&apos;rinadi
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="submit"
            form="campaign-form"
            disabled={busy === 'campaign' || !campaign.data}
          >
            {busy === 'campaign' && (
              <RiLoader4Line
                data-icon="inline-start"
                className="animate-spin"
              />
            )}
            Saqlash
          </Button>
        </CardFooter>
      </Card>

      {/* Admin foydalanuvchilar */}
      <Card>
        <CardHeader>
          <CardTitle>Admin foydalanuvchilar</CardTitle>
          <CardDescription>
            Panelga kira oladigan xodimlar, ularning roli va holati
          </CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <RiUserAddLine data-icon="inline-start" />
              Qo&apos;shish
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Login</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Holat</TableHead>
                <TableHead>Yaratilgan</TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.loading && !users.data && <TableLoading colSpan={5} />}
              {users.data?.length === 0 && <TableEmpty colSpan={5} />}
              {users.data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.login}
                    {u.id === me.id && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (siz)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.role === 'ADMIN' ? 'default' : 'secondary'}
                    >
                      {u.role === 'ADMIN' ? 'Admin' : 'Operator'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="outline">faol</Badge>
                    ) : (
                      <Badge variant="destructive">o&apos;chirilgan</Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {fmtDate(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setNewPw('');
                          setPwUser(u);
                        }}
                      >
                        <RiKey2Line data-icon="inline-start" />
                        Parol
                      </Button>
                      {u.id !== me.id &&
                        (u.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={busy === `toggle-${u.id}`}
                            onClick={() => setToggleUser(u)}
                          >
                            <RiUserForbidLine data-icon="inline-start" />
                            O&apos;chirish
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy === `toggle-${u.id}`}
                            onClick={() => void toggleActive(u)}
                          >
                            <RiUserFollowLine data-icon="inline-start" />
                            Yoqish
                          </Button>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Yangi foydalanuvchi */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setNu(EMPTY_USER);
        }}
      >
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await run(
                'add',
                () => adminApi('/users', { method: 'POST', json: nu }),
                "Foydalanuvchi qo'shildi",
              );
              if (ok) {
                setNu(EMPTY_USER);
                setAddOpen(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Admin qo&apos;shish</DialogTitle>
              <DialogDescription>
                Yangi foydalanuvchi panelga shu login va parol bilan kiradi
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="nu-login">Login</FieldLabel>
                <Input
                  id="nu-login"
                  value={nu.login}
                  onChange={(e) => setNu({ ...nu, login: e.target.value })}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="nu-password">Parol</FieldLabel>
                <PasswordInput
                  id="nu-password"
                  value={nu.password}
                  onChange={(e) => setNu({ ...nu, password: e.target.value })}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <FieldDescription>Kamida 8 belgi</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="nu-role">Rol</FieldLabel>
                <Select
                  items={ROLES}
                  value={nu.role || null}
                  onValueChange={(v) =>
                    setNu({ ...nu, role: (v as string | null) ?? 'OPERATOR' })
                  }
                >
                  <SelectTrigger id="nu-role" className="w-full">
                    <SelectValue placeholder="Rolni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
              >
                Bekor qilish
              </Button>
              <Button type="submit" disabled={busy === 'add'}>
                {busy === 'add' && (
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

      {/* Parolni almashtirish */}
      <Dialog
        open={pwUser !== null}
        onOpenChange={(o) => {
          if (!o) setPwUser(null);
        }}
      >
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pwUser || !newPw) return;
              const ok = await run(
                'password',
                () =>
                  adminApi(`/users/${pwUser.id}`, {
                    method: 'PATCH',
                    json: { password: newPw },
                  }),
                'Parol yangilandi',
              );
              if (ok) setPwUser(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>Yangi parol</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">
                  {pwUser?.login}
                </span>{' '}
                uchun yangi parol (kamida 8 belgi)
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="pw-new">Parol</FieldLabel>
              <PasswordInput
                id="pw-new"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                autoFocus
                required
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwUser(null)}
              >
                Bekor qilish
              </Button>
              <Button type="submit" disabled={busy === 'password' || !newPw}>
                {busy === 'password' && (
                  <RiLoader4Line
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                )}
                Saqlash
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* O'chirishni tasdiqlash */}
      <AlertDialog
        open={toggleUser !== null}
        onOpenChange={(o) => {
          if (!o) setToggleUser(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Foydalanuvchini o&apos;chirasizmi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">
                {toggleUser?.login}
              </span>{' '}
              panelga kira olmaydi. Keyin qayta yoqish mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                const u = toggleUser;
                setToggleUser(null);
                if (u) void toggleActive(u);
              }}
            >
              O&apos;chirish
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
