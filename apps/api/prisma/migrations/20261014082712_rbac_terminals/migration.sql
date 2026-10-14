-- CreateEnum
CREATE TYPE "TerminalOutput" AS ENUM ('PRINT_80', 'PRINT_58', 'SCREEN');

-- AlterEnum
ALTER TYPE "AdminRole" ADD VALUE 'MANAGER';

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "terminalId" INTEGER;

-- CreateTable
CREATE TABLE "terminals" (
    "id" SERIAL NOT NULL,
    "branchId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "output" "TerminalOutput" NOT NULL DEFAULT 'PRINT_80',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terminals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terminals_branchId_idx" ON "terminals"("branchId");

-- AddForeignKey
ALTER TABLE "terminals" ADD CONSTRAINT "terminals_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mavjud foydalanuvchilarga rol shabloni bo'yicha ruxsatlar (src/admin/permissions.ts bilan bir xil)
UPDATE "admin_users" SET "permissions" = ARRAY['dashboard','vouchers','moderation','receipts','participants'] WHERE "role" = 'OPERATOR';
UPDATE "admin_users" SET "permissions" = ARRAY['cashier'] WHERE "role" = 'CASHIER';
