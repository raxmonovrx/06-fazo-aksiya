'use client';

import { useEffect, useState } from 'react';

import { Button, Card, ErrorBox, Field, Input, Select, Table, Textarea, useLoad } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { useAdmin } from '../admin-context';

interface Campaign { id: number; name: string; startsAt: string; endsAt: string | null; receiptWindowHours: number; rulesText: string }
interface User { id: number; login: string; role: 'ADMIN' | 'OPERATOR'; isActive: boolean; createdAt: string }

// <input type="datetime-local"> qiymati Toshkent vaqti sifatida
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? `${v}:00+05:00` : null);

export default function SettingsPage() {
  const me = useAdmin();
  const campaign = useLoad(() => adminApi<Campaign>('/settings/campaign'), []);
  const users = useLoad(() => adminApi<User[]>('/users'), []);
  const [f, setF] = useState({ name: '', startsAt: '', endsAt: '', receiptWindowHours: '72', rulesText: '' });
  const [nu, setNu] = useState({ login: '', password: '', role: 'OPERATOR' });
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = campaign.data;
    if (c) setF({ name: c.name, startsAt: toLocal(c.startsAt), endsAt: toLocal(c.endsAt), receiptWindowHours: String(c.receiptWindowHours), rulesText: c.rulesText });
  }, [campaign.data]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      await Promise.all([campaign.reload(), users.reload()]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <h1 className="text-xl font-bold">Sozlamalar</h1>
      <ErrorBox error={error} />
      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}

      <Card title="Aksiya">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Nomi"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Boshlanishi (Toshkent)" hint="Bundan oldingi cheklar qabul qilinmaydi"><Input type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></Field>
          <Field label="Tugashi (ixtiyoriy)"><Input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></Field>
          <Field label="Chek oynasi (soat)" hint="Chek shu vaqt ichida qo'shilishi kerak"><Input value={f.receiptWindowHours} onChange={(e) => setF({ ...f, receiptWindowHours: e.target.value })} inputMode="numeric" /></Field>
        </div>
        <Field label="Qoidalar matni (bot va mini app'da ko'rinadi)">
          <Textarea rows={10} value={f.rulesText} onChange={(e) => setF({ ...f, rulesText: e.target.value })} className="font-sans" />
        </Field>
        <Button
          className="mt-3"
          onClick={() =>
            run(
              () =>
                adminApi('/settings/campaign', {
                  method: 'PATCH',
                  json: { name: f.name, startsAt: fromLocal(f.startsAt), endsAt: fromLocal(f.endsAt), receiptWindowHours: Number(f.receiptWindowHours), rulesText: f.rulesText },
                }),
              'Aksiya sozlamalari saqlandi',
            )
          }
        >
          Saqlash
        </Button>
      </Card>

      <Card title="Admin foydalanuvchilar">
        <Table head={['Login', 'Rol', 'Holat', 'Yaratilgan', '']}>
          {users.data?.map((u) => (
            <tr key={u.id}>
              <td>{u.login}</td>
              <td>{u.role === 'ADMIN' ? 'Admin' : 'Operator'}</td>
              <td>{u.isActive ? 'faol' : <span className="text-red-600">o&apos;chirilgan</span>}</td>
              <td>{fmtDate(u.createdAt)}</td>
              <td className="space-x-1 text-right">
                {u.id !== me.id && (
                  <Button variant="ghost" onClick={() => run(() => adminApi(`/users/${u.id}`, { method: 'PATCH', json: { isActive: !u.isActive } }), 'Saqlandi')}>
                    {u.isActive ? "O'chirish" : 'Yoqish'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    const password = prompt(`${u.login} uchun yangi parol (kamida 8 belgi):`);
                    if (password) void run(() => adminApi(`/users/${u.id}`, { method: 'PATCH', json: { password } }), 'Parol yangilandi');
                  }}
                >
                  Parol
                </Button>
              </td>
            </tr>
          ))}
        </Table>
        <form
          className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await adminApi('/users', { method: 'POST', json: nu });
              setNu({ login: '', password: '', role: 'OPERATOR' });
            }, "Foydalanuvchi qo'shildi");
          }}
        >
          <Input placeholder="login" value={nu.login} onChange={(e) => setNu({ ...nu, login: e.target.value })} required />
          <Input placeholder="parol (8+)" type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} required minLength={8} />
          <Select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
            <option value="OPERATOR">Operator</option>
            <option value="ADMIN">Admin</option>
          </Select>
          <Button type="submit" variant="secondary">➕ Qo&apos;shish</Button>
        </form>
      </Card>
    </>
  );
}
