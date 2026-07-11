# E-Reconcile MN Development Plan

## MVP Goal

Build one trustworthy reconciliation cycle:

1. Admin creates the first organization.
2. Admin or finance user signs in.
3. User imports bank and ledger CSV/XLSX files.
4. User validates mapping and row-level import errors.
5. User reviews unmatched transactions.
6. User manually matches bank and ledger records.
7. User marks exceptions.
8. Finance Manager or Admin approves the reconciliation run.
9. User exports reconciliation summary, exception, and unmatched reports.
10. Audit log records critical actions.

The current Vite React prototype is a workflow and visual reference. Production work should prioritize the core financial workflow over prototype parity.

## Development Phases

Note on phase naming: commit history and prior review notes sometimes refer to sub-increments informally (for example "Phase 5D" for an import-related migration fix, "Phase 6A"/"Phase 6B"/"Phase 6C"/"Phase 6C.1"/"Phase 6D" for reconciliation workspace, manual matching, run lifecycle, match correction, run reopening, and concurrency hardening work, "Phase 7A"/"Phase 7B"/"Phase 7C"/"Phase 7D" for financial tie-out, explicit run creation, approval controls, and bank account management, "Phase 8A" for the import results & error viewer, and "Phase 8B" for the transaction detail and correction workflow). Those informal labels are sub-slices of the numbered phases below — "Phase 6A" through "Phase 6D" and "Phase 7A"/"7B"/"7C"/"7D" map to Phase 4 (Manual Reconciliation), and "Phase 8A"/"Phase 8B" map to Phase 2 (Import Engine) and Phase 3 (Transactions And Review) respectively — not to the numbered "Phase 7: Matching Rules" or "Phase 8: Admin Settings Polish" later in this document. This document's phase numbers are the source of truth for scope; treat informal commit-message phase labels as sequencing notes only.

### Phase 0: Foundation

Purpose: create the production app structure and engineering guardrails before feature work.

Tasks:

- Migrate the prototype toward Next.js App Router route boundaries.
- Split large prototype screens into route pages and feature modules.
- Establish shared UI primitives, layout components, and design tokens.
- Add domain types for organizations, users, roles, imports, transactions, reconciliation, reports, and audit logs.
- Add validation schema conventions for forms and API inputs.
- Add linting, formatting, typecheck, build, and test scripts.
- Define environment variable conventions.

Dependencies:

- Existing prototype screens and design references.
- Agreed auth provider and database choice.

Testing checkpoints:

- App builds successfully.
- Typecheck and lint scripts run.
- Route structure supports protected and public areas.

Deployment milestone:

- Internal preview deploy with static/prototype routes only.

### Phase 1: Tenant, Auth, And Access

Purpose: make every future feature organization-scoped and permission-checked.

Tasks:

- [x] Implement sign in, sign out, password reset request, and first admin registration.
- [x] Create the first organization setup flow.
- [x] Create users, memberships, fixed roles, and role permissions.
- [x] Protect dashboard routes through server-side session checks.
- [x] Add server-side authorization helpers.
- [x] Establish organization context for protected sessions and future data access.
- [x] Add fixed MVP roles: Admin, Finance Manager, Accountant, Auditor, Viewer.
- [x] Add admin-created user or membership flow if needed for launch. (Email invitation flow, not direct admin-created accounts; see `docs/security/AUTHENTICATION_AND_AUTHORIZATION.md`.)
- [x] Complete password reset token, email, and new-password flow.
- [ ] Add automated tests for session guards, membership access, organization scoping, and role permissions.

Dependencies:

- Phase 0 route and validation foundation.
- Auth provider and session strategy.
- Initial organization, membership, role, and permission tables.

Testing checkpoints:

- Unauthenticated users cannot access protected routes.
- Users without active membership cannot access organization data.
- Organization scoping tests prove users cannot read another organization's records.
- Permission helper tests cover each fixed role.

Deployment milestone:

- Private auth preview with seeded roles and first organization flow.

### Phase 2: Import Engine

Purpose: create reliable financial data intake before building reconciliation workflows.

Status: CSV upload, batch/row storage, validation, duplicate detection, and normalization into transactions are implemented and run synchronously on upload (`lib/imports/csv-core.ts`, `lib/imports/processor.ts`, `app/dashboard/imports/actions.ts`). XLSX upload is not implemented — only CSV is accepted. Column mapping is auto-detected (`detectColumnMapping`) and stored on the batch, but there is no separate user-facing mapping-confirmation step before processing.

Phase 8A (import results & error viewer): a new `/dashboard/imports/[importBatchId]` page shows each batch's summary (total processed, imported, rejected, duplicate) and a paginated, filterable, searchable table of every row, reusing the validation results already stored by the processor (row number, status, error messages, raw values) rather than re-parsing or re-validating the CSV. See `tests/import-row-query.test.ts` and the `buildImportRowSearchText` tests in `tests/import-csv-core.test.ts`.

Tasks:

- [x] Implement tenant-scoped file upload for CSV (XLSX is not yet supported).
- [x] Create import batches with status tracking.
- [x] Store import rows with raw data, normalized data, validation status, and error messages.
- [x] Add source type selection: bank or ledger.
- [ ] Add column mapping confirmation (mapping is auto-detected and stored, but not presented to the user for confirmation before processing).
- [x] Validate required fields: transaction date, description, and amount or debit/credit (currency defaults to the organization's default currency rather than being a hard requirement).
- [x] Normalize valid rows into transactions.
- [x] Detect duplicate files (`ImportBatch` unique file hash per organization) and duplicate rows (fingerprint-based, within a batch and against existing transactions).
- [ ] Document and enforce file size and row limits (a 20 MB file size cap is enforced; there is no row-count limit yet).
- [x] Show import history, row counts, duplicate rows, invalid rows, and processing failures (Phase 8A: the batch list page's inline summary and the new per-batch results viewer).

Dependencies:

- Phase 1 organization scoping and permissions.
- Storage strategy for uploaded files.
- Import batch, import row, bank account, and transaction tables.

Testing checkpoints:

- Valid bank and ledger files create normalized transactions.
- Invalid rows are stored with clear row-level errors.
- Duplicate uploads and duplicate rows are detected.
- Upload and processing endpoints reject unauthorized users.
- Upload limits and file type validation are covered.

Deployment milestone:

- Internal import preview using representative CSV/XLSX samples.

### Phase 3: Transactions And Review

Purpose: let finance users inspect and prepare imported records.

Status: Paginated transaction list, exception marking/clearing, and dashboard summary counts were implemented earlier (Phase 6-series reconciliation work). Transaction detail view and the auditable correction workflow were implemented in Phase 8B (see below). Transaction review notes are not yet implemented — the `TransactionReviewNote` model exists in the schema but has no service layer or UI.

Phase 8B (transaction detail and correction workflow): a new `/dashboard/transactions/[transactionId]` page (gated on `transactions.view`) shows full transaction detail and adjustment history. `adjustTransaction` (`lib/transactions/adjustment.ts`) lets a `transactions.edit` holder correct `description`, `vendor`, `reference`, `currency`, `amount`, or `transactionDate` with a required reason; the pre-existing but previously-unused `TransactionAdjustment` model stores the field name, old value, new value, reason, actor, and timestamp for every correction, so imported source data is never overwritten without first preserving its prior value. Amount corrections recompute `debitAmount`/`creditAmount` from the new amount's sign, matching the derivation `prepareImportRows` uses at import time. A transaction whose confirmed reconciliation match belongs to a `READY_FOR_REVIEW` or `APPROVED` run cannot be adjusted (`CONFLICT`), so a correction cannot invalidate an already-approved tie-out snapshot; the field update itself is an atomic CAS `updateMany` guarding against two concurrent corrections to the same field. Every adjustment also writes a `TRANSACTION_ADJUSTED` audit log entry. See `tests/transaction-adjustment.test.ts` and `tests/transaction-actions-permissions.test.ts`.

Tasks:

- [x] Implement paginated transaction list with server-side search and filters.
- [x] Add transaction detail view (Phase 8B).
- [ ] Add transaction review notes.
- [x] Add exception marking.
- [x] Add allowed transaction adjustments while keeping imported source data immutable (Phase 8B).
- [x] Add dashboard summary counts from real transaction data.
- [ ] Add loading, empty, error, and permission-denied states (partially — the transaction list and detail pages have empty states; dedicated loading/error boundaries are not yet added for the detail page).

Dependencies:

- Phase 2 normalized transactions.
- Transaction notes and adjustment tables.
- Audit logging helper for transaction edits and notes.

Testing checkpoints:

- Transaction filters and pagination are organization-scoped.
- Review notes and exception marking require proper permissions.
- Transaction corrections create adjustment records and audit events.
- Dashboard counts match transaction state.

Deployment milestone:

- Finance-user preview for imported transaction review.

### Phase 4: Manual Reconciliation

Purpose: prove the core matching workflow before adding automation.

Status: Manual match creation, confirmed-match removal, match correction, match rejection, exception marking, and the full reconciliation run lifecycle (create, submit, approve, reopen) are implemented and covered by automated tests (`lib/reconciliation/manual-match.ts`, `lib/reconciliation/run-lifecycle.ts`, `lib/reconciliation/exception-marking.ts`, `tests/reconciliation-manual-match.test.ts`, `tests/reconciliation-run-lifecycle.test.ts`, `tests/reconciliation-match-correction.test.ts`, `tests/reconciliation-match-rejection.test.ts`, `tests/reconciliation-exception-marking.test.ts`). As of Phase 7B, a reconciliation run is created explicitly by selecting a bank account and reconciliation period (`createReconciliationRun`), rather than implicitly on first confirmed match; the run then transitions from draft/in_progress/reopened to ready_for_review on submission, from ready_for_review to approved on approval, and from approved back to reopened on reopening. A confirmed match can be corrected by replacing one side (bank or ledger transaction) with a required reason, preserving history via `correctedFromMatchId`, or rejected with a required reason (returning both transactions to unmatched). An unmatched transaction can be marked as an exception with a required reason and later cleared back to unmatched, preserving the marking history. Submission, approval, reopening, and run creation are enforced server-side through the `reconciliation.run` and `reconciliation.approve` permissions and each write an audit log event. Concurrency hardening — atomic transaction-status claims, compare-and-swap (CAS) run status transitions, and CAS re-verification that a match's parent run is still editable before removal, correction, or rejection — all within database transactions — prevents duplicate matches and conflicting concurrent state changes, including a race where a match removal/correction/rejection could otherwise apply after a concurrent submission or approval locked the run (Phase 6D).

Phase 7A (financial tie-out): `calculateReconciliationTieOut` (`lib/reconciliation/tie-out-summary.ts`) computes, per run, the bank transaction total, ledger transaction total, matched amount, unmatched bank amount, unmatched ledger amount, exception amount, and the bank-vs-ledger variance, all using `Prisma.Decimal` arithmetic. It is surfaced as a summary card in the reconciliation workspace. See `tests/reconciliation-tie-out-summary.test.ts`.

Phase 7B (explicit run creation): `ReconciliationRun` now has a required `bankAccountId` in addition to `periodStart`/`periodEnd`. `createReconciliationRun` validates the bank account belongs to the organization, is active, and has no other open run with an overlapping period, then creates a `draft` run — replacing the old implicit "create on first confirmed match" behavior. The reconciliation workspace requires selecting or creating a run (via a `runId` query parameter) before showing any bank/ledger transactions, matches, exceptions, or the tie-out summary; every one of those views is now scoped to the selected run's bank account (bank leg only — ledger entries aren't tied to a bank account) and period. `manuallyMatchTransactions` and `correctManualMatch` validate that matched/replacement transactions belong to the run's bank account and period. See `tests/reconciliation-run-lifecycle.test.ts`, `tests/reconciliation-manual-match.test.ts`, `tests/reconciliation-match-correction.test.ts`, and `tests/reconciliation-transaction-query.test.ts`.

Phase 7D (bank account management): `lib/bank-accounts/management.ts` adds `createBankAccount`, `updateBankAccount`, `archiveBankAccount`, and `reactivateBankAccount`, gated behind a new `bank_accounts.manage` permission held only by `ADMIN` and `FINANCE_MANAGER`. Bank accounts are never deleted, only archived (`status: "inactive"`), so historical reconciliation runs and transactions that reference one keep working unchanged; a partial unique DB index plus a service-layer check prevent two **active** accounts in the same organization from sharing a bank name and masked account number, while archived accounts are exempt so a re-added account doesn't collide with its own history. The new "Bank accounts" page (`app/dashboard/bank-accounts/page.tsx`) resolves the gap noted in Phase 7B: the reconciliation run-creation form reads the organization's active bank accounts fresh on every request, so an account created here is immediately selectable there. See `tests/bank-accounts-management.test.ts` and `tests/bank-accounts-actions-permissions.test.ts`.

Phase 7C (approval controls): `evaluateApprovalReadiness` (`lib/reconciliation/approval-validation.ts`) is a dedicated service that evaluates four independent readiness checks before a run can be approved — financial variance, unmatched bank transaction count, unmatched ledger transaction count, and open exception count — returning a `hasOutstandingItems` flag plus the full snapshot behind it. It composes `calculateReconciliationTieOut` for the amount/variance figures instead of recomputing them, and adds its own count queries, since offsetting unmatched transactions can net to a zero amount while still being individually unresolved. `approveReconciliationRun` calls it inside its own transaction immediately before the CAS status write, and now requires a non-empty `approvalReason` whenever `hasOutstandingItems` is true, rejecting the approval with `VALIDATION` (no state change) otherwise. Every approval's audit log (`RECONCILIATION_RUN_APPROVED`) records the approving user (`actorUserId`, already standard on every audit row), the reason (or `null` for a clean approval), whether outstanding items were overridden, and the full approval snapshot (variance, unmatched/exception counts and amounts, currency, evaluation timestamp). The workspace's "Approve run" control is now a confirmation dialog showing that snapshot, with the reason field appearing only when it's required; the server independently re-validates and enforces the reason requirement regardless of what the client displays. See `tests/reconciliation-approval-validation.test.ts` and the `approveReconciliationRun` tests in `tests/reconciliation-run-lifecycle.test.ts`.

Next planned work: none outstanding for Phase 4's core reconciliation loop; remaining roadmap work is the numbered Phase 7 (automated matching rules) and Phase 8 (admin settings/user management).

Tasks:

- [x] Create reconciliation runs explicitly by selecting a bank account and period start/end (Phase 7B; previously created implicitly on first confirmed match).
- [x] Implement run statuses: draft, in_progress, ready_for_review, approved, reopened. Draft/in_progress/reopened transition to ready_for_review on submission, and ready_for_review transitions to approved on approval.
- [x] Show unmatched bank and ledger candidates for a run, scoped to the run's bank account and period.
- [x] Support manual bank-to-ledger matching, validated against the target run's bank account and period.
- [x] Support match confirmation and removal by status change.
- [x] Support match rejection by status change.
- [x] Support match correction (replace one side of a confirmed match with a required reason, preserving history via `correctedFromMatchId`), validated against the run's bank account and period.
- [x] Support run reopening (`approved` → `reopened`) by a user with `reconciliation.approve` and a required reason, preserving prior approval history.
- [x] Update related transaction statuses after confirmed matches, and revert them to unmatched when a match is removed, corrected, or rejected.
- [x] Allow unresolved records to be marked as exceptions, and cleared back to unmatched, preserving marking history.
- [x] Lock ready-for-review and approved runs from normal edits.
- [x] Add approval permissions for Finance Manager and Admin. The `reconciliation.approve` permission is defined in `types/permissions.ts`, mapped in `lib/permissions/roles.ts`, and enforced server-side in the run-creation, run-approval, and run-reopen actions; `reconciliation.run` is enforced for run creation, match creation, removal, correction, rejection, and submission for review.
- [x] Harden match removal/correction/rejection against concurrent run lifecycle transitions: atomically re-verify (CAS) the parent run is still editable immediately before mutating match state, so a run submission or approval racing a match edit cannot both succeed.
- [x] Calculate and display a per-run financial tie-out summary (bank total, ledger total, matched amount, unmatched bank/ledger amounts, exception amount, and variance) in the reconciliation workspace, computed through the service layer with `Prisma.Decimal` arithmetic (Phase 7A).
- [x] Prevent overlapping open reconciliation runs for the same bank account (Phase 7B).
- [x] Support bank account management (create, edit, archive, reactivate), restricted to Admin and Finance Manager, preventing duplicate active accounts while preserving historical reconciliation references (Phase 7D).
- [x] Evaluate financial variance, unmatched bank/ledger transactions, and open exceptions before approval, requiring an explicit approval reason when outstanding items exist, and recording the approving user, reason, and a full approval snapshot in the audit trail (Phase 7C).

Dependencies:

- Phase 3 reviewed transactions.
- Reconciliation run and match tables.
- Server-side permissions for reconciliation and approval actions.
- Audit logging helper for matches and run transitions.

Testing checkpoints:

- Accountants can prepare but cannot approve reconciliation runs.
- Finance Managers and Admins can approve ready-for-review runs.
- Matches cannot cross organizations.
- Confirmed matches update transaction statuses correctly.
- Approved runs reject normal edit attempts.

Deployment milestone:

- End-to-end internal reconciliation demo from imported transactions to approved run.

### Phase 5: Audit And Controls

Purpose: make the MVP finance workflow inspectable and defensible.

Tasks:

- Add audit logs for imports, transaction edits, notes, matches, approvals, reopened runs, user changes, settings changes, report generation, and exports.
- Add audit log list with filters.
- Add tenant-safe storage keys for uploaded and generated files.
- Add rate limits for auth, upload, and export endpoints.
- Ensure API errors do not expose stack traces, SQL details, storage paths, or signed URL internals.
- Add separation-of-duties check if launch policy requires preparer and approver to be different users.

Dependencies:

- Audit log table.
- Auth/session metadata for actor tracking.
- Storage and export mechanisms.

Testing checkpoints:

- Every MVP financial mutation writes an audit event.
- Audit logs are organization-scoped.
- Permission denied and validation errors use safe response shapes.
- Rate-limited endpoints fail predictably.

Deployment milestone:

- Controls review preview for finance and security stakeholders.

### Phase 6: Reports And Export

Purpose: complete the import-to-report MVP cycle.

Tasks:

- Generate reconciliation summary report. (Upgraded from a match-count summary to a true financial reconciliation report -- see `docs/operations/CHANGELOG.md`.)
- Generate exception list report.
- Generate unmatched transaction report.
- Store report metadata and tenant-scoped file keys.
- Add report history.
- Add secure download URLs for permitted users.
- Write audit events for report generation and export. (Phase 10B: every download -- CSV, PDF, or XLSX, including repeat downloads of an already-exported report -- now writes its own `REPORT_DOWNLOADED` audit event, not just the initial generation step.)
- Add PDF and XLSX export alongside CSV. (Phase 10B: added via a shared presentation-model layer, `lib/reports/render/reconciliation-summary.ts`, so all three formats stay consistent with each other and with the underlying tie-out/approval calculations -- see `docs/operations/CHANGELOG.md`.)

Dependencies:

- Approved or reviewable reconciliation runs.
- Report table and storage integration.
- `reports.view` and `reports.export` permissions.

Testing checkpoints:

- Reports reflect the selected run or date range.
- Export requires explicit permission.
- Downloads do not expose raw storage paths.
- Report exports create audit logs.

Deployment milestone:

- MVP acceptance candidate: one full reconciliation cycle from upload to report export.

### Phase 7: Matching Rules

Purpose: add simple proposal-only automation after manual reconciliation works.

Tasks:

- Implement matching rule CRUD.
- Support vendor, description, reference, amount tolerance, date tolerance, and priority.
- Apply active rules to create proposed matches only.
- Allow users to confirm or reject proposed matches.
- Track rule-created matches separately from manual matches.
- Audit matching rule changes and rule-created proposals.

Dependencies:

- Phase 4 manual reconciliation.
- Matching rules table.
- Proposed match workflow.

Testing checkpoints:

- Rules never auto-approve matches.
- Inactive rules do not create proposals.
- Proposed matches are auditable and reversible.
- Rule permissions are enforced.

Deployment milestone:

- Post-MVP enhancement preview after the manual workflow is stable.

### Phase 8: Admin Settings Polish

Purpose: add only the admin functions required to operate the MVP.

Tasks:

- Implement organization settings for company name, default currency, and fiscal year start month.
- Implement user management for fixed role assignment and membership status.
- Hide billing, custom roles, MFA setup, integrations, and AI assistant from production navigation unless launch policy changes.
- Add audit logs for settings and role changes.

Dependencies:

- Phase 1 access model.
- Audit log coverage.

Testing checkpoints:

- Only Admin users can manage settings and role assignments.
- Settings changes affect import validation and dashboard display where applicable.
- Role changes are audited and take effect on the next authorized request.

Deployment milestone:

- MVP operations-ready release.

## Database-First Order

Use this order when implementing persistence and backend behavior before full UI polish.

1. Create organizations, users, memberships, roles, and role permissions.
2. Add auth/session integration and organization-scoped access helpers.
3. Create bank accounts, import batches, import rows, and transactions.
4. Implement import parsing, mapping, validation, duplicate detection, and transaction normalization.
5. Add transaction review notes and transaction adjustments.
6. Create reconciliation runs and reconciliation matches.
7. Implement run lifecycle, manual matching, exception marking, and approval locking.
8. Add audit logs and wire audit events into every MVP mutation.
9. Create reports table, report generation, report files, and secure export.
10. Add matching rules after manual reconciliation and reporting are stable.
11. Add organization settings and fixed role assignment polish.

This path reduces rework because frontend screens bind to real organization-scoped data contracts early.

## Frontend-First Order

Use this order when preserving prototype momentum while backend contracts are still forming.

1. Create Next.js route shells for auth, dashboard, imports, transactions, reconciliation, reports, audit logs, users, and settings.
2. Extract shared layout, navigation, table, form, dialog, drawer, badge, and empty-state components.
3. Replace hardcoded prototype routing with route-level pages.
4. Build auth and organization setup screens against temporary fixtures.
5. Build import upload, mapping preview, validation result, and import history screens against typed mock responses.
6. Build transaction list, filters, detail drawer, notes, and exception states against typed mock responses.
7. Build reconciliation run list, candidate workspace, manual match interaction, approval review, and status states against typed mock responses.
8. Build report list, generation form, and export states against typed mock responses.
9. Build audit log list and filters.
10. Swap fixtures for server data phase by phase, starting with auth and imports.
11. Remove unused prototype-only surfaces from production navigation.

This path is useful for validating workflow ergonomics, but each screen should use typed contracts that match the database-first API design.

## Core Dependencies

- Auth provider and session strategy before protected routes and authorization tests.
- Database schema before real imports, transactions, reconciliation, reports, and audit logs.
- Tenant-scoped storage before upload processing and report export.
- Organization-scoped query helper or row-level security strategy before financial data features.
- Validation schema library before file mapping, forms, and API mutations.
- Audit logging helper before transaction edits, matches, approvals, user changes, settings changes, and exports.
- Report export storage before launch acceptance.
- Launch policy decision for MFA, invitations, and preparer/approver separation before final access-control testing.

## Testing Checkpoints

Minimum MVP coverage:

- Unit tests for permission helpers, status transitions, amount normalization, duplicate detection, and import validation.
- API tests for authentication, authorization, organization scoping, uploads, transaction mutations, matching, approvals, reports, and audit logs.
- Component tests for login, organization setup, import mapping, transaction review, reconciliation workspace, approval review, and report generation forms.
- End-to-end smoke test for the full MVP journey: create organization, sign in, import bank and ledger files, resolve validation errors, review transactions, manually match, mark exceptions, approve run, export reports, and verify audit history.
- Accessibility checks for forms, dialogs, drawers, tables, keyboard navigation, and error messaging.
- Build, typecheck, lint, and migration checks before every deployment milestone.

## Deployment Milestones

1. Foundation preview: Next.js structure, shared layout, public/protected route boundaries, and CI scripts.
2. Access preview: sign in, first organization setup, fixed roles, protected routes, and seeded permissions.
3. Import preview: upload, mapping, validation, duplicate detection, import history, and normalized transactions.
4. Review preview: transaction list, filters, detail view, notes, exceptions, and dashboard summary.
5. Reconciliation preview: run creation, candidate lists, manual matches, status transitions, approval, and locked approved runs.
6. Controls preview: complete audit log coverage, safe API errors, rate limits, and tenant-safe storage.
7. MVP acceptance candidate: summary, exception, and unmatched reports with secure export and audit history.
8. MVP launch: production environment configured, seed roles verified, smoke test passed, backup/restore expectations documented, and deferred features hidden from production navigation.

## Deferred From MVP

- MFA implementation unless required by launch policy.
- Custom roles and permission editing.
- Billing screens and enforcement.
- AI assistant execution.
- Direct bank connections.
- ERP integrations.
- Advanced anomaly detection.
- Real-time collaboration.
- Custom report builder.
