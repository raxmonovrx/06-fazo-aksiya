'use client';

import { RiAlertLine } from '@remixicon/react';

import { Badge } from '@/components/ui/badge';
import { fmtPhone } from '@/lib/format';
import { cn } from '@/lib/utils';

/** GET /admin/vouchers qatori */
export interface VoucherRow {
  id: number;
  status: 'ISSUED' | 'REDEEMED' | 'CANCELLED';
  amount: string;
  couponsCount: number;
  customerName: string | null;
  customerPhone: string | null;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedPhone: string | null;
  redeemedName: string | null;
  redeemedTgId: string | null;
  phoneMismatch: boolean;
  redeemedByStaff: boolean;
  cancelReason: string | null;
  cancelledAt: string | null;
  branch: { id: number; name: string };
  terminal: { id: number; name: string } | null;
  issuedBy: { id: number; login: string };
  cancelledBy: { id: number; login: string } | null;
  redeemedBy: { id: number; phone: string | null; firstName: string | null; lastName: string | null } | null;
}

export function voucherState(v: Pick<VoucherRow, 'status' | 'expiresAt'>): 'ISSUED' | 'REDEEMED' | 'CANCELLED' | 'EXPIRED' {
  if (v.status === 'ISSUED' && new Date(v.expiresAt) <= new Date()) return 'EXPIRED';
  return v.status;
}

const LABEL = {
  ISSUED: { text: 'Kutilmoqda', dot: 'bg-amber-500' },
  REDEEMED: { text: 'Skanerlandi', dot: 'bg-emerald-500' },
  CANCELLED: { text: 'Bekor qilingan', dot: 'bg-zinc-400' },
  EXPIRED: { text: "Muddati o'tgan", dot: 'bg-zinc-400' },
} as const;

/** Holat + skanerlagan odam raqami va shubha belgilari */
export function VoucherStatusBadge({ v, detail = true }: { v: VoucherRow; detail?: boolean }) {
  const s = LABEL[voucherState(v)];
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant="outline" className="gap-1.5 font-normal">
        <span aria-hidden className={cn('size-1.5 rounded-full', s.dot)} />
        {s.text}
      </Badge>
      {detail && v.status === 'REDEEMED' && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {fmtPhone(v.redeemedPhone)}
          {v.redeemedByStaff && (
            <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400" title="Xodim skanerlagan">
              <RiAlertLine className="size-3" />
              xodim
            </span>
          )}
        </span>
      )}
      {detail && v.status === 'CANCELLED' && v.cancelReason && (
        <span className="text-xs text-muted-foreground">{v.cancelReason}</span>
      )}
    </div>
  );
}
