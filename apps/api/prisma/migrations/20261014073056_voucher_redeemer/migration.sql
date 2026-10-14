-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "redeemedByStaff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "redeemedName" TEXT,
ADD COLUMN     "redeemedPhone" TEXT,
ADD COLUMN     "redeemedTgId" BIGINT;

-- CreateIndex
CREATE INDEX "vouchers_redeemedPhone_idx" ON "vouchers"("redeemedPhone");
