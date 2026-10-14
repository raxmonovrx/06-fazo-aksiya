'use client';

import { useState } from 'react';

import { Button, Card, ErrorBox, Field, Input, Select, Table, useLoad } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { fmtDate, fmtSum } from '@/lib/format';

interface Device { id: number; fm: string; legalName: string | null; stir: string | null; note: string | null }
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
interface UnknownFm { fm: string; firstSeen: string; lastSeen: string; hits: number }

export default function BranchesPage() {
  const branches = useLoad(() => adminApi<Branch[]>('/branches'), []);
  const unknown = useLoad(() => adminApi<UnknownFm[]>('/unknown-fms'), []);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const reloadAll = async () => {
    await Promise.all([branches.reload(), unknown.reload()]);
  };
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
      await reloadAll();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <h1 className="text-xl font-bold">Filiallar va kassalar (FM)</h1>
      <ErrorBox error={error ?? branches.error} />
      {msg && <p className="rounded-lg bg-emerald-50 dark:bg-emerald-500/15 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{msg}</p>}

      {!!unknown.data?.length && (
        <Card title={`⚠️ Noma'lum FM'lar (${unknown.data.length})`}>
          <p className="mb-3 text-sm text-muted-foreground">
            Shu kassalardan cheklar keldi, lekin ular hech qaysi filialga bog&apos;lanmagan. Filialni tanlang — moderatsiyada kutayotgan cheklar avtomatik qayta ishlanadi.
          </p>
          <Table head={['FM', 'Cheklar', 'Birinchi', 'Oxirgi', 'Filialga bog\'lash']}>
            {unknown.data.map((u) => (
              <tr key={u.fm}>
                <td className="font-mono">{u.fm}</td>
                <td>{u.hits}</td>
                <td>{fmtDate(u.firstSeen)}</td>
                <td>{fmtDate(u.lastSeen)}</td>
                <td>
                  <Select
                    defaultValue=""
                    onChange={(e) =>
                      e.target.value &&
                      run(
                        () => adminApi(`/branches/${e.target.value}/devices`, { method: 'POST', json: { fm: u.fm } }),
                        `${u.fm} bog'landi`,
                      )
                    }
                  >
                    <option value="">— filial —</option>
                    {branches.data?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {branches.data?.map((b) => <BranchCard key={b.id} b={b} run={run} />)}
      <NewBranch run={run} />
    </>
  );
}

function BranchCard({ b, run }: { b: Branch; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
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
  const [dev, setDev] = useState({ fm: '', legalName: '', stir: '', note: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const num = (s: string) => Number(s.replace(/\s/g, ''));

  return (
    <Card
      title={
        <span>
          {b.name} {!b.isActive && <span className="ml-2 rounded bg-secondary px-2 text-xs">aksiyada emas</span>}
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Nomi"><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Brend"><Input value={f.brand} onChange={set('brand')} /></Field>
        <Field label="Minimal chek (min_sum)" hint={fmtSum(num(f.minSum))}><Input value={f.minSum} onChange={set('minSum')} inputMode="numeric" /></Field>
        <Field label="1 kupon narxi (coupon_price)" hint={fmtSum(num(f.couponPrice))}><Input value={f.couponPrice} onChange={set('couponPrice')} inputMode="numeric" /></Field>
        <Field label="Maks. kupon / chek"><Input value={f.maxPerReceipt} onChange={set('maxPerReceipt')} inputMode="numeric" /></Field>
        <Field label="iiko department"><Input value={f.department} onChange={set('department')} /></Field>
        <Field label="iiko server"><Input value={f.host} onChange={set('host')} /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
          Aksiyada qatnashadi
        </label>
      </div>
      <Button
        className="mt-3"
        onClick={() =>
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
                  iikoRef: f.department || f.host ? { department: f.department || undefined, host: f.host || undefined } : null,
                },
              }),
            `${f.name} saqlandi`,
          )
        }
      >
        Saqlash
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">Qoida o&apos;zgarishi faqat keyingi tasdiqlanadigan cheklarga ta&apos;sir qiladi.</p>

      <h3 className="mt-5 mb-2 text-sm font-semibold">Kassalar (FM raqamlari)</h3>
      <Table head={['FM', 'Yuridik shaxs', 'STIR', 'Izoh', '']} empty={!b.devices.length}>
        {b.devices.map((d) => (
          <tr key={d.id}>
            <td className="font-mono">{d.fm}</td>
            <td>{d.legalName ?? '—'}</td>
            <td>{d.stir ?? '—'}</td>
            <td>{d.note ?? ''}</td>
            <td className="text-right">
              <Button
                variant="ghost"
                className="text-red-600 dark:text-red-400"
                onClick={() => confirm(`${d.fm} o'chirilsinmi?`) && run(() => adminApi(`/devices/${d.id}`, { method: 'DELETE' }), "FM o'chirildi")}
              >
                O&apos;chirish
              </Button>
            </td>
          </tr>
        ))}
      </Table>
      <form
        className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const res = await adminApi<{ released: number }>(`/branches/${b.id}/devices`, { method: 'POST', json: { ...dev, legalName: dev.legalName || null, stir: dev.stir || null, note: dev.note || null } });
            setDev({ fm: '', legalName: dev.legalName, stir: dev.stir, note: '' });
            return res;
          }, "FM qo'shildi");
        }}
      >
        <Input placeholder="FM (LG42…)" value={dev.fm} onChange={(e) => setDev({ ...dev, fm: e.target.value })} required />
        <Input placeholder="Yuridik shaxs" value={dev.legalName} onChange={(e) => setDev({ ...dev, legalName: e.target.value })} />
        <Input placeholder="STIR" value={dev.stir} onChange={(e) => setDev({ ...dev, stir: e.target.value })} />
        <Input placeholder="Izoh (masalan: 1-kassa)" value={dev.note} onChange={(e) => setDev({ ...dev, note: e.target.value })} />
        <Button type="submit" variant="secondary">➕ FM qo&apos;shish</Button>
      </form>
    </Card>
  );
}

function NewBranch({ run }: { run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const [name, setName] = useState('');
  return (
    <Card title="Yangi filial">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => adminApi('/branches', { method: 'POST', json: { name } }), `${name} qo'shildi`).then(() => setName(''));
        }}
      >
        <Input placeholder="Filial nomi" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit">Qo&apos;shish</Button>
      </form>
    </Card>
  );
}
