-- AlterEnum
ALTER TYPE "ReceiptSource" ADD VALUE 'REFERRAL';

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "referralBonusAt" TIMESTAMPTZ(3);
