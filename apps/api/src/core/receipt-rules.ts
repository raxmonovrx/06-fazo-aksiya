export type TimingError = 'BEFORE_CAMPAIGN' | 'AFTER_CAMPAIGN' | 'WINDOW_EXPIRED' | 'FUTURE';

export interface CampaignTiming {
  startsAt: Date;
  endsAt: Date | null;
  receiptWindowHours: number;
}

/** Kassa soati biroz oldinda bo'lishi mumkin — 10 daqiqagacha kechiramiz. */
const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;

export function checkReceiptTiming(
  fiscalAt: Date,
  now: Date,
  campaign: CampaignTiming,
): TimingError | null {
  if (fiscalAt.getTime() - now.getTime() > FUTURE_TOLERANCE_MS) return 'FUTURE';
  if (fiscalAt < campaign.startsAt) return 'BEFORE_CAMPAIGN';
  if (campaign.endsAt && fiscalAt > campaign.endsAt) return 'AFTER_CAMPAIGN';
  const windowMs = campaign.receiptWindowHours * 60 * 60 * 1000;
  if (now.getTime() - fiscalAt.getTime() > windowMs) return 'WINDOW_EXPIRED';
  return null;
}
