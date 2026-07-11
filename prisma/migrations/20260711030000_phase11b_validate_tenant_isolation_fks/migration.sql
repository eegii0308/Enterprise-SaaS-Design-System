-- Tenant isolation hardening (composite organization_id foreign keys), part 2 of 2.
--
-- Validates the 13 NOT VALID composite foreign keys added in
-- 20260711020000_phase11a_tenant_isolation_composite_fks. VALIDATE CONSTRAINT
-- takes only a SHARE UPDATE EXCLUSIVE lock (it does not block ordinary reads
-- or writes, only other concurrent DDL on the same table) and scans the
-- table to confirm every existing row already satisfies the constraint.
--
-- Kept in its own migration/transaction, separate from the NOT VALID
-- ADD CONSTRAINT statements in phase11a, specifically so this scan does not
-- run while still holding whatever lock was acquired to add the constraint --
-- ordinary traffic proceeds normally between the two migrations.
--
-- Before applying this migration in any environment, re-run the cross-tenant
-- audit query for each relation below (e.g. for the first one:
-- `SELECT count(*) FROM memberships m JOIN roles r ON r.id = m.role_id
--  WHERE m.organization_id <> r.organization_id`) and resolve any non-zero
-- result as a data-integrity incident before validating -- do not relax the
-- constraint to work around a real violation. This was verified clean (0
-- violations on all 13 relations) against the database this migration was
-- written against; that result does not carry over to other environments.
--
-- All 13 statements are bundled in this one migration for convenience at
-- today's small data volume. Before running this against an environment with
-- meaningful row counts on "transactions" or "reconciliation_matches", split
-- these into separate statements applied one at a time (e.g. via
-- `prisma db execute` for each), during a low-traffic window, watching
-- pg_stat_activity / lock waits between each -- validate the small
-- low-traffic tables (roles, memberships, invitations) first to prove the
-- pattern, then the high-volume financial tables last.

ALTER TABLE "memberships" VALIDATE CONSTRAINT "memberships_organization_id_role_id_fkey";
ALTER TABLE "invitations" VALIDATE CONSTRAINT "invitations_organization_id_role_id_fkey";
ALTER TABLE "invitations" VALIDATE CONSTRAINT "invitations_organization_id_membership_id_fkey";
ALTER TABLE "transactions" VALIDATE CONSTRAINT "transactions_organization_id_bank_account_id_fkey";
ALTER TABLE "reconciliation_runs" VALIDATE CONSTRAINT "reconciliation_runs_organization_id_bank_account_id_fkey";
ALTER TABLE "transaction_review_notes" VALIDATE CONSTRAINT "transaction_review_notes_organization_id_transaction_id_fkey";
ALTER TABLE "transaction_adjustments" VALIDATE CONSTRAINT "transaction_adjustments_organization_id_transaction_id_fkey";
ALTER TABLE "import_rows" VALIDATE CONSTRAINT "import_rows_organization_id_import_batch_id_fkey";
ALTER TABLE "import_rows" VALIDATE CONSTRAINT "import_rows_organization_id_created_transaction_id_fkey";
ALTER TABLE "reconciliation_matches" VALIDATE CONSTRAINT "reconciliation_matches_organization_id_reconciliation_run__fkey";
ALTER TABLE "reconciliation_matches" VALIDATE CONSTRAINT "reconciliation_matches_organization_id_bank_transaction_id_fkey";
ALTER TABLE "reconciliation_matches" VALIDATE CONSTRAINT "reconciliation_matches_organization_id_ledger_transaction__fkey";
ALTER TABLE "reconciliation_matches" VALIDATE CONSTRAINT "reconciliation_matches_organization_id_corrected_from_matc_fkey";
