-- CreateEnum
CREATE TYPE "ReceiptSource" AS ENUM ('QR', 'PHOTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'APPROVED', 'BELOW_MIN', 'REJECTED', 'NOT_FOUND', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "SaleSource" AS ENUM ('IIKO_API', 'EXCEL');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3),
    "receiptWindowHours" INTEGER NOT NULL DEFAULT 72,
    "rulesText" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minSum" DECIMAL(14,2) NOT NULL DEFAULT 100000,
    "couponPrice" DECIMAL(14,2) NOT NULL DEFAULT 100000,
    "maxPerReceipt" INTEGER NOT NULL DEFAULT 10,
    "iikoRef" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_devices" (
    "id" SERIAL NOT NULL,
    "fm" TEXT NOT NULL,
    "branchId" INTEGER NOT NULL,
    "legalName" TEXT,
    "stir" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" SERIAL NOT NULL,
    "tgId" BIGINT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "languageCode" TEXT,
    "refCode" TEXT NOT NULL,
    "referredById" INTEGER,
    "startPayload" TEXT,
    "source" TEXT,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "botBlockedAt" TIMESTAMPTZ(3),
    "rulesAcceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" SERIAL NOT NULL,
    "participantId" INTEGER NOT NULL,
    "fm" TEXT,
    "receiptNumber" TEXT,
    "fiscalSign" TEXT,
    "fiscalAt" TIMESTAMPTZ(3),
    "rawUrl" TEXT,
    "source" "ReceiptSource" NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(14,2),
    "branchId" INTEGER,
    "couponsCount" INTEGER NOT NULL DEFAULT 0,
    "rejectCode" TEXT,
    "rejectReason" TEXT,
    "saleRecordId" INTEGER,
    "photoFileId" TEXT,
    "reviewedById" INTEGER,
    "notifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER NOT NULL,
    "participantId" INTEGER NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_records" (
    "id" SERIAL NOT NULL,
    "source" "SaleSource" NOT NULL,
    "externalKey" TEXT NOT NULL,
    "fm" TEXT,
    "receiptNumber" TEXT,
    "branchId" INTEGER,
    "branchHint" TEXT,
    "closedAt" TIMESTAMPTZ(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "importBatchId" INTEGER,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" SERIAL NOT NULL,
    "source" "SaleSource" NOT NULL,
    "fileName" TEXT,
    "periodFrom" TIMESTAMPTZ(3),
    "periodTo" TIMESTAMPTZ(3),
    "rows" INTEGER NOT NULL DEFAULT 0,
    "matched" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "log" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_phones" (
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'CSV',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_phones_pkey" PRIMARY KEY ("phone")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "participantId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sendAfter" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_logs" (
    "id" SERIAL NOT NULL,
    "participantId" INTEGER,
    "tgId" BIGINT,
    "channel" TEXT NOT NULL,
    "rawText" TEXT,
    "result" TEXT NOT NULL,
    "receiptId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unknown_fms" (
    "fm" TEXT NOT NULL,
    "firstSeen" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hits" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "unknown_fms_pkey" PRIMARY KEY ("fm")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_devices_fm_key" ON "fiscal_devices"("fm");

-- CreateIndex
CREATE UNIQUE INDEX "participants_tgId_key" ON "participants"("tgId");

-- CreateIndex
CREATE UNIQUE INDEX "participants_phone_key" ON "participants"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "participants_refCode_key" ON "participants"("refCode");

-- CreateIndex
CREATE INDEX "receipts_status_idx" ON "receipts"("status");

-- CreateIndex
CREATE INDEX "receipts_participantId_idx" ON "receipts"("participantId");

-- CreateIndex
CREATE INDEX "receipts_createdAt_idx" ON "receipts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_fm_receiptNumber_key" ON "receipts"("fm", "receiptNumber");

-- CreateIndex
CREATE INDEX "coupons_participantId_idx" ON "coupons"("participantId");

-- CreateIndex
CREATE INDEX "coupons_receiptId_idx" ON "coupons"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "sale_records_externalKey_key" ON "sale_records"("externalKey");

-- CreateIndex
CREATE INDEX "sale_records_fm_receiptNumber_idx" ON "sale_records"("fm", "receiptNumber");

-- CreateIndex
CREATE INDEX "sale_records_branchId_closedAt_idx" ON "sale_records"("branchId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_login_key" ON "admin_users"("login");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_sentAt_sendAfter_idx" ON "notifications"("sentAt", "sendAfter");

-- CreateIndex
CREATE INDEX "scan_logs_createdAt_idx" ON "scan_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "fiscal_devices" ADD CONSTRAINT "fiscal_devices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_saleRecordId_fkey" FOREIGN KEY ("saleRecordId") REFERENCES "sale_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_records" ADD CONSTRAINT "sale_records_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_logs" ADD CONSTRAINT "scan_logs_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
