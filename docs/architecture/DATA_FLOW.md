# Data Flow

## Current Transaction Lifecycle

```text
Import file
  ↓
Import batch
  ↓
Import rows
  ↓
Transaction creation
  ↓
Reconciliation process
  ↓
Matching
  ↓
Audit logging
```

## Import File

Current implementation:

- Users with `imports.create` can upload CSV files from `/dashboard/imports`.
- Uploads are handled by `app/dashboard/imports/actions.ts`.
- Files are limited to 20 MB.
- Supported source types are `BANK` and `LEDGER`.
- Files are hashed with SHA-256.
- Files are stored using a tenant-scoped key under `organizations/{organizationId}/imports/{fileHash}/{safeFileName}`.

Known limitations:

- Processing happens synchronously in the server action.
- Storage is local filesystem-based by default through `IMPORT_UPLOAD_ROOT` or `.uploads`.
- CSV support is custom and limited.

Future improvements:

- Move import processing to a background worker.
- Use durable object storage for production.
- Add import retries, observability, and operational recovery steps.

## Import Batch

Current implementation:

- Each upload creates an `ImportBatch`.
- `ImportBatch` stores organization, source type, file metadata, file hash, status, counts, column mapping, and processing errors.
- Duplicate files are prevented per organization by `@@unique([organizationId, fileHash])`.
- Import creation writes an audit log event.

Known limitations:

- Idempotency depends mainly on file hash and status checks.
- Migration history around tenant constraints must be verified.

Future improvements:

- Add explicit idempotency keys for upload requests.
- Add operational tooling for failed or stuck batches.

## Import Rows

Current implementation:

- `lib/imports/csv-core.ts` parses CSV content and prepares row records.
- Rows store raw data, normalized data, row hash, validation status, and error messages.
- Valid rows are later converted into transactions.
- Duplicate rows inside an import are marked with `DUPLICATE`.

Known limitations:

- CSV parser is hand-written.
- Row validation is intentionally basic.
- Row hash includes import batch and row identity, while transaction duplicate detection uses normalized transaction fingerprint.

Future improvements:

- Use a robust CSV parser.
- Add schema-driven validation per bank/ledger format.
- Preserve richer row-level diagnostics.

## Transaction Creation

Current implementation:

- Valid import rows create `Transaction` records.
- Transactions include source type, date, description, reference, vendor, amount, debit/credit amounts, currency, status, and external fingerprint.
- Duplicate transactions are detected per organization by `@@unique([organizationId, externalFingerprint])`.
- Created rows are linked to the created transaction through `createdTransactionId`.

Known limitations:

- Imported financial facts are stored in mutable transaction rows.
- No database trigger prevents later direct modification of imported facts.
- Adjustment records exist in the schema but are not yet used by implemented transaction edit flows.

Future improvements:

- Treat imported transaction facts as immutable.
- Require adjustments and audit logs for corrections.
- Add transaction edit workflows only after integrity controls exist.

## Reconciliation Process

Current implementation:

- `/dashboard/reconciliation` lists unmatched bank and ledger transactions.
- Queries are scoped by the active session organization.
- Pagination is implemented for bank and ledger queues.
- Filters include date range, amount, and source type.

Known limitations:

- Automatic matching is not active.
- Approval lifecycle is modeled but not fully implemented in application flows.
- Matching rules are modeled but not yet implemented as an active workflow.

Future improvements:

- Add explicit reconciliation run lifecycle controls.
- Add approval, reopening, and lock behavior.
- Add rule-based match proposal workflows after manual matching is stable.

## Matching

Current implementation:

- Manual matching is implemented in `lib/reconciliation/manual-match.ts`.
- The server action requires `reconciliation.run`.
- The match function validates:
  - Both IDs are present.
  - The bank and ledger transactions are different.
  - Both transactions belong to the current organization.
  - Source types are `BANK` and `LEDGER`.
  - Both transactions are currently `UNMATCHED`.
  - No active match already includes either transaction.
- The function creates or reuses an open manual reconciliation run.
- The match is created with status `CONFIRMED`.
- Both transactions are updated to `MATCHED`.
- An audit log event is written.

Known limitations:

- Existing-match prevention is application-level.
- Transaction updates use primary IDs after validation.
- Database-level active-match uniqueness is not yet visible.

Future improvements:

- Add conditional tenant- and status-scoped updates.
- Add database constraints or partial unique indexes to prevent duplicate active matches.
- Add match removal/reversal workflow with audit logs.

## Audit Logging

Current implementation:

Audit logs are written for:

- First organization creation.
- Import creation.
- Import processing start.
- Import completion.
- Import failure.
- Manual reconciliation match creation.

Known limitations:

- No central audit service exists.
- Audit event names and metadata are not centralized.
- Audit coverage is incomplete for future financial workflows.

Future improvements:

- Create an audit event catalog.
- Use one shared audit writer.
- Capture actor, organization, resource, metadata, request ID, IP, and user agent where appropriate.

## Data Ownership

The session determines the active `organizationId`. Financial reads and writes should always use that organization boundary.

Current organization-owned data includes:

- Bank accounts
- Import batches
- Import rows
- Transactions
- Transaction notes
- Transaction adjustments
- Reconciliation runs
- Reconciliation matches
- Matching rules
- Reports
- Audit logs

## Organization Boundaries

Current implementation relies on:

- `organizationId` fields.
- Session-derived organization context.
- Permission checks before sensitive pages and actions.
- Prisma query filters using `organizationId`.
- Tenant-scoped file storage keys.

Known risks:

- Composite foreign key migrations need repair.
- Not all model relations are guaranteed tenant-enforced in the final migrated database.

Future improvements:

- Complete database-level tenant constraints.
- Add tenant-isolation tests for every organization-owned model.
- Consider PostgreSQL row-level security after application rules are stable.
