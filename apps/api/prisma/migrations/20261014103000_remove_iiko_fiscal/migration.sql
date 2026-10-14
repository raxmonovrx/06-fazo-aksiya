-- DropForeignKey
ALTER TABLE "fiscal_devices" DROP CONSTRAINT "fiscal_devices_branchId_fkey";

-- DropForeignKey
ALTER TABLE "import_batches" DROP CONSTRAINT "import_batches_createdById_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_participantId_fkey";

-- DropForeignKey
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_saleRecordId_fkey";

-- DropForeignKey
ALTER TABLE "sale_records" DROP CONSTRAINT "sale_records_branchId_fkey";

-- DropForeignKey
ALTER TABLE "sale_records" DROP CONSTRAINT "sale_records_importBatchId_fkey";

-- DropForeignKey
ALTER TABLE "scan_logs" DROP CONSTRAINT "scan_logs_participantId_fkey";

-- DropIndex
DROP INDEX "receipts_fm_receiptNumber_key";

-- AlterTable
ALTER TABLE "branches" DROP COLUMN "iikoRef";

-- AlterTable
ALTER TABLE "participants" DROP COLUMN "botBlockedAt";

-- AlterTable
ALTER TABLE "receipts" DROP COLUMN "fiscalSign",
DROP COLUMN "fm",
DROP COLUMN "notifiedAt",
DROP COLUMN "photoFileId",
DROP COLUMN "rawUrl",
DROP COLUMN "rejectCode",
DROP COLUMN "rejectReason",
DROP COLUMN "saleRecordId";

-- DropTable
DROP TABLE "fiscal_devices";

-- DropTable
DROP TABLE "import_batches";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "sale_records";

-- DropTable
DROP TABLE "scan_logs";

-- DropTable
DROP TABLE "unknown_fms";

-- DropEnum
DROP TYPE "SaleSource";


-- Olib tashlangan bo'limlar ruxsatlari (moderatsiya, cheklar, import)
UPDATE "admin_users" SET "permissions" = array_remove(array_remove(array_remove("permissions", 'moderation'), 'receipts'), 'import');
