-- Phase 5D tenant isolation regression fix.
-- Restore the organization-scoped Transaction -> ImportBatch relation dropped by 20260708050504_new_mid.
-- NOT VALID preserves existing rows while enforcing tenant scope for future inserts and updates.

CREATE UNIQUE INDEX "import_batches_organization_id_id_key"
ON "import_batches"("organization_id", "id");

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_organization_id_import_batch_id_fkey"
FOREIGN KEY ("organization_id", "import_batch_id")
REFERENCES "import_batches"("organization_id", "id")
ON DELETE SET NULL ("import_batch_id") ON UPDATE CASCADE
NOT VALID;