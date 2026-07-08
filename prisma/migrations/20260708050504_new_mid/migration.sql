-- DropForeignKey
ALTER TABLE "import_rows" DROP CONSTRAINT "import_rows_organization_id_created_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "import_rows" DROP CONSTRAINT "import_rows_organization_id_import_batch_id_fkey";

-- DropForeignKey
ALTER TABLE "reconciliation_matches" DROP CONSTRAINT "reconciliation_matches_organization_id_bank_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "reconciliation_matches" DROP CONSTRAINT "reconciliation_matches_organization_id_ledger_transaction_id_fk";

-- DropForeignKey
ALTER TABLE "reconciliation_matches" DROP CONSTRAINT "reconciliation_matches_organization_id_reconciliation_run_id_fk";

-- DropForeignKey
ALTER TABLE "transaction_adjustments" DROP CONSTRAINT "transaction_adjustments_organization_id_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "transaction_review_notes" DROP CONSTRAINT "transaction_review_notes_organization_id_transaction_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_organization_id_bank_account_id_fkey";

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_organization_id_import_batch_id_fkey";

-- DropIndex
DROP INDEX "bank_accounts_organization_id_id_key";

-- DropIndex
DROP INDEX "import_batches_organization_id_id_key";

-- DropIndex
DROP INDEX "reconciliation_runs_organization_id_id_key";

-- DropIndex
DROP INDEX "transactions_organization_id_id_key";
