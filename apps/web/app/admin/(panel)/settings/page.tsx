'use client';

import {
  RiCheckLine,
  RiKey2Line,
  RiLoader4Line,
  RiMore2Fill,
  RiShieldUserLine,
  RiTeamLine,
  RiUserAddLine,
  RiUserFollowLine,
  RiUserForbidLine,
} from '@remixicon/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { DataTableCard } from '@/components/admin/data-table';
import { ErrorAlert, TableLoading, useLoad } from '@/components/admin/kit';
import {
  Dot,
  EmptyState,
  PageContainer,
  SettingsSection,
} from '@/components/admin/layout';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAdmin } from '../admin-context';

interface Campaign {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string | null;
  receiptWindowHours: number;
  rulesText: string;
}
type Role = 'ADMIN' | 'OPERATOR';
interface User {
  id: number;
  login: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const ROLES: Array<{ value: Role; label: string; description: string }> = [
  {
    value: 'OPERATOR',
    label: 'Operator',
    description: 'Cheklar, moderatsiya va ishtirokchilar bilan ishlaydi',
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    description: "To'liq kirish: sozlamalar, filiallar, import, adminlar",
  },
];
const roleLabel = (r: Role) => (r === 'ADMIN' ? 'Admin' : 'Operator');

const RULES_MAX = 20_000;
const WINDOW_MAX = 24 * 30;
const LOGIN_RE = /^[a-z0-9._-]{3,32}$/i;

// DateTimePicker qiymati (YYYY-MM-DDTHH:mm) Toshkent vaqti sifatida
const toLocal = (iso: string | null) =>
  iso
    ? new Date(new Date(iso).getTime() + 5 * 3600_000)
        .toISOString()
        .slice(0, 16)
    : '';
const fromLocal = (v: string) => (v ? `${v}:00+05:00` : null);

type General = {
  name: string;
  startsAt: string;
  endsAt: string;
  receiptWindowHours: string;
};
const generalOf = (c: Campaign): General => ({
  name: c.name,
  startsAt: toLocal(c.startsAt),
  endsAt: toLocal(c.endsAt),
  receiptWindowHours: String(c.receiptWindowHours),
});
const sameGeneral = (a: General, b: General) =>
  a.name === b.name &&
  a.startsAt === b.startsAt &&
  a.endsAt === b.endsAt &&
  a.receiptWindowHours === b.receiptWindowHours;

const EMPTY_GENERAL: General = {
  name: '',
  startsAt: '',
  endsAt: '',
  receiptWindowHours: '',
};
const EMPTY_USER = { login: '', password: '', role: 'OPERATOR' as Role };

const num = (n: number) => n.toLocaleString('ru-RU').replace(/\s/g, ' ');

/** Login → avatar uchun 1–2 harf */
const initials = (login: string) => {
  const parts = login.split(/[._-]+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : login.slice(0, 2);
  return s.toUpperCase();
};

/** Parol kuchi — oddiy taxmin (uzunlik + belgi turlari) */
function passwordStrength(p: string) {
  if (!p) return null;
  if (p.length < 8)
    return { level: 0, label: `Yana ${8 - p.length} ta belgi kerak` };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) =>
    r.test(p),
  ).length;
  const score = kinds + (p.length >= 12 ? 1 : 0);
  if (score >= 4) return { level: 3, label: 'Kuchli parol' };
  if (score >= 3) return { level: 2, label: "O'rtacha parol" };
  return { level: 1, label: 'Zaif — harf, raqam va belgini aralashtiring' };
}

function StrengthHint({ password }: { password: string }) {
  const s = passwordStrength(password);
  if (!s) return <FieldDescription>Kamida 8 belgi</FieldDescription>;
  const color = ['bg-red-500', 'bg-amber-500', 'bg-sky-500', 'bg-emerald-500'][
    s.level
  ];
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-3 gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1 rounded-full',
              s.level >= i || (s.level === 0 && i === 1) ? color : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{s.label}</p>
    </div>
  );
}

function SaveButton({
  busy,
  disabled,
  form,
}: {
  busy: boolean;
  disabled: boolean;
  form: string;
}) {
  return (
    <Button type="submit" size="sm" form={form} disabled={busy || disabled}>
      {busy && (
        <RiLoader4Line data-icon="inline-start" className="animate-spin" />
      )}
      Saqlash
    </Button>
  );
}

export default function SettingsPage() {
  const me = useAdmin();
  const campaign = useLoad(() => adminApi<Campaign>('/settings/campaign'), []);
  const users = useLoad(() => adminApi<User[]>('/users'), []);

  const [gen, setGen] = useState<General>(EMPTY_GENERAL);
  const [rules, setRules] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [nu, setNu] = useState(EMPTY_USER);
  const [toggleUser, setToggleUser] = useState<User | null>(null);
  const [pwUser, setPwUser] = useState<User | null>(null);
  const [newPw, setNewPw] = useState('');

  // Birinchi yuklanishda formalarni to'ldiramiz. Keyin har bir bo'lim
  // faqat o'zi saqlanganda yangilanadi — boshqa bo'limdagi tahrir yo'qolmaydi.
  const [inited, setInited] = useState(false);
  useEffect(() => {
    const c = campaign.data;
    if (c && !inited) {
      setGen(generalOf(c));
      setRules(c.rulesText);
      setInited(true);
    }
  }, [campaign.data, inited]);

  const c = campaign.data;
  const genDirty = !!c && !sameGeneral(gen, generalOf(c));
  const rulesDirty = !!c && rules !== c.rulesText;

  // Aksiya bo'limi tekshiruvi
  const hours = Number(gen.receiptWindowHours);
  const windowErr =
    !gen.receiptWindowHours ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    hours > WINDOW_MAX
      ? `1 dan ${WINDOW_MAX} gacha butun son`
      : null;
  const nameErr = !gen.name.trim() ? 'Nomini kiriting' : null;
  const startErr = !gen.startsAt ? 'Boshlanish vaqtini tanlang' : null;
  const endErr =
    gen.endsAt && gen.startsAt && gen.endsAt <= gen.startsAt
      ? 'Tugash boshlanishdan keyin bo‘lsin'
      : null;
  const genInvalid = !!(windowErr || nameErr || startErr || endErr);
  const rulesInvalid = rules.length > RULES_MAX;

  /** Kampaniyani qisman saqlaydi (API barcha maydonlarni ixtiyoriy qabul qiladi) */
  const patchCampaign = async (
    key: string,
    json: Partial<Record<keyof Campaign, unknown>>,
    after: (u: Campaign) => void,
  ) => {
    setBusy(key);
    try {
      const updated = await adminApi<Campaign>('/settings/campaign', {
        method: 'PATCH',
        json,
      });
      campaign.setData(updated);
      after(updated);
      toast.success('Saqlandi');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveGeneral = () =>
    patchCampaign(
      'general',
      {
        name: gen.name.trim(),
        startsAt: fromLocal(gen.startsAt),
        endsAt: fromLocal(gen.endsAt),
        receiptWindowHours: hours,
      },
      (u) => setGen(generalOf(u)),
    );

  const saveRules = () =>
    patchCampaign('rules', { rulesText: rules }, (u) => setRules(u.rulesText));

  /** Foydalanuvchi amali; muvaffaqiyatda toast + ro'yxatni yangilash */
  const runUser = async (
    key: string,
    fn: () => Promise<unknown>,
    ok: string,
  ): Promise<boolean> => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await users.reload();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const patchUser = (u: User, json: Record<string, unknown>, ok: string) =>
    runUser(
      `user-${u.id}`,
      () => adminApi(`/users/${u.id}`, { method: 'PATCH', json }),
      ok,
    );

  const nuLoginErr =
    nu.login && !LOGIN_RE.test(nu.login.trim())
      ? '3–32 belgi: lotin harf, raqam, . _ -'
      : null;
  const nuValid =
    LOGIN_RE.test(nu.login.trim()) && nu.password.length >= 8 && !!nu.role;

  return (
    <PageContainer size="narrow" className="gap-8">
      <ErrorAlert error={campaign.error} />

      {/* ——— Aksiya ——— */}
      <SettingsSection
        title="Aksiya"
        description="Aksiya nomi, muddati va chek qabul qilinadigan vaqt oralig'i."
      >
        <Card>
          <CardContent>
            {!c && !campaign.error ? (
              <FormSkeleton />
            ) : (
              <form
                id="general-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (genDirty && !genInvalid) void saveGeneral();
                }}
              >
                <FieldGroup className="gap-5">
                  <Field data-invalid={!!nameErr || undefined}>
                    <FieldLabel htmlFor="c-name">Nomi</FieldLabel>
                    <Input
                      id="c-name"
                      value={gen.name}
                      maxLength={100}
                      aria-invalid={!!nameErr || undefined}
                      onChange={(e) => setGen({ ...gen, name: e.target.value })}
                    />
                    {nameErr && <FieldError>{nameErr}</FieldError>}
                  </Field>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field data-invalid={!!startErr || undefined}>
                      <FieldLabel htmlFor="c-start">Boshlanishi</FieldLabel>
                      <DateTimePicker
                        id="c-start"
                        value={gen.startsAt}
                        onChange={(v) => setGen({ ...gen, startsAt: v })}
                      />
                      {startErr ? (
                        <FieldError>{startErr}</FieldError>
                      ) : (
                        <FieldDescription>
                          Bundan oldingi cheklar qabul qilinmaydi
                        </FieldDescription>
                      )}
                    </Field>
                    <Field data-invalid={!!endErr || undefined}>
                      <FieldLabel htmlFor="c-end">Tugashi</FieldLabel>
                      <DateTimePicker
                        id="c-end"
                        value={gen.endsAt}
                        onChange={(v) => setGen({ ...gen, endsAt: v })}
                        defaultTime="23:59"
                        clearable
                      />
                      {endErr ? (
                        <FieldError>{endErr}</FieldError>
                      ) : (
                        <FieldDescription>
                          Bo&apos;sh bo&apos;lsa — muddatsiz
                        </FieldDescription>
                      )}
                    </Field>
                  </div>

                  <Field data-invalid={!!windowErr || undefined}>
                    <FieldLabel htmlFor="c-window">Chek oynasi</FieldLabel>
                    <InputGroup className="w-full max-w-40">
                      <InputGroupInput
                        id="c-window"
                        value={gen.receiptWindowHours}
                        inputMode="numeric"
                        aria-invalid={!!windowErr || undefined}
                        className="tabular-nums"
                        onChange={(e) =>
                          setGen({
                            ...gen,
                            receiptWindowHours: e.target.value.replace(
                              /\D/g,
                              '',
                            ),
                          })
                        }
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>soat</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    {windowErr ? (
                      <FieldError>{windowErr}</FieldError>
                    ) : (
                      <FieldDescription>
                        Chek xariddan keyin shu vaqt ichida yuborilishi kerak
                        {hours >= 24 && hours % 24 === 0 && (
                          <> ({hours / 24} kun)</>
                        )}
                      </FieldDescription>
                    )}
                  </Field>
                </FieldGroup>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Vaqtlar Toshkent bo&apos;yicha (UTC+5)
            </p>
            <div className="flex items-center gap-2">
              {genDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => c && setGen(generalOf(c))}
                >
                  Bekor qilish
                </Button>
              )}
              <SaveButton
                form="general-form"
                busy={busy === 'general'}
                disabled={!genDirty || genInvalid}
              />
            </div>
          </CardFooter>
        </Card>
      </SettingsSection>

      {/* ——— Qoidalar ——— */}
      <SettingsSection
        title="Qoidalar matni"
        description="Ishtirokchi aksiyaga qo'shilishdan oldin shu matnni ko'radi va qabul qiladi."
      >
        <Card>
          <CardContent>
            {!c && !campaign.error ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <form
                id="rules-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (rulesDirty && !rulesInvalid) void saveRules();
                }}
              >
                <Field data-invalid={rulesInvalid || undefined}>
                  <FieldLabel htmlFor="c-rules" className="sr-only">
                    Qoidalar matni
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupTextarea
                      id="c-rules"
                      rows={12}
                      value={rules}
                      aria-invalid={rulesInvalid || undefined}
                      className="max-h-[480px] min-h-48 resize-y overflow-y-auto leading-relaxed"
                      onChange={(e) => setRules(e.target.value)}
                    />
                    <InputGroupAddon
                      align="block-end"
                      className="justify-end border-t"
                    >
                      <InputGroupText
                        className={cn(
                          'text-xs tabular-nums',
                          rulesInvalid && 'text-destructive',
                        )}
                      >
                        {num(rules.length)} / {num(RULES_MAX)}
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  {rulesInvalid && (
                    <FieldError>Matn juda uzun — qisqartiring</FieldError>
                  )}
                </Field>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Bot va mini app&apos;da ko&apos;rinadi
            </p>
            <div className="flex items-center gap-2">
              {rulesDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => c && setRules(c.rulesText)}
                >
                  Bekor qilish
                </Button>
              )}
              <SaveButton
                form="rules-form"
                busy={busy === 'rules'}
                disabled={!rulesDirty || rulesInvalid}
              />
            </div>
          </CardFooter>
        </Card>
      </SettingsSection>

      {/* ——— Adminlar ——— */}
      <SettingsSection
        title="Adminlar"
        description={
          <>
            Panelga kira oladigan xodimlar.
            <span className="mt-3 grid gap-2">
              {ROLES.slice()
                .reverse()
                .map((r) => (
                  <span key={r.value} className="grid gap-0.5">
                    <span className="text-xs font-medium text-foreground">
                      {r.label}
                    </span>
                    <span className="text-xs">{r.description}</span>
                  </span>
                ))}
            </span>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {users.data ? (
                <>
                  <span className="text-foreground tabular-nums">
                    {users.data.filter((u) => u.isActive).length}
                  </span>{' '}
                  ta faol foydalanuvchi
                </>
              ) : (
                ' '
              )}
            </p>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <RiUserAddLine data-icon="inline-start" />
              Admin qo&apos;shish
            </Button>
          </div>

          <ErrorAlert error={users.error} />

          <DataTableCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Foydalanuvchi</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Holat</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Qo&apos;shilgan
                  </TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Amallar</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.loading && !users.data && (
                  <TableLoading colSpan={5} rows={3} />
                )}
                {users.data?.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={RiTeamLine}
                        title="Foydalanuvchi yo'q"
                        description="Panelga kiradigan birinchi xodimni qo'shing"
                      />
                    </TableCell>
                  </TableRow>
                )}
                {users.data?.map((u) => {
                  const isMe = u.id === me.id;
                  const rowBusy = busy === `user-${u.id}`;
                  return (
                    <TableRow
                      key={u.id}
                      className={cn(!u.isActive && 'text-muted-foreground')}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar size="sm">
                            <AvatarFallback className="text-[10px] font-medium">
                              {initials(u.login)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {u.login}
                            {isMe && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                (siz)
                              </span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.role === 'ADMIN' ? 'secondary' : 'outline'}
                          className="font-normal"
                        >
                          {u.role === 'ADMIN' && <RiShieldUserLine />}
                          {roleLabel(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Dot
                            className={
                              u.isActive ? 'bg-emerald-500' : 'bg-zinc-400'
                            }
                          />
                          {u.isActive ? 'Faol' : "O'chirilgan"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                        {fmtDate(u.createdAt, false)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`${u.login} amallari`}
                                disabled={rowBusy}
                              />
                            }
                          >
                            {rowBusy ? (
                              <RiLoader4Line className="animate-spin" />
                            ) : (
                              <RiMore2Fill />
                            )}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>{u.login}</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => {
                                  setNewPw('');
                                  setPwUser(u);
                                }}
                              >
                                <RiKey2Line />
                                Parolni almashtirish
                              </DropdownMenuItem>
                              {!isMe && (
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <RiShieldUserLine />
                                    Rol
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="w-40">
                                    <DropdownMenuRadioGroup
                                      value={u.role}
                                      onValueChange={(v) => {
                                        if (v !== u.role)
                                          void patchUser(
                                            u,
                                            { role: v },
                                            `Rol: ${roleLabel(v as Role)}`,
                                          );
                                      }}
                                    >
                                      {ROLES.map((r) => (
                                        <DropdownMenuRadioItem
                                          key={r.value}
                                          value={r.value}
                                        >
                                          {r.label}
                                        </DropdownMenuRadioItem>
                                      ))}
                                    </DropdownMenuRadioGroup>
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                              )}
                            </DropdownMenuGroup>
                            {!isMe && (
                              <>
                                <DropdownMenuSeparator />
                                {u.isActive ? (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setToggleUser(u)}
                                  >
                                    <RiUserForbidLine />
                                    O&apos;chirish
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void patchUser(
                                        u,
                                        { isActive: true },
                                        'Foydalanuvchi yoqildi',
                                      )
                                    }
                                  >
                                    <RiUserFollowLine />
                                    Yoqish
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DataTableCard>
        </div>
      </SettingsSection>

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
            className="grid gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!nuValid) return;
              const ok = await runUser(
                'add',
                () =>
                  adminApi('/users', {
                    method: 'POST',
                    json: { ...nu, login: nu.login.trim() },
                  }),
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
                Xodim panelga shu login va parol bilan kiradi.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="gap-4">
              <Field data-invalid={!!nuLoginErr || undefined}>
                <FieldLabel htmlFor="nu-login">Login</FieldLabel>
                <Input
                  id="nu-login"
                  value={nu.login}
                  onChange={(e) => setNu({ ...nu, login: e.target.value })}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="masalan, aziz.k"
                  aria-invalid={!!nuLoginErr || undefined}
                  autoFocus
                />
                {nuLoginErr ? (
                  <FieldError>{nuLoginErr}</FieldError>
                ) : (
                  <FieldDescription>
                    Lotin harf, raqam va . _ - belgilari
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="nu-password">Parol</FieldLabel>
                <PasswordInput
                  id="nu-password"
                  value={nu.password}
                  onChange={(e) => setNu({ ...nu, password: e.target.value })}
                  autoComplete="new-password"
                />
                <StrengthHint password={nu.password} />
              </Field>
              <Field>
                <FieldLabel htmlFor="nu-role">Rol</FieldLabel>
                <Select
                  items={ROLES}
                  value={nu.role}
                  onValueChange={(v) =>
                    setNu({ ...nu, role: (v as Role | null) ?? 'OPERATOR' })
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
                <FieldDescription>
                  {ROLES.find((r) => r.value === nu.role)?.description}
                </FieldDescription>
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
              <Button type="submit" disabled={busy === 'add' || !nuValid}>
                {busy === 'add' ? (
                  <RiLoader4Line
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <RiCheckLine data-icon="inline-start" />
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
            className="grid gap-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pwUser || newPw.length < 8) return;
              const ok = await runUser(
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
              <DialogTitle>Parolni almashtirish</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">
                  {pwUser?.login}
                </span>{' '}
                keyingi kirishda yangi paroldan foydalanadi.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="pw-new">Yangi parol</FieldLabel>
              <PasswordInput
                id="pw-new"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
              <StrengthHint password={newPw} />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwUser(null)}
              >
                Bekor qilish
              </Button>
              <Button
                type="submit"
                disabled={busy === 'password' || newPw.length < 8}
              >
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
                if (u)
                  void patchUser(
                    u,
                    { isActive: false },
                    "Foydalanuvchi o'chirildi",
                  );
              }}
            >
              O&apos;chirish
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function FormSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="grid gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}
