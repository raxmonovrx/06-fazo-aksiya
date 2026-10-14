'use client';

import {
  RiCoupon3Line,
  RiDownload2Line,
  RiFileList3Line,
  RiGroupLine,
} from '@remixicon/react';

import { PageToolbar } from '@/components/admin/kit';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const ITEMS = [
  {
    key: 'participants',
    title: 'Ishtirokchilar',
    desc: "Telefon, ism, manba, ro'yxatdan o'tgan sana, cheklar va kuponlar soni",
    icon: RiGroupLine,
  },
  {
    key: 'coupons',
    title: 'Kuponlar',
    desc: "Kupon raqami, egasi, chek, filial, summa, o'yinda qatnashadimi",
    icon: RiCoupon3Line,
  },
  {
    key: 'receipts',
    title: 'Cheklar',
    desc: 'Barcha cheklar: status, sabab, FM, chek raqami, summa, kuponlar',
    icon: RiFileList3Line,
  },
];

export default function ExportPage() {
  return (
    <>
      <PageToolbar description="Ma'lumotlarni Excel (XLSX) yoki CSV faylga yuklab oling. Fayl joriy holat bo'yicha tayyorlanadi." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ITEMS.map((i) => (
          <Card key={i.key}>
            <CardHeader>
              <span className="mb-1 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <i.icon className="size-[18px]" />
              </span>
              <CardTitle>{i.title}</CardTitle>
              <CardDescription>{i.desc}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="gap-2">
              <Button
                size="sm"
                nativeButton={false}
                render={<a href={`/api/admin/export/${i.key}.xlsx`} />}
              >
                <RiDownload2Line data-icon="inline-start" />
                XLSX
              </Button>
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<a href={`/api/admin/export/${i.key}.csv`} />}
              >
                <RiDownload2Line data-icon="inline-start" />
                CSV
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}
