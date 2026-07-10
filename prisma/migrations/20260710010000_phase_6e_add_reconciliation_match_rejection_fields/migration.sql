-- AlterTable
ALTER TABLE "reconciliation_matches" ADD COLUMN     "rejected_by" TEXT,
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejection_reason" TEXT;
