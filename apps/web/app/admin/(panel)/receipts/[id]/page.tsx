'use client';

import { useParams } from 'next/navigation';

import { PageContainer } from '@/components/admin/layout';
import { usePageHeader } from '@/components/page-header';
import { ReceiptReview } from '@/components/receipt-review';

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  usePageHeader({ title: `Chek #${id}`, backHref: '/admin/receipts' });
  return (
    <PageContainer size="wide">
      <ReceiptReview id={Number(id)} variant="page" />
    </PageContainer>
  );
}
