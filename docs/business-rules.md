# Business Rules

## Organization Scoping

- Every user acts within an organization.
- Every financial record belongs to one organization.
- Users cannot view or modify records from another organization.
- Organization settings define default currency and fiscal year start month.

## Roles

Initial MVP roles:

- Admin: manages organization settings, users, role assignment, and all reconciliation data.
- Finance Manager: manages imports, transactions, reconciliation, reports, and approvals.
- Accountant: imports data, reviews transactions, and performs reconciliation work.
- Auditor: views transactions, reports, reconciliation history, and audit logs.
- Viewer: read-only access to dashboard, transactions, and reports.

Custom role and permission editing is deferred for MVP.

## Separation Of Duties

- Accountants can prepare reconciliation work but cannot approve a run.
- Finance Managers and Admins can approve reconciliation runs.
- If one preparer/approver separation is required by launch policy, the user who created the run cannot approve it.
- Report export requires `reports.export`.
- Audit-log export requires `audit_logs.export`.

## Transactions

- Transactions originate from bank or ledger imports.
- Transactions can be `unmatched`, `matched`, `pending_review`, or `exception`.
- Matched transactions should reference a reconciliation match.
- Financial amounts use `decimal(18, 2)` for MVP.
- Debit and credit values are mutually exclusive; exactly one must be positive.
- A signed normalized `amount` is used for matching.
- Currency conversion is out of scope for MVP.
- Transaction corrections create adjustment records and audit logs.

## Imports

- Imports are grouped into import batches.
- Imports can represent bank data or ledger data.
- Import processing should validate required fields before creating transaction records.
- Required MVP fields are transaction date, description, amount or debit/credit, currency, and source type.
- Users must confirm column mapping before processing.
- Duplicate uploads and duplicate rows should be detected with file and row fingerprints.
- MVP imports should enforce documented file size and row limits.
- Failed rows should be visible to the user.
- Import batches should not be silently deleted after processing.
- Uploaded files should use tenant-scoped storage keys and a documented retention policy.

## Reconciliation

- A reconciliation run covers a defined period.
- Reconciliation run states are `draft`, `in_progress`, `ready_for_review`, `approved`, and `reopened`.
- A bank transaction can be manually matched to a ledger transaction.
- Confirmed matches update related transaction statuses to `matched`.
- Rejected proposed matches should remain auditable.
- Exceptions require review before the reconciliation run is considered complete.
- Approved runs are locked from normal edits. Changes require reopening and an audit log entry.

## Matching Rules

- Matching rules can propose matches.
- Matching rules do not silently approve matches unless explicitly allowed in a later release.
- Rules should support MVP conditions:
  - vendor pattern
  - description pattern
  - reference pattern
  - amount tolerance
  - date tolerance
  - priority
- Inactive rules should not create new proposed matches.

## Reports

- Reports summarize reconciliation results for a date period.
- MVP reports should include:
  - reconciliation summary
  - exception list
  - unmatched transaction list
- Generated reports should record who created them and when.

## Audit Logs

Audit logs are required for:

- Sign-in sensitive events where available.
- Imports created or processed.
- Transactions edited.
- Matches created, confirmed, rejected, or removed.
- Reconciliation runs completed or approved.
- Matching rules created or changed.
- Users invited, disabled, or assigned a new role.
- Organization settings changed.
- Reports exported.
- Audit logs exported.

## Security

- Client UI cannot be the source of truth for permissions.
- Server-side authorization is required for every read and mutation.
- File uploads must be validated for type and size.
- Error messages must not expose implementation details.
- Organization scope must be enforced in data access helpers or database row-level security.
- Auth, upload, and export endpoints should be rate-limited.