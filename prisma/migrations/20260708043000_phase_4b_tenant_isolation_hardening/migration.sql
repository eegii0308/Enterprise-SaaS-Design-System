-- Phase 4B tenant isolation hardening.
-- Composite foreign keys are added NOT VALID to preserve existing records while
-- enforcing organization-scoped relationships for new inserts and updates.

-- Required referenced keys for organization-scoped foreign keys.
CREATE UNIQUE INDEX  import_batches_organization_id_id_key
ON import_batches(organization_id, id);

CREATE UNIQUE INDEX bank_accounts_organization_id_id_key
ON bank_accounts(organization_id, id);

CREATE UNIQUE INDEX transactions_organization_id_id_key
ON transactions(organization_id, id);

CREATE UNIQUE INDEX reconciliation_runs_organization_id_id_key
ON reconciliation_runs(organization_id, id);

-- Import rows must belong to batches and created transactions in the same organization.
ALTER TABLE import_rows
ADD CONSTRAINT import_rows_organization_id_import_batch_id_fkey
FOREIGN KEY (organization_id, import_batch_id)
REFERENCES import_batches(organization_id, id)
ON DELETE CASCADE ON UPDATE CASCADE
NOT VALID;

ALTER TABLE import_rows
ADD CONSTRAINT import_rows_organization_id_created_transaction_id_fkey
FOREIGN KEY (organization_id, created_transaction_id)
REFERENCES transactions(organization_id, id)
ON DELETE SET NULL (created_transaction_id) ON UPDATE CASCADE
NOT VALID;

-- Transactions must reference batches and bank accounts in the same organization.
ALTER TABLE transactions
ADD CONSTRAINT transactions_organization_id_import_batch_id_fkey
FOREIGN KEY (organization_id, import_batch_id)
REFERENCES import_batches(organization_id, id)
ON DELETE SET NULL (import_batch_id) ON UPDATE CASCADE
NOT VALID;

ALTER TABLE transactions
ADD CONSTRAINT transactions_organization_id_bank_account_id_fkey
FOREIGN KEY (organization_id, bank_account_id)
REFERENCES bank_accounts(organization_id, id)
ON DELETE SET NULL (bank_account_id) ON UPDATE CASCADE
NOT VALID;

-- Notes and adjustments must reference transactions in the same organization.
ALTER TABLE transaction_review_notes
ADD CONSTRAINT transaction_review_notes_organization_id_transaction_id_fkey
FOREIGN KEY (organization_id, transaction_id)
REFERENCES transactions(organization_id, id)
ON DELETE CASCADE ON UPDATE CASCADE
NOT VALID;

ALTER TABLE transaction_adjustments
ADD CONSTRAINT transaction_adjustments_organization_id_transaction_id_fkey
FOREIGN KEY (organization_id, transaction_id)
REFERENCES transactions(organization_id, id)
ON DELETE CASCADE ON UPDATE CASCADE
NOT VALID;

-- Reconciliation matches must reference runs and transactions in the same organization.
ALTER TABLE reconciliation_matches
ADD CONSTRAINT reconciliation_matches_organization_id_reconciliation_run_id_fkey
FOREIGN KEY (organization_id, reconciliation_run_id)
REFERENCES reconciliation_runs(organization_id, id)
ON DELETE CASCADE ON UPDATE CASCADE
NOT VALID;

ALTER TABLE reconciliation_matches
ADD CONSTRAINT reconciliation_matches_organization_id_bank_transaction_id_fkey
FOREIGN KEY (organization_id, bank_transaction_id)
REFERENCES transactions(organization_id, id)
ON DELETE RESTRICT ON UPDATE CASCADE
NOT VALID;

ALTER TABLE reconciliation_matches
ADD CONSTRAINT reconciliation_matches_organization_id_ledger_transaction_id_fkey
FOREIGN KEY (organization_id, ledger_transaction_id)
REFERENCES transactions(organization_id, id)
ON DELETE RESTRICT ON UPDATE CASCADE
NOT VALID;