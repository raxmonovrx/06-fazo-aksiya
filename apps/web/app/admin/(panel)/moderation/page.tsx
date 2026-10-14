'use client';

import { PageToolbar } from '@/components/admin/kit';
import { ReceiptsTable } from '@/components/receipts-table';

export default function ModerationPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageToolbar
        description={
          <>
            Rasm orqali kelgan (QR o&apos;qilmagan), noma&apos;lum FM,
            iiko&apos;da topilmagan yoki shubhali cheklar. Chekni ochib, summa
            va filialni kiritib tasdiqlang yoki sababi bilan rad eting.
          </>
        }
      />
      <ReceiptsTable
        lockStatus
        showPhoto
        initial={{
          status: 'NEEDS_REVIEW,NOT_FOUND',
          branchId: '',
          phone: '',
          q: '',
          from: '',
          to: '',
        }}
      />
    </div>
  );
}
