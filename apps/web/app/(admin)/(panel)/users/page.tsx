'use client';

import {
  RiEdit2Line,
  RiKey2Line,
  RiLoader4Line,
  RiMore2Fill,
  RiShieldUserLine,
  RiTeamLine,
  RiUserAddLine,
  RiUserFollowLine,
  RiUserForbidLine,
} from '@remixicon/react';
import { useState } from 'react';
import { toast } from 'sonner';

import { DataTableCard, FacetFilter, DataTableToolbar } from '@/components/admin/data-table';
import { ErrorAlert, TableLoading, useLoad } from '@/components/admin/kit';
import { Dot, EmptyState, PageContainer, PageIntro } from '@/components/admin/layout';
import { noAutofill } from '@/components/admin/phone-input';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { adminApi } from '@/lib/api';
import { fmtShort } from '@/lib/format';
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  roleInfo,
  roleLabel,
  ROLES,
  type AdminRole,
  type Permission,
} from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { useAdmin } from '../admin-context';

interface User {
  id: number;
  login: string;
  role: AdminRole;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  branchId: number | null;
  branch: { id: number; name: string } | null;
}

const LOGIN_RE = /^[a-z0-9._-]{3,32}$/i;
const ALL = 'all';
const PERM_LABEL = Object.fromEntries(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.value, i.label]))) as Record<
  Permission,
  string
>;

/** «farrux.admin» → «FA» */
const initials = (login: string) => {
  const parts = login.split(/[._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : login.slice(0, 2)).toUpperCase();
};

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Parol kuchi — oddiy taxmin (uzunlik + belgi turlari) */
function StrengthHint({ password }: { password: string }) {
  if (!password) return <FieldDescription>Kamida 8 belgi</FieldDescription>;
  if (password.length < 8) return <FieldDescription>Yana {8 - password.length} ta belgi kerak</FieldDescription>;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) => r.test(password)).length + (password.length >= 12 ? 1 : 0);
  const [label, color] =
    kinds >= 4 ? ['Kuchli parol', 'text-emerald-600'] : kinds >= 3 ? ["O'rtacha parol", 'text-sky-600'] : ['Zaif — harf, raqam va belgini aralashtiring', 'text-amber-600'];
  return <FieldDescription className={color}>{label}</FieldDescription>;
}

export default function UsersPage() {
  const me = useAdmin();
  const users = useLoad(() => adminApi<User[]>('/users'), []);
  const branches = useLoad(() => adminApi<Array<{ id: number; name: string }>>('/branches'), []);
  const branchItems = (branches.data ?? []).map((b) => ({ value: String(b.id), label: b.name }));

  const [role, setRole] = useState('');
  const [branch, setBranch] = useState('');
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [pwUser, setPwUser] = useState<User | null>(null);
  const [offUser, setOffUser] = useState<User | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const patch = async (u: User, json: Record<string, unknown>, ok: string) => {
    setBusyId(u.id);
    try {
      await adminApi(`/users/${u.id}`, { method: 'PATCH', json });
      toast.success(ok);
      await users.reload();
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const list = (users.data ?? []).filter(
    (u) => (!role || u.role === role) && (!branch || String(u.branchId ?? '') === branch),
  );

  return (
    <PageContainer>
      <PageIntro
        description="Panelga kiradigan xodimlar: rol, filial va har bir bo'limga ruxsat."
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <RiUserAddLine data-icon="inline-start" />
            Foydalanuvchi qo&apos;shish
          </Button>
        }
      />

      <DataTableToolbar>
        <FacetFilter title="Rol" value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r.value, label: r.label }))} />
        <FacetFilter title="Filial" value={branch} onChange={setBranch} options={branchItems} />
        {users.data && (
          <span className="text-sm text-muted-foreground">
            <span className="text-foreground tabular-nums">{users.data.filter((u) => u.isActive).length}</span> ta faol
          </span>
        )}
      </DataTableToolbar>

      <ErrorAlert error={users.error} />

      <DataTableCard>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Foydalanuvchi</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Ruxsatlar</TableHead>
              <TableHead>Oxirgi kirish</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.loading && !users.data && <TableLoading colSpan={6} rows={4} />}
            {users.data && list.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>
                  <EmptyState icon={RiTeamLine} title="Foydalanuvchi topilmadi" description="Filtrni o'zgartiring yoki yangi xodim qo'shing" />
                </TableCell>
              </TableRow>
            )}
            {list.map((u) => {
              const isMe = u.id === me.id;
              const tpl = roleInfo(u.role).template;
              const custom = u.role !== 'ADMIN' && !sameSet(u.permissions, tpl);
              return (
                <TableRow
                  key={u.id}
                  className={cn('cursor-pointer', !u.isActive && 'text-muted-foreground')}
                  onClick={() => setEditing(u)}
                >
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px] font-medium">{initials(u.login)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {u.login}
                        {isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(siz)</span>}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === 'ADMIN' ? 'secondary' : 'outline'} className="font-normal">
                      {u.role === 'ADMIN' && <RiShieldUserLine />}
                      {roleLabel(u.role)}
                    </Badge>
                    {u.branch && <div className="mt-0.5 text-xs text-muted-foreground">{u.branch.name}</div>}
                  </TableCell>
                  <TableCell className="max-w-72">
                    {u.role === 'ADMIN' ? (
                      <span className="text-sm text-muted-foreground">Hammasi</span>
                    ) : u.permissions.length === 0 ? (
                      <span className="text-sm text-destructive">Yo&apos;q</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.permissions.slice(0, 3).map((p) => (
                          <Badge key={p} variant="outline" className="font-normal">
                            {PERM_LABEL[p]}
                          </Badge>
                        ))}
                        {u.permissions.length > 3 && (
                          <Badge variant="outline" className="font-normal text-muted-foreground">
                            +{u.permissions.length - 3}
                          </Badge>
                        )}
                        {custom && <span className="text-xs text-muted-foreground">· sozlangan</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {u.lastLoginAt ? fmtShort(u.lastLoginAt) : '—'}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <Dot className={u.isActive ? 'bg-emerald-500' : 'bg-zinc-400'} />
                      {u.isActive ? 'Faol' : "O'chirilgan"}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" aria-label={`${u.login} amallari`} disabled={busyId === u.id} />}
                      >
                        {busyId === u.id ? <RiLoader4Line className="animate-spin" /> : <RiMore2Fill />}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => setEditing(u)}>
                          <RiEdit2Line />
                          Rol va ruxsatlar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPwUser(u)}>
                          <RiKey2Line />
                          Parolni almashtirish
                        </DropdownMenuItem>
                        {!isMe && (
                          <>
                            <DropdownMenuSeparator />
                            {u.isActive ? (
                              <DropdownMenuItem variant="destructive" onClick={() => setOffUser(u)}>
                                <RiUserForbidLine />
                                O&apos;chirish
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => void patch(u, { isActive: true }, `${u.login} yoqildi`)}>
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

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]">
          {editing !== null && (
            <UserEditor
              key={editing === 'new' ? 'new' : editing.id}
              user={editing === 'new' ? null : editing}
              isMe={editing !== 'new' && editing.id === me.id}
              branchItems={branchItems}
              onDone={async () => {
                setEditing(null);
                await users.reload();
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <PasswordDialog user={pwUser} onClose={() => setPwUser(null)} />

      <AlertDialog open={offUser !== null} onOpenChange={(o) => !o && setOffUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{offUser?.login} o&apos;chirilsinmi?</AlertDialogTitle>
            <AlertDialogDescription>
              Panelga kira olmaydi, ochiq sessiyasi ham to&apos;xtaydi. Chiqargan QR&apos;lari tarixda qoladi. Keyin qayta yoqish mumkin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                const u = offUser;
                setOffUser(null);
                if (u) void patch(u, { isActive: false }, `${u.login} o'chirildi`);
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

/** Yangi foydalanuvchi yoki mavjudining roli, filiali va ruxsatlari */
function UserEditor({
  user,
  isMe,
  branchItems,
  onDone,
}: {
  user: User | null;
  isMe: boolean;
  branchItems: Array<{ value: string; label: string }>;
  onDone: () => Promise<void>;
}) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>(user?.role ?? 'CASHIER');
  const [branchId, setBranchId] = useState(user?.branchId ? String(user.branchId) : '');
  const [perms, setPerms] = useState<Permission[]>(user?.permissions ?? roleInfo('CASHIER').template);
  const [busy, setBusy] = useState(false);

  const info = roleInfo(role);
  const isAdmin = role === 'ADMIN';
  const loginErr = login && !LOGIN_RE.test(login.trim()) ? '3–32 belgi: lotin harf, raqam, . _ -' : null;
  const valid =
    (user || (LOGIN_RE.test(login.trim()) && password.length >= 8)) &&
    (!info.needsBranch || !!branchId) &&
    (isAdmin || perms.length > 0);
  const dirty =
    !user ||
    role !== user.role ||
    branchId !== (user.branchId ? String(user.branchId) : '') ||
    (!isAdmin && !sameSet(perms, user.permissions));

  const pickRole = (r: AdminRole) => {
    setRole(r);
    setPerms(roleInfo(r).template);
    if (r === 'ADMIN') setBranchId('');
  };
  const toggle = (p: Permission, on: boolean) =>
    setPerms((cur) => (on ? ALL_PERMISSIONS.filter((x) => x === p || cur.includes(x)) : cur.filter((x) => x !== p)));

  const save = async () => {
    setBusy(true);
    const access = {
      role,
      branchId: isAdmin ? null : branchId ? Number(branchId) : null,
      ...(!isAdmin && { permissions: perms }),
    };
    try {
      if (user) await adminApi(`/users/${user.id}`, { method: 'PATCH', json: access });
      else await adminApi('/users', { method: 'POST', json: { login: login.trim(), password, ...access } });
      toast.success(user ? `${user.login} saqlandi` : `${login.trim()} qo'shildi`);
      await onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle>{user ? user.login : 'Yangi foydalanuvchi'}</SheetTitle>
        <SheetDescription>
          {isMe ? "O'z rolingiz va ruxsatlaringizni o'zgartira olmaysiz" : 'Rol tanlang — ruxsatlar shablondan to\'ladi, kerak bo\'lsa o\'zgartiring'}
        </SheetDescription>
      </SheetHeader>

      <form
        id="user-form"
        autoComplete="off"
        className="min-h-0 flex-1 overflow-y-auto p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && dirty && !isMe) void save();
        }}
      >
        <FieldGroup>
          {!user && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!loginErr || undefined}>
                <FieldLabel htmlFor="u-login">Login</FieldLabel>
                <Input
                  id="u-login"
                  {...noAutofill('u1')}
                  placeholder="kassa.fazo1"
                  value={login}
                  aria-invalid={!!loginErr || undefined}
                  onChange={(e) => setLogin(e.target.value)}
                />
                {loginErr && <FieldError>{loginErr}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="u-pw">Parol</FieldLabel>
                <PasswordInput id="u-pw" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <StrengthHint password={password} />
              </Field>
            </div>
          )}

          <Field>
            <FieldLabel>Rol</FieldLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  disabled={isMe}
                  onClick={() => pickRole(r.value)}
                  className={cn(
                    'grid gap-0.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60',
                    role === r.value && 'border-primary bg-primary/5 ring-1 ring-primary',
                  )}
                >
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.description}</span>
                </button>
              ))}
            </div>
          </Field>

          {!isAdmin && (
            <Field>
              <FieldLabel htmlFor="u-branch">Filial{info.needsBranch ? '' : ' (ixtiyoriy)'}</FieldLabel>
              <Select
                items={[...(info.needsBranch ? [] : [{ value: ALL, label: 'Hamma filiallar' }]), ...branchItems]}
                value={branchId || (info.needsBranch ? null : ALL)}
                onValueChange={(v) => setBranchId(!v || v === ALL ? '' : (v as string))}
                disabled={isMe}
              >
                <SelectTrigger id="u-branch" className="w-full">
                  <SelectValue placeholder="Filialni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {!info.needsBranch && <SelectItem value={ALL}>Hamma filiallar</SelectItem>}
                  {branchItems.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Kassa va vaucherlar shu filial bilan cheklanadi.</FieldDescription>
            </Field>
          )}

          <div className="grid gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Ruxsatlar</span>
              {!isAdmin && !isMe && !sameSet(perms, info.template) && (
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setPerms(info.template)}>
                  «{info.label}» shabloniga qaytarish
                </button>
              )}
            </div>
            {isAdmin && <p className="text-sm text-muted-foreground">Admin hamma bo&apos;limni ko&apos;radi — ruxsatlar o&apos;zgarmaydi.</p>}
            {PERMISSION_GROUPS.map((g) => (
              <div key={g.title} className="overflow-hidden rounded-lg border">
                <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">{g.title}</div>
                <div className="divide-y">
                  {g.items.map((it) => {
                    const checked = isAdmin || perms.includes(it.value);
                    return (
                      <label
                        key={it.value}
                        className={cn('flex cursor-pointer items-start gap-3 px-3 py-2.5', (isAdmin || isMe) && 'cursor-default opacity-70')}
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={checked}
                          disabled={isAdmin || isMe}
                          onCheckedChange={(c) => toggle(it.value, Boolean(c))}
                        />
                        <span className="grid gap-0.5">
                          <span className="text-sm">{it.label}</span>
                          <span className="text-xs text-muted-foreground">{it.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </FieldGroup>
      </form>

      <SheetFooter className="flex-row justify-end border-t">
        <Button variant="outline" onClick={() => void onDone()} disabled={busy}>
          Yopish
        </Button>
        <Button type="submit" form="user-form" disabled={busy || !valid || !dirty || isMe}>
          {busy && <RiLoader4Line data-icon="inline-start" className="animate-spin" />}
          {user ? 'Saqlash' : "Qo'shish"}
        </Button>
      </SheetFooter>
    </>
  );
}

function PasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={user !== null}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setPw('');
        }
      }}
    >
      <DialogContent>
        <form
          className="grid gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!user || pw.length < 8) return;
            setBusy(true);
            try {
              await adminApi(`/users/${user.id}`, { method: 'PATCH', json: { password: pw } });
              toast.success(`${user.login}: parol almashtirildi`);
              setPw('');
              onClose();
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{user?.login} — yangi parol</DialogTitle>
            <DialogDescription>Xodimga yangi parolni o&apos;zingiz yetkazasiz.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="pw-new">Yangi parol</FieldLabel>
            <PasswordInput id="pw-new" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            <StrengthHint password={pw} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={busy || pw.length < 8}>
              {busy && <RiLoader4Line data-icon="inline-start" className="animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
