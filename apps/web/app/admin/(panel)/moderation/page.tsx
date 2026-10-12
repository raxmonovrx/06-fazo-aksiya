'use client';

import { ReceiptsTable } from '@/components/receipts-table';

export default function ModerationPage() {
  return (
    <>
      <div>
        <h1 className="text-xl font-bold">Moderatsiya</h1>
        <p className="text-sm text-neutral-500">
          Rasm orqali kelgan (QR o&apos;qilmagan), noma&apos;lum FM, iiko&apos;da topilmagan yoki shubhali cheklar. Chekni ochib, summa va filialni kiritib tasdiqlang yoki sababi bilan rad eting.
        </p>
      </div>
      <ReceiptsTable lockStatus showPhoto initial={{ status: 'NEEDS_REVIEW,NOT_FOUND', branchId: '', phone: '', q: '', from: '', to: '' }} />
    </>
  );
}
