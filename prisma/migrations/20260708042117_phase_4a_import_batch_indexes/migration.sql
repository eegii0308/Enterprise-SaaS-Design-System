-- AlterTable
ALTER TABLE "import_batches"
ADD COLUMN "column_mapping" JSONB,
ADD COLUMN "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processing_error" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3);

UPDATE "import_batches"
SET "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP)
WHERE "updated_at" IS NULL;

ALTER TABLE "import_batches"
ALTER COLUMN "updated_at" SET NOT NULL;

-- CreateIndex
CREATE INDEX "import_batches_organization_id_created_at_idx" ON "import_batches"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "import_batches_organization_id_status_idx" ON "import_batches"("organization_id", "status");

-- CreateIndex
CREATE INDEX "import_rows_organization_id_import_batch_id_validation_stat_idx" ON "import_rows"("organization_id", "import_batch_id", "validation_status");

-- CreateIndex
CREATE INDEX "transactions_organization_id_source_type_status_transaction_idx" ON "transactions"("organization_id", "source_type", "status", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_organization_id_import_batch_id_idx" ON "transactions"("organization_id", "import_batch_id");

-- CreateIndex
CREATE INDEX "transactions_organization_id_bank_account_id_transaction_da_idx" ON "transactions"("organization_id", "bank_account_id", "transaction_date");