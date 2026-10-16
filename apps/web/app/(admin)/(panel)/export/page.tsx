'use client';

import {
  RiCoupon3Line,
  RiDownload2Line,
  RiGroupLine,
  RiQrCodeLine,
  RiTimeLine,
} from '@remixicon/react';

import { PageContainer, PageIntro } from '@/components/admin/layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const ITEMS = [
  {
    key: 'participants',
    title: 'Ishtirokchilar',
    desc: "Telefon, ism, manba, ro'yxatdan o'tgan sana, skanerlagan QR va kuponlar soni",
    icon: RiGroupLine,
  },
  {
    key: 'coupons',
    title: 'Kuponlar',
    desc: "Kupon raqami, egasi, filial, manba (kassa QR yoki taklif bonusi), o'yinda qatnashadimi",
    icon: RiCoupon3Line,
  },
  {
    key: 'vouchers',
    title: 'Vaucherlar (QR)',
    desc: 'Barcha QR: kassir, terminal, summa, kim skanerladi, shubhali belgilar, bekor sababi',
    icon: RiQrCodeLine,
  },
];

export default function ExportPage() {
  return (
    <PageContainer size="narrow">
      <PageIntro description="Ma'lumotlarni Excel yoki CSV faylga yuklab oling." />

      <Card className="gap-0 py-0">
        <ul className="divide-y">
          {ITEMS.map((i) => (
            <li
              key={i.key}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg border bg-muted/50 text-muted-foreground">
                  <i.icon className="size-5" />
                </span>
                <div className="grid min-w-0 gap-0.5">
                  <span className="text-sm font-medium">{i.title}</span>
                  <span className="text-xs text-muted-foreground sm:truncate">
                    {i.desc}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 pl-13 sm:pl-0">
                <Button
                  size="sm"
                  variant="outline"
                  nativeButton={false}
                  render={
                    <a
                      href={`/api/admin/export/${i.key}.xlsx`}
                      aria-label={`${i.title} — Excel`}
                    />
                  }
                >
                  <RiDownload2Line data-icon="inline-start" />
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  nativeButton={false}
                  render={
                    <a
                      href={`/api/admin/export/${i.key}.csv`}
                      aria-label={`${i.title} — CSV`}
                    />
                  }
                >
                  <RiDownload2Line data-icon="inline-start" />
                  CSV
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <RiTimeLine className="size-3.5 shrink-0" />
          Fayl yuklab olish paytidagi holat bo&apos;yicha tayyorlanadi, vaqtlar
          Toshkent vaqtida.
        </div>
      </Card>
    </PageContainer>
  );
}
