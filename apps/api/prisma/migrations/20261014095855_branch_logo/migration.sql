-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "logoEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logoInvert" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logoOriginal" BYTEA,
ADD COLUMN     "logoPrint" BYTEA,
ADD COLUMN     "logoThreshold" INTEGER NOT NULL DEFAULT 160,
ADD COLUMN     "logoUpdatedAt" TIMESTAMPTZ(3);
