-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "revokeReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMPTZ(3),
ADD COLUMN     "revokedById" INTEGER;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
