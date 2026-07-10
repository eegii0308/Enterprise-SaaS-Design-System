-- AlterTable
ALTER TABLE "reconciliation_matches" ADD COLUMN     "corrected_from_match_id" TEXT,
ADD COLUMN     "correction_reason" TEXT;

-- AddForeignKey
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_corrected_from_match_id_fkey" FOREIGN KEY ("corrected_from_match_id") REFERENCES "reconciliation_matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
