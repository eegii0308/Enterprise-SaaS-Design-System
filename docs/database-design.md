# Database Design

## Design Goals

The MVP database should support:

- Organization-scoped financial data.
- User membership and fixed role permissions.
- Imports from bank and ledger files.
- Transaction review and explicit corrections.
- Manual and rule-assisted reconciliation.
- Basic reports and audit logs.

All business data must include `organization_id`.

## Core Tables

### organizations

Stores tenant-level company settings.

Fields:

- `id`
- `name`
- `default_currency`
- `fiscal_year_start_month`
- `created_at`
- `updated_at`

### users

Stores application users. If using an external auth provider, this table should mirror profile data only.

Fields:

- `id`
- `email`
- `full_name`
- `status`
- `created_at`
- `updated_at`

### memberships

Connects users to organizations.

Fields:

- `id`
- `organization_id`
- `user_id`
- `role_id`
- `status`
- `invited_at`
- `joined_at`
- `created_at`
- `updated_at`

### roles

Stores fixed MVP roles.

Fields:

- `id`
- `organization_id`
- `name`
- `description`
- `is_system_role`
- `created_at`
- `updated_at`

Initial roles:

- Admin
- Finance Manager
- Accountant
- Auditor
- Viewer

### role_permissions

Stores permissions assigned to roles.

Fields:

- `id`
- `role_id`
- `permission`
- `created_at`

MVP permissions:

- `transactions.view`
- `transactions.edit`
- `transactions.note`
- `imports.create`
- `reconciliation.run`
- `reconciliation.approve`
- `reports.view`
- `reports.export`
- `matching_rules.manage`
- `users.manage`
- `settings.manage`
- `audit_logs.view`
- `audit_logs.export`

## Financial Data Tables

### bank_accounts

Stores bank or cash accounts used in reconciliation.

Fields:

- `id`
- `organization_id`
- `name`
- `bank_name`
- `masked_account_number`
- `currency`
- `status`
- `created_at`
- `updated_at`

### import_batches

Tracks uploaded files and processing status.

Fields:

- `id`
- `organization_id`
- `source_type`
- `file_name`
- `file_size`
- `file_storage_key`
- `file_hash`
- `status`
- `total_rows`
- `valid_rows`
- `error_rows`
- `created_by`
- `created_at`
- `completed_at`

Source types:

- `bank`
- `ledger`

Statuses:

- `uploaded`
- `processing`
- `completed`
- `completed_with_errors`
- `failed`

### import_rows

Stores raw uploaded rows and validation results before normalized transactions are created.

Fields:

- `id`
- `organization_id`
- `import_batch_id`
- `row_number`
- `raw_data`
- `normalized_data`
- `row_hash`
- `validation_status`
- `error_messages`
- `created_transaction_id`
- `created_at`

Validation statuses:

- `pending`
- `valid`
- `duplicate`
- `invalid`
- `processed`

### transactions

Stores normalized financial rows from bank and ledger sources.

Fields:

- `id`
- `organization_id`
- `import_batch_id`
- `source_type`
- `bank_account_id`
- `transaction_date`
- `description`
- `vendor`
- `reference`
- `debit_amount`
- `credit_amount`
- `amount`
- `currency`
- `status`
- `external_fingerprint`
- `created_at`
- `updated_at`

Statuses:

- `unmatched`
- `matched`
- `pending_review`
- `exception`

Amount rules:

- Store monetary values as `decimal(18, 2)` for MVP currencies.
- Exactly one of `debit_amount` or `credit_amount` must be positive.
- `amount` is the signed normalized value used for matching.
- Currency conversion is out of scope for MVP; imported rows must use the organization's supported currency.

### transaction_review_notes

Stores review notes without overwriting transaction history.

Fields:

- `id`
- `organization_id`
- `transaction_id`
- `note`
- `created_by`
- `created_at`

### transaction_adjustments

Stores explicit corrections while keeping imported transactions immutable.

Fields:

- `id`
- `organization_id`
- `transaction_id`
- `field_name`
- `old_value`
- `new_value`
- `reason`
- `created_by`
- `created_at`

### reconciliation_runs

Represents a reconciliation period or job.

Fields:

- `id`
- `organization_id`
- `name`
- `period_start`
- `period_end`
- `status`
- `created_by`
- `approved_by`
- `approved_at`
- `reopened_by`
- `reopened_at`
- `created_at`
- `completed_at`

Statuses:

- `draft`
- `in_progress`
- `ready_for_review`
- `approved`
- `reopened`

### reconciliation_matches

Stores matched transaction pairs or groups.

Fields:

- `id`
- `organization_id`
- `reconciliation_run_id`
- `bank_transaction_id`
- `ledger_transaction_id`
- `match_type`
- `confidence_score`
- `status`
- `created_by`
- `removed_by`
- `removed_at`
- `created_at`

Match types:

- `manual`
- `rule`

Statuses:

- `proposed`
- `confirmed`
- `rejected`
- `removed`

### matching_rules

Stores reusable matching rules.

Fields:

- `id`
- `organization_id`
- `name`
- `description`
- `vendor_pattern`
- `description_pattern`
- `reference_pattern`
- `amount_tolerance`
- `date_tolerance_days`
- `priority`
- `status`
- `created_by`
- `created_at`
- `updated_at`

Statuses:

- `draft`
- `active`
- `inactive`

### reports

Stores generated report metadata.

Fields:

- `id`
- `organization_id`
- `report_type`
- `period_start`
- `period_end`
- `status`
- `file_storage_key`
- `expires_at`
- `created_by`
- `created_at`

Report types:

- `reconciliation_summary`
- `exception_list`
- `unmatched_transactions`

### audit_logs

Stores important user and system actions.

Fields:

- `id`
- `organization_id`
- `actor_user_id`
- `action`
- `resource_type`
- `resource_id`
- `metadata`
- `ip_address`
- `created_at`

## Data Rules

- Never query financial data without `organization_id`.
- Imports should be immutable after processing; corrections should create adjustment records and audit events.
- Confirmed reconciliation matches should be auditable.
- Deleting financial records should be avoided in MVP; prefer status changes.
- Use unique indexes for memberships, import row hashes, external transaction fingerprints, roles, and role permissions where appropriate.
- Use composite foreign keys or equivalent checks so matched transactions belong to the same organization and reconciliation run scope.
- Store uploaded and generated files under tenant-scoped storage keys.