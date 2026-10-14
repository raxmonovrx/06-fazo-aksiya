-- CreateEnum
CREATE TYPE "public"."VoucherStatus" AS ENUM ('ISSUED', 'REDEEMED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "public"."ReceiptSource" ADD VALUE 'VOUCHER';

-- AlterEnum
ALTER TYPE "public"."AdminRole" ADD VALUE 'CASHIER';

-- AlterTable
ALTER TABLE "public"."participants" ADD COLUMN     "pendingVoucher" TEXT;

-- AlterTable
ALTER TABLE "public"."admin_users" ADD COLUMN     "branchId" INTEGER;

-- CreateTable
CREATE TABLE "public"."vouchers" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "couponsCount" INTEGER NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "status" "public"."VoucherStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedById" INTEGER NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "redeemedById" INTEGER,
    "redeemedAt" TIMESTAMPTZ(3),
    "phoneMismatch" BOOLEAN NOT NULL DEFAULT false,
    "receiptId" INTEGER,
    "cancelledById" INTEGER,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelReason" TEXT,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vouchers_branchId_issuedAt_idx" ON "public"."vouchers"("branchId" ASC, "issuedAt" ASC);

-- CreateIndex
CREATE INDEX "vouchers_issuedAt_idx" ON "public"."vouchers"("issuedAt" ASC);

-- CreateIndex
CREATE INDEX "vouchers_issuedById_issuedAt_idx" ON "public"."vouchers"("issuedById" ASC, "issuedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_receiptId_key" ON "public"."vouchers"("receiptId" ASC);

-- CreateIndex
CREATE INDEX "vouchers_status_idx" ON "public"."vouchers"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_token_key" ON "public"."vouchers"("token" ASC);

-- AddForeignKey
ALTER TABLE "public"."admin_users" ADD CONSTRAINT "admin_users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vouchers" ADD CONSTRAINT "vouchers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vouchers" ADD CONSTRAINT "vouchers_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "public"."admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vouchers" ADD CONSTRAINT "vouchers_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vouchers" ADD CONSTRAINT "vouchers_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vouchers" ADD CONSTRAINT "vouchers_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "public"."participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

