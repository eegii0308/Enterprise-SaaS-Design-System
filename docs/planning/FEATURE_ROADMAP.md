# Feature Roadmap

## MVP Priority

The product should first become a working reconciliation SaaS, not a complete enterprise platform. The current prototype includes many good concepts, but implementation should be staged around one complete import-to-report cycle.

## Phase 0: Foundation

- Migrate from Vite prototype structure to Next.js App Router.
- Split `App.tsx` into route pages and feature components.
- Add TypeScript config, linting, formatting, and test scripts.
- Establish shared UI primitives.
- Create domain types for users, roles, imports, transactions, reconciliation, reports, and audit logs.
- Add environment variable conventions.

## Phase 1: Authentication And Organization Access

- Implement sign in and sign out.
- Implement registration for the first organization admin.
- Add protected dashboard routes.
- Add membership model.
- Add fixed system roles and permissions.
- Add admin-created users or memberships for MVP.
- Add server-side authorization checks.
- Add organization scoping tests.

## Phase 2: Dashboard And Transactions

- Implement dashboard summary endpoint. (done)
- Implement transaction list with pagination, search, and status filter. (done — `/dashboard/transactions`)
- Implement transaction detail view. (done — `/dashboard/transactions/[transactionId]`, Phase 8B)
- Add an auditable transaction correction workflow, preserving prior values as history. (done — Phase 8B, `lib/transactions/adjustment.ts`; not part of the original scope but a natural extension of the detail view)
- Add transaction review notes. (not yet implemented — the `TransactionReviewNote` model exists but has no service or UI)
- Add loading, error, and empty states.
- Replace hardcoded mock data with API-backed data. (done)

## Phase 3: Imports

- Implement CSV/XLSX upload. (partially done — CSV upload is implemented; XLSX is not yet supported)
- Add import batch tracking. (done)
- Add mapping confirmation. (partially done — column mapping is auto-detected and stored, but not presented to the user for confirmation before processing)
- Add row-level validation errors. (done — stored on `ImportRow` and surfaced in the Phase 8A results viewer at `/dashboard/imports/[importBatchId]` with row number, reason, and source values)
- Add duplicate detection and idempotency checks. (done — duplicate file hashes and duplicate/fingerprint-matching rows are both detected)
- Add documented file size and row limits. (partially done — a 20 MB file size cap is enforced; there is no row-count limit yet)
- Add import history. (done — the imports list page plus the Phase 8A per-batch results viewer with pagination, status filtering, and search)
- Normalize bank and ledger rows into the transaction model. (done)

## Phase 4: Reconciliation

Status: Explicit reconciliation run creation, manual match creation, confirmed-match removal (unmatch), match correction, match rejection, exception marking, and the full reconciliation run lifecycle (create, submit for review, approve, reopen) are implemented in the reconciliation workspace, backed by automated tests, including regression tests for concurrent match edits racing run lifecycle transitions.

- Implement reconciliation run creation. (done — a run is created explicitly by selecting a bank account and reconciliation period; a run previously created automatically on the first confirmed match)
- Show unmatched bank and ledger transactions, scoped to the selected run's bank account and period. (done)
- Support manual matching, validated against the selected run's bank account and period. (done)
- Support match confirmation/rejection. (done)
- Support match removal (unmatch) of confirmed matches, reverting both transactions to unmatched. (done)
- Support match correction, replacing one side of a confirmed match with a required reason and preserving history via `correctedFromMatchId`. (done)
- Update transaction statuses after confirmed matches. (done)
- Add exception status and review notes. (exception marking/clearing done; review notes not yet implemented)
- Add lifecycle states: draft, in progress, ready for review, approved, reopened. (done — submit-for-review, approval, and reopening transitions are implemented)
- Lock matches from being created, removed, or corrected while a run is ready for review or approved. (done — atomically re-verified via CAS immediately before each mutation, not just at read time)
- Add approval permissions and audit logs. (done — `reconciliation.run` and `reconciliation.approve` are enforced server-side, and match creation, match removal, match correction, run submission, run approval, and run reopening each write audit log events)
- Prevent overlapping open reconciliation runs for the same bank account and period. (done)
- Manage bank accounts (create, edit, archive, reactivate), restricted to Admin/Finance Manager via a `bank_accounts.manage` permission, preventing duplicate active accounts for the same bank and account number while keeping archived accounts' historical reconciliation references intact. (done — `/dashboard/bank-accounts`)
- Evaluate financial variance, unmatched bank/ledger transactions, and open exceptions before a run can be approved, requiring an explicit approval reason when any are outstanding and recording the approving user, reason, and a full approval snapshot in the audit trail. (done — `evaluateApprovalReadiness` in `lib/reconciliation/approval-validation.ts`, enforced inside `approveReconciliationRun`)

Next planned work: review notes on exceptions/unresolved records; automated matching rules (numbered Phase 7 below).

## Phase 5: Audit And Controls

- Add audit logs for imports, transaction edits, matches, approvals, user changes, settings changes, and exports.
- Add separation-of-duties checks if required by launch policy.
- Add tenant-safe file storage keys.
- Add rate limits for auth, upload, and export endpoints.

## Phase 6: Reports

- Implement reconciliation summary report. (Phase 10A: replaced with a true financial reconciliation report -- opening/closing balances, variance, matched/unmatched/exception amounts, and an operational section -- per run, reusing the existing tie-out and approval-readiness services rather than a raw match count.)
- Implement exception report.
- Implement unmatched transaction report.
- Add secure report export and report history.
- Add PDF and XLSX export. (Phase 10B: `lib/reports/exporters/{pdf,xlsx}.ts`, both consuming the same presentation model as the CSV export -- no report calculation exists in more than one place across the three formats. Reused the existing `reports.export` permission and download route; no new permission was introduced.)

## Phase 7: Matching Rules

- Implement simple matching rule CRUD.
- Apply rules by vendor, reference, description, amount tolerance, and date tolerance.
- Show proposed matches only.
- Track rule-created matches separately from manual matches.

## Phase 8: Admin Settings

- Implement organization settings.
- Implement user management.
- Implement role assignment.
- Do not implement custom role editing in MVP.

## Deferred

- AI assistant execution.
- Billing enforcement.
- MFA implementation unless required by launch policy.
- Custom roles and permission editing.
- SSO/SAML.
- Direct bank connections.
- ERP API integrations.
- Advanced anomaly detection.
- Custom report builder.
- Real-time collaboration.