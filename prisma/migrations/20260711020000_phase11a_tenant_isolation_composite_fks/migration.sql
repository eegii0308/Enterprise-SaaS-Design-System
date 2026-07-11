-- Tenant isolation hardening (composite organization_id foreign keys), part 1 of 2.
--
-- Adds organization-scoped composite foreign keys for every organization-owned
-- sibling relation that previously only constrained the referenced `id`
-- column (see docs/security/TENANT_ISOLATION.md and
-- docs/audits/PHASE_PRODUCTION_READINESS_AUDIT.md). Without these, a missed
-- `organizationId` filter anywhere in application code could create a
-- cross-tenant financial record with no database-level guarantee against it.
--
-- Composite foreign keys are added NOT VALID: enforced immediately for all
-- new inserts/updates, but existing rows are not scanned here, so this step
-- does not hold a lock for longer than it takes to register the constraint.
-- A separate follow-up migration (phase11b) runs VALIDATE CONSTRAINT to
-- confirm existing rows already comply. A manual audit query run before this
-- migration was written found 0 cross-tenant violations across all 13
-- relations in the current database; re-run the same audit against every
-- other environment before applying phase11b there.
--
-- This migration is purely additive: the original single-column foreign keys
-- on these same columns are intentionally left in place. No existing
-- constraint is dropped or replaced, so referential-integrity guarantees are
-- never weakened, even transiently, and this migration cannot itself cause
-- data loss (it contains no DML, only DDL that adds indexes/constraints).
--
-- CREATE UNIQUE INDEX (below) takes a full ACCESS EXCLUSIVE lock and scans
-- the table for the duration of the build -- unlike the NOT VALID foreign
-- keys, this does touch existing data. At today's row counts (low double
-- digits per table) that lock is sub-millisecond. Before running this
-- migration against an environment with meaningful production data volume on
-- "transactions" or "reconciliation_matches", apply the CREATE UNIQUE INDEX
-- CONCURRENTLY equivalent of each index below manually (e.g. via
-- `prisma db execute`, which -- unlike `prisma migrate dev`/`deploy` -- does
-- not wrap the statement in a transaction, so CONCURRENTLY is usable there),
-- then mark this migration applied with
-- `prisma migrate resolve --applied 20260711020000_phase11a_tenant_isolation_composite_fks`
-- instead of letting `migrate deploy` run this file as-is.

-- Supporting unique indexes: a composite foreign key can only reference a
-- unique key on the parent table. import_batches(organization_id, id)
-- already exists (added in
-- 20260708100000_phase_5d_restore_transaction_import_batch_tenant_fk) and is
-- reused as-is; not recreated here.
CREATE UNIQUE INDEX "roles_organization_id_id_key" ON "roles"("organization_id", "id");
CREATE UNIQUE INDEX "memberships_organization_id_id_key" ON "memberships"("organization_id", "id");
CREATE UNIQUE INDEX "bank_accounts_organization_id_id_key" ON "bank_accounts"("organization_id", "id");
CREATE UNIQUE INDEX "transactions_organization_id_id_key" ON "transactions"("organization_id", "id");
CREATE UNIQUE INDEX "reconciliation_runs_organization_id_id_key" ON "reconciliation_runs"("organization_id", "id");
CREATE UNIQUE INDEX "reconciliation_matches_organization_id_id_key" ON "reconciliation_matches"("organization_id", "id");

-- Required by Prisma for the ImportRow.createdTransaction one-to-one
-- relation: the exact composite field pair used by that relation's FK must
-- itself be declared unique on the defining side. created_transaction_id
-- already has a plain single-column unique index; this is the composite
-- counterpart Prisma needs, not an additional real-world constraint.
CREATE UNIQUE INDEX "import_rows_organization_id_created_transaction_id_key" ON "import_rows"("organization_id", "created_transaction_id");

-- Memberships and invitations must reference a role in the same
-- organization. Required relation; RESTRICT matches the existing
-- single-column FK's current behavior exactly.
ALTER TABLE "memberships"
  ADD CONSTRAINT "memberships_organization_id_role_id_fkey"
  FOREIGN KEY ("organization_id", "role_id")
  REFERENCES "roles"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_organization_id_role_id_fkey"
  FOREIGN KEY ("organization_id", "role_id")
  REFERENCES "roles"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

-- Invitations must reference a membership in the same organization, when
-- membership_id is set. Optional relation; the existing single-column FK
-- currently SET NULLs membership_id on delete. A composite FK cannot use
-- SET NULL here because organization_id (part of the same key) is NOT NULL,
-- so this uses NO ACTION instead -- see explanation notes for what that
-- means in combination with the untouched original FK.
ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_organization_id_membership_id_fkey"
  FOREIGN KEY ("organization_id", "membership_id")
  REFERENCES "memberships"("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE
  NOT VALID;

-- Transactions must reference a bank account in the same organization, when
-- bank_account_id is set. Same SET NULL -> NO ACTION reasoning as above.
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_organization_id_bank_account_id_fkey"
  FOREIGN KEY ("organization_id", "bank_account_id")
  REFERENCES "bank_accounts"("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE
  NOT VALID;

-- Reconciliation runs must reference a bank account in the same
-- organization. Required relation; RESTRICT matches the existing
-- single-column FK's current behavior exactly.
ALTER TABLE "reconciliation_runs"
  ADD CONSTRAINT "reconciliation_runs_organization_id_bank_account_id_fkey"
  FOREIGN KEY ("organization_id", "bank_account_id")
  REFERENCES "bank_accounts"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

-- Notes and adjustments must reference a transaction in the same
-- organization. Required relation; CASCADE matches the existing
-- single-column FK's current behavior exactly.
ALTER TABLE "transaction_review_notes"
  ADD CONSTRAINT "transaction_review_notes_organization_id_transaction_id_fkey"
  FOREIGN KEY ("organization_id", "transaction_id")
  REFERENCES "transactions"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "transaction_adjustments"
  ADD CONSTRAINT "transaction_adjustments_organization_id_transaction_id_fkey"
  FOREIGN KEY ("organization_id", "transaction_id")
  REFERENCES "transactions"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

-- Import rows must reference an import batch in the same organization.
-- Required relation; CASCADE matches the existing single-column FK's current
-- behavior exactly.
ALTER TABLE "import_rows"
  ADD CONSTRAINT "import_rows_organization_id_import_batch_id_fkey"
  FOREIGN KEY ("organization_id", "import_batch_id")
  REFERENCES "import_batches"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

-- Import rows must reference their created transaction in the same
-- organization, when created_transaction_id is set. Same SET NULL ->
-- NO ACTION reasoning as above.
ALTER TABLE "import_rows"
  ADD CONSTRAINT "import_rows_organization_id_created_transaction_id_fkey"
  FOREIGN KEY ("organization_id", "created_transaction_id")
  REFERENCES "transactions"("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE
  NOT VALID;

-- Reconciliation matches must reference their run, bank transaction, and
-- ledger transaction, all in the same organization. Required relations;
-- CASCADE / RESTRICT / RESTRICT match the existing single-column FKs'
-- current behavior exactly.
ALTER TABLE "reconciliation_matches"
  ADD CONSTRAINT "reconciliation_matches_organization_id_reconciliation_run__fkey"
  FOREIGN KEY ("organization_id", "reconciliation_run_id")
  REFERENCES "reconciliation_runs"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "reconciliation_matches"
  ADD CONSTRAINT "reconciliation_matches_organization_id_bank_transaction_id_fkey"
  FOREIGN KEY ("organization_id", "bank_transaction_id")
  REFERENCES "transactions"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "reconciliation_matches"
  ADD CONSTRAINT "reconciliation_matches_organization_id_ledger_transaction__fkey"
  FOREIGN KEY ("organization_id", "ledger_transaction_id")
  REFERENCES "transactions"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

-- Reconciliation matches must reference their corrected-from match, when
-- set, in the same organization (self-relation). Optional relation; same
-- SET NULL -> NO ACTION reasoning as above.
ALTER TABLE "reconciliation_matches"
  ADD CONSTRAINT "reconciliation_matches_organization_id_corrected_from_matc_fkey"
  FOREIGN KEY ("organization_id", "corrected_from_match_id")
  REFERENCES "reconciliation_matches"("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE
  NOT VALID;
