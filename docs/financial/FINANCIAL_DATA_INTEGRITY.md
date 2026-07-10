# Financial Data Integrity

## Policy Direction

E-Reconcile should treat financial records as high-integrity records. Imported transaction facts should not be silently changed. Corrections should be explicit, traceable, permissioned, and auditable.

## Imported Transaction Data

### Current implementation

Transactions are created from valid import rows. Each transaction includes:

- Organization
- Import batch
- Source type
- Transaction date
- Description
- Vendor
- Reference
- Debit amount
- Credit amount
- Net amount
- Currency
- Status
- External fingerprint

Duplicate transactions are prevented per organization with `@@unique([organizationId, externalFingerprint])`.

### Policy

Imported transaction data should be immutable after creation.

### Current risk

The database model does not currently enforce immutability. Application code can update transaction status for matching, and future code could update financial facts unless guarded.

### Future controls

- Separate mutable workflow state from imported financial facts where practical.
- Prevent direct edits to imported facts.
- Require adjustments for corrections.
- Audit every correction.
- Lock records that belong to approved reconciliation runs.

## Corrections

### Current implementation

The schema includes `TransactionAdjustment`, but no implemented transaction correction workflow was found in the current app routes.

### Policy

Corrections should use adjustment records instead of overwriting imported values.

### Future controls

Every adjustment should record:

- Organization
- Transaction
- Field name
- Old value
- New value
- Reason
- Actor
- Timestamp
- Audit log event

## Changes

### Current implementation

Manual matching changes transaction status from `UNMATCHED` to `MATCHED` and writes an audit log event.

Import processing changes import row statuses and import batch statuses.

### Policy

Financial workflow changes require audit logs.

### Current risks

- Audit coverage is not centralized.
- Future mutations could be added without audit logs.
- No database-level rule enforces audit logging.
- Approval and reopening workflows are modeled but not fully implemented.

### Future controls

- Create a shared audit writer.
- Require audit events for every financial mutation.
- Add tests that fail if major mutations do not write audit logs.
- Define approval lock behavior.
- Define reopening behavior.

## Reconciliation Integrity

### Current implementation

Manual matching validates:

- Bank and ledger transaction IDs are provided.
- The transactions are different records.
- Both transactions belong to the current organization.
- Source types are correct.
- Both transactions are unmatched.
- Neither transaction already has a non-removed match.

### Current risks

- Active match uniqueness is not visibly enforced at the database level.
- Concurrent matching could still create duplicate matches if application checks race.

### Future controls

- Use tenant- and status-scoped conditional updates.
- Add database-level active-match uniqueness.
- Preserve match removal history.
- Require audit logs for creation, rejection, removal, approval, and reopening.

## Import Integrity

### Current implementation

Import processing:

- Stores uploaded file bytes.
- Creates an import batch.
- Parses CSV rows.
- Creates import rows.
- Converts valid rows to transactions.
- Marks duplicates.
- Updates batch summary counts.
- Writes lifecycle audit events.

### Current risks

- Processing is synchronous.
- CSV parser is limited.
- Local file storage is not sufficient for production durability.

### Future controls

- Background processing.
- Durable object storage.
- Import retry and recovery workflow.
- Stronger validation by source format.
- Operational dashboards for failed imports.
