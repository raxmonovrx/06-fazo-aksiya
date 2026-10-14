import { fmtDate, fmtSum } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Qoidalar — “KIA SONET MENIKI”' };

interface PublicCampaign {
  name: string;
  startsAt: string;
  endsAt: string | null;
  receiptWindowHours: number;
  rulesText: string;
  branches: Array<{ name: string; minSum: number; couponPrice: number; maxPerReceipt: number }>;
}

async function load(): Promise<PublicCampaign | null> {
  const base = process.env.API_URL ?? 'http://localhost:4600';
  try {
    const res = await fetch(`${base}/api/public/campaign`, { cache: 'no-store' });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export default async function RulesPage() {
  const c = await load();
  if (!c) return <main className="p-6 text-center">Qoidalar hozircha mavjud emas.</main>;
  return (
    <main className="mx-auto max-w-2xl p-5 pb-16 leading-relaxed">
      <h1 className="mb-1 text-2xl font-bold">&ldquo;{c.name}&rdquo; aksiyasi qoidalari</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Boshlanish: {fmtDate(c.startsAt, false)}
        {c.endsAt && ` · Tugash: ${fmtDate(c.endsAt, false)}`} · QR&apos;ni {c.receiptWindowHours} soat ichida skanerlang
      </p>
      <div className="whitespace-pre-line rounded-xl bg-neutral-50 p-4">{c.rulesText}</div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Filiallar bo&apos;yicha kupon qoidasi</h2>
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">Filial</th>
              <th className="p-2">Minimal chek</th>
              <th className="p-2">1 kupon</th>
              <th className="p-2">Maks. / chek</th>
            </tr>
          </thead>
          <tbody>
            {c.branches.map((b) => (
              <tr key={b.name} className="border-t">
                <td className="p-2">{b.name}</td>
                <td className="p-2">{fmtSum(b.minSum)}</td>
                <td className="p-2">har {fmtSum(b.couponPrice)}</td>
                <td className="p-2">{b.maxPerReceipt} ta</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
