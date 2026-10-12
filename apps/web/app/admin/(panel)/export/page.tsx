'use client';

import { Card } from '@/components/ui';

const ITEMS = [
  { key: 'participants', title: 'Ishtirokchilar', desc: "Telefon, ism, manba, ro'yxatdan o'tgan sana, cheklar va kuponlar soni" },
  { key: 'coupons', title: 'Kuponlar', desc: "Kupon raqami, egasi, chek, filial, summa, o'yinda qatnashadimi" },
  { key: 'receipts', title: 'Cheklar', desc: 'Barcha cheklar: status, sabab, FM, chek raqami, summa, kuponlar' },
];

export default function ExportPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Eksport</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {ITEMS.map((i) => (
          <Card key={i.key} title={i.title}>
            <p className="mb-4 text-sm text-neutral-500">{i.desc}</p>
            <div className="flex gap-2">
              <a className="rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white" href={`/api/admin/export/${i.key}.xlsx`}>XLSX</a>
              <a className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium" href={`/api/admin/export/${i.key}.csv`}>CSV</a>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
