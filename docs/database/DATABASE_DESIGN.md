# Database Design

## Current Implementation

E-Reconcile uses Prisma with PostgreSQL. The Prisma schema is located at `prisma/schema.prisma`, and migrations are stored in `prisma/migrations`.

The database model is tenant-centered. Organization-owned records include `organizationId` and should be queried through the active session organization.

## Prisma Models

### SaaS identity models

- `Organization`
- `User`
- `Session`
- `Membership`
- `Role`
- `RolePermission`

### Financial setup models

- `BankAccount`
- `MatchingRule`

### Import models

- `ImportBatch`
- `ImportRow`

### Transaction models

- `Transaction`
- `TransactionReviewNote`
- `TransactionAdjustment`

### Reconciliation models

- `ReconciliationRun`
- `ReconciliationMatch`

### Reporting and audit models

- `Report`
- `AuditLog`

## Relationships

### Organization ownership

`Organization` is the root tenant model. Most operational data belongs to one organization.

### User membership

Users are globally unique by email. Access to an organization is represented through `Membership`. Each membership references:

- Organization
- User
- Role

### Roles and permissions

Roles are organization-scoped. Role permissions are stored separately and linked to `Role`.

### Imports and transactions

Import batches own import rows. Valid import rows can create transactions. Transactions can reference an import batch and optionally a bank account.

### Reconciliation

Reconciliation runs group matches. A reconciliation match links one bank transaction to one ledger transaction.

### Audit logs

Audit logs belong to an organization and store actor, action, resource, metadata, optional IP address, and timestamp.

## Tenant Ownership

Organization-owned models currently include:

- `BankAccount`
- `ImportBatch`
- `ImportRow`
- `Transaction`
- `TransactionReviewNote`
- `TransactionAdjustment`
- `ReconciliationRun`
- `ReconciliationMatch`
- `MatchingRule`
- `Report`
- `AuditLog`
- `Membership`
- `Role`

Every query and mutation for these models should be scoped to the active organization.

## Indexes and Constraints

Current important constraints include:

- `User.email` unique.
- `Membership` unique by organization and user.
- `Role` unique by organization and name.
- `RolePermission` unique by role and permission.
- `ImportBatch` unique by organization and file hash.
- `ImportRow` unique by organization, import batch, and row number.
- `ImportRow` unique by organization and row hash.
- `Transaction` unique by organization and external fingerprint.

Current important indexes include:

- Import batch by organization and creation time.
- Import batch by organization and status.
- Import rows by organization, import batch, and validation status.
- Transactions by organization and status.
- Transactions by organization, source type, status, and transaction date.
- Transactions by organization and import batch.
- Transactions by organization, bank account, and transaction date.
- Reconciliation runs by organization and status.
- Reconciliation matches by organization and run.
- Reports by organization and report type.
- Audit logs by organization and creation time.

## Migration Strategy

Current documented strategy:

- Prisma migrations are the source of truth.
- Schema changes should create committed migration files.
- `prisma db push` should not be used for shared development.
- Clean database migration verification is recommended before feature phases.

Known limitation:

- The current migration history appears inconsistent around tenant hardening constraints and should be verified against a clean PostgreSQL database.

## Financial Tables

Financial tables include:

- `BankAccount`
- `ImportBatch`
- `ImportRow`
- `Transaction`
- `TransactionReviewNote`
- `TransactionAdjustment`
- `ReconciliationRun`
- `ReconciliationMatch`
- `MatchingRule`
- `Report`
- `AuditLog`

These tables must be treated as high-integrity data stores.

## Transaction Tables

`Transaction` is the central financial record created from imports. It stores source type, date, amount fields, currency, reference, description, status, and external fingerprint.

Known limitation:

- Imported transaction facts are mutable at the database level.

Future improvement:

- Enforce correction-through-adjustment rather than direct fact mutation.

## Reconciliation Tables

`ReconciliationRun` models a reconciliation workflow period and status. `ReconciliationMatch` links bank and ledger transactions.

Known limitation:

- Active match uniqueness is currently application-enforced.

Future improvement:

- Add database-level safeguards to prevent duplicate active matches.

## Audit Tables

`AuditLog` stores audit events by organization.

Known limitation:

- There is no central audit service or event catalog yet.

Future improvement:

- Standardize action names, metadata, retention, actor handling, and request context.

## Consolidation note

This document is the database design source of truth. The previous flat docs/database-design.md file was consolidated here as legacy design-goal and table-field context below.

## Legacy database design context

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
