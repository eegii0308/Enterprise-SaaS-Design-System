-- AlterTable
ALTER TABLE "reconciliation_runs" ADD COLUMN "bank_account_id" TEXT;

-- Best-effort backfill: infer each existing run's bank account from the bank
-- leg of its own confirmed/proposed matches (Phase 7B requires bank_account_id
-- to be set on every run going forward, since reconciliation now happens
-- against one selected bank account per run). Runs with no matches at all, or
-- whose matched bank transactions predate bank-account tagging, cannot be
-- inferred this way and are intentionally left NULL so the NOT NULL
-- constraint below fails loudly and requires a manual data fix rather than
-- silently guessing the wrong bank account.
UPDATE "reconciliation_runs" r
SET "bank_account_id" = sub.bank_account_id
FROM (
  SELECT DISTINCT ON (rm."reconciliation_run_id")
    rm."reconciliation_run_id" AS run_id,
    t."bank_account_id" AS bank_account_id
  FROM "reconciliation_matches" rm
  JOIN "transactions" t ON t.id = rm."bank_transaction_id"
  WHERE t."bank_account_id" IS NOT NULL
  ORDER BY rm."reconciliation_run_id", rm."created_at" ASC
) sub
WHERE r.id = sub.run_id AND r."bank_account_id" IS NULL;

ALTER TABLE "reconciliation_runs" ALTER COLUMN "bank_account_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "reconciliation_runs_organization_bank_account_status_idx" ON "reconciliation_runs"("organization_id", "bank_account_id", "status");
