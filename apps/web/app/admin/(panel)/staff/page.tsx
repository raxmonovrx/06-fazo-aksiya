'use client';

import { useState } from 'react';

import { Button, Card, ErrorBox, Table, Textarea, useLoad } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { fmtDate } from '@/lib/format';

interface Staff { phone: string; name: string | null; source: string; createdAt: string }

export default function StaffPage() {
  const list = useLoad(() => adminApi<Staff[]>('/staff'), []);
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<string>) => {
    setError(null);
    setMsg(null);
    try {
      setMsg(await fn());
      await list.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const loadFile = async (f: File) => setText(await f.text());

  return (
    <>
      <h1 className="text-xl font-bold">Xodimlar</h1>
      <p className="text-sm text-neutral-500">
        Ro&apos;yxatdagi telefon bilan ro&apos;yxatdan o&apos;tganlar xodim deb belgilanadi — ular qatnasha oladi, lekin kuponlari o&apos;yinda hisobga olinmaydi.
      </p>
      <Card title="CSV / ro'yxat import">
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'+998901234567;Ali Valiyev\n+998 93 111 22 33;Oshpaz\n...'} />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,.txt" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} className="text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Ro&apos;yxatni to&apos;liq almashtirish (ishdan ketganlar chiqariladi)
          </label>
          <Button
            disabled={!text.trim()}
            onClick={() =>
              run(async () => {
                const r = await adminApi<{ imported: number; invalid: string[]; participantsUpdated: number }>('/staff/import', { method: 'POST', json: { text, replace } });
                setText('');
                return `Import: ${r.imported} ta telefon. Ishtirokchilar yangilandi: ${r.participantsUpdated}.${r.invalid.length ? ` O'qilmagan qatorlar: ${r.invalid.length}` : ''}`;
              })
            }
          >
            Import
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          <ErrorBox error={error} />
          {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
        </div>
      </Card>
      <Card title={`Ro'yxat (${list.data?.length ?? 0})`}>
        <Table head={['Telefon', 'Ism', 'Manba', "Qo'shilgan", '']} empty={!list.data?.length}>
          {list.data?.map((s) => (
            <tr key={s.phone}>
              <td>{s.phone}</td>
              <td>{s.name ?? '—'}</td>
              <td>{s.source}</td>
              <td>{fmtDate(s.createdAt)}</td>
              <td className="text-right">
                <Button variant="ghost" className="text-red-600" onClick={() => run(async () => { await adminApi(`/staff/${encodeURIComponent(s.phone)}`, { method: 'DELETE' }); return `${s.phone} o'chirildi`; })}>
                  O&apos;chirish
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
