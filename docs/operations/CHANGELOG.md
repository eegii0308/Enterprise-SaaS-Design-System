# Changelog

## 2026-07-10

### Added

- Implemented Phase 7A financial tie-out: `calculateReconciliationTieOut` (`lib/reconciliation/tie-out-summary.ts`) computes, per reconciliation run, the bank transaction total, ledger transaction total, matched amount (bank leg of confirmed matches), unmatched bank amount, unmatched ledger amount, exception amount, and the bank-vs-ledger variance. All arithmetic uses `Prisma.Decimal` end-to-end (no floating-point), and bank/ledger/unmatched/exception amounts are scoped to the run's period via `transactionDate`, mirroring how `lib/reports/generation.ts` scopes unmatched and exception transactions to a report period. Matched amount is scoped by `ReconciliationMatch.reconciliationRunId` directly. Organization isolation is enforced the same way as the other reconciliation services (`assertRunAccess` throws `FORBIDDEN` for a run outside the caller's organization). The function accepts an optional `bankAccountId` filter, threaded through every query, so it is ready for future bank-account-scoped tie-outs without further changes to the calculation.
- Added a "Financial tie-out" summary card to the reconciliation workspace (`app/dashboard/reconciliation/page.tsx`), rendered above the transaction filters whenever a current run exists, showing the seven tie-out figures with the variance tile color-coded balanced (green) vs. review-required (amber). The page fetches the summary through the service layer only; no summation logic lives in the UI.
- Added `tests/reconciliation-tie-out-summary.test.ts` covering validation, organization isolation, query scoping (org, period, source type, status, `bankAccountId`), the confirmed-matches-only lookup for matched amount (including skipping the lookup when a run has no confirmed matches), and decimal-precision variance calculation (`0.3 - 0.1` must equal exactly `0.20`, not the IEEE-754 float result).
- Implemented Phase 7B explicit reconciliation run creation: `ReconciliationRun` now has a required `bankAccountId` (`prisma/migrations/20260710040000_phase_7b_reconciliation_run_bank_account`), and `createReconciliationRun` (`lib/reconciliation/run-lifecycle.ts`) creates a `DRAFT` run for an explicitly selected active bank account and period, rejecting an unknown/foreign/inactive bank account and any overlapping open run already covering that bank account and period. This replaces the previous behavior where a run was created implicitly the first time a match was confirmed. Audit-logged as `RECONCILIATION_RUN_CREATED`.
- Added a "Select or create a reconciliation run" landing view to the reconciliation workspace (`app/dashboard/reconciliation/page.tsx`) that lists the organization's runs and a `CreateRunForm` (`app/dashboard/reconciliation/ManualMatchProvider.tsx`) for picking a bank account, period, and name. The workspace now requires a `runId` query parameter and scopes every query — bank/ledger transaction lists, confirmed/rejected matches, exceptions, unmatched correction candidates, and the financial tie-out — to that run's bank account (bank leg) and period (both legs; ledger entries aren't tied to a bank account). Removed the previous auto-detected "current run" (`selectCurrentRun`) in favor of explicit selection.
- `manuallyMatchTransactions` (`lib/reconciliation/manual-match.ts`) now requires an explicit `reconciliationRunId` instead of auto-creating or reusing an open run, and validates that the bank transaction belongs to the run's bank account and that both transactions fall within the run's period before matching. `correctManualMatch` applies the same bank-account/period validation to a correction's replacement transaction. This removed the `findOrCreateManualRun`/`assertNoRunPendingReview` auto-creation path entirely.
- `calculateReconciliationTieOut` (`lib/reconciliation/tie-out-summary.ts`) no longer accepts an optional `bankAccountId` override; it now always derives bank-account scoping from the run itself (every run has exactly one bank account as of Phase 7B) and splits the exception-amount query by source type so the bank leg is scoped by bank account while the ledger leg is not.
- Added `bankAccount.findUnique` support and an overlap-checking `reconciliationRun.findFirst` to the `RunLifecycleDatabase` test seam, and extended `tests/reconciliation-run-lifecycle.test.ts`, `tests/reconciliation-manual-match.test.ts`, `tests/reconciliation-match-correction.test.ts`, `tests/reconciliation-match-rejection.test.ts`, `tests/reconciliation-exception-marking.test.ts`, `tests/reconciliation-transaction-query.test.ts`, `tests/reconciliation-tie-out-summary.test.ts`, and `tests/reconciliation-actions-permissions.test.ts` to cover run creation, bank-account/period scoping, and the new `createReconciliationRunAction`/`manuallyMatchTransactionsAction` permission gates.
- Implemented Phase 7D bank account management: `lib/bank-accounts/management.ts` adds `createBankAccount`, `updateBankAccount`, `archiveBankAccount`, and `reactivateBankAccount`, each organization-scoped and audit-logged (`BANK_ACCOUNT_CREATED`/`_UPDATED`/`_ARCHIVED`/`_REACTIVATED`). Creating, editing (to a new bank name/account number), or reactivating a bank account rejects if another **active** account in the organization already shares the same bank name and masked account number (`CONFLICT`); archived accounts are excluded from that check so a re-added account never collides with its own history. Archiving/reactivating uses the same CAS `updateMany` pattern as the reconciliation run lifecycle to guard against concurrent status changes. Bank accounts are never deleted, only archived, so historical reconciliation runs and transactions that reference an archived account keep working unchanged.
- Added a new permission, `bank_accounts.manage`, granted only to `ADMIN` and `FINANCE_MANAGER` (`types/permissions.ts`, `lib/permissions/roles.ts`). `prisma/migrations/20260710050000_phase_7d_bank_account_management` backfills this permission onto every existing `ADMIN`/`FINANCE_MANAGER` role (new organizations already receive it at registration via `rolePermissions`) and adds a partial unique index, `bank_accounts_org_bank_number_active_key`, on `(organization_id, bank_name, masked_account_number) WHERE status = 'active'` as a DB-level backstop for the same duplicate-active-account rule enforced in the service layer.
- Added a "Bank accounts" page (`app/dashboard/bank-accounts/page.tsx`), gated on `bank_accounts.manage`, listing every bank account (active and archived) with its reconciliation-run count, and `app/dashboard/bank-accounts/BankAccountForms.tsx` providing create/edit dialogs and archive/reactivate actions. Added a "Bank Accounts" sidebar link (`app/dashboard/layout.tsx`). Because the reconciliation workspace's bank-account list (`app/dashboard/reconciliation/page.tsx`) is queried fresh on every request, a newly created active bank account is immediately selectable in the "Create a reconciliation run" form with no caching to invalidate; the run picker's empty-state message now links to the Bank Accounts page for users who hold `bank_accounts.manage`.
- Added `tests/bank-accounts-management.test.ts` (validation, organization isolation, duplicate-active-account detection on create/update/reactivate, and CAS-guarded archive/reactivate transitions) and `tests/bank-accounts-actions-permissions.test.ts` (permission gate: `ADMIN`/`FINANCE_MANAGER` allowed, `ACCOUNTANT`/`AUDITOR`/`VIEWER` denied for all four actions).
- Implemented Phase 7C reconciliation approval controls: a dedicated `evaluateApprovalReadiness` service (`lib/reconciliation/approval-validation.ts`) evaluates four independent readiness checks before a run can be approved — financial variance (bank total vs. ledger total), unmatched bank transaction count, unmatched ledger transaction count, and open exception count — and reports `hasOutstandingItems` plus the full snapshot of amounts/counts behind it. It composes `calculateReconciliationTieOut` for the amount/variance figures rather than recomputing them, and adds its own `transaction.count` queries for the count-based checks, since two unmatched transactions that happen to net to a zero amount (e.g. +100 and -100) would otherwise look "clean" by amount alone.
- `approveReconciliationRun` (`lib/reconciliation/run-lifecycle.ts`) now calls `evaluateApprovalReadiness` inside its own transaction, immediately before the CAS status transition, so the readiness snapshot reflects the exact state being approved. `ApproveRunInput` gains an optional `approvalReason`; if the run has any outstanding items, a non-empty `approvalReason` is required or the approval is rejected with `VALIDATION` before any state changes. The audit log for `RECONCILIATION_RUN_APPROVED` now also records `approvalReason` (or `null` for a clean approval), `overrodeOutstandingItems`, and an `approvalSnapshot` (currency, variance, unmatched bank/ledger counts and amounts, exception count and amount, and the evaluation timestamp) alongside the existing `actorUserId`/timestamp fields already written by every audit log row.
- Widened the shared `RunRecord` type and every `reconciliationRun.findUnique` select in `run-lifecycle.ts` (submit, approve, reopen) to include `bankAccountId`/`periodStart`/`periodEnd`/`organization.defaultCurrency`, and widened `RunLifecycleTransactionClient` with `reconciliationMatch.findMany` and `transaction.aggregate`/`transaction.count`, so the same in-transaction client (`tx`) satisfies `evaluateApprovalReadiness`'s database contract directly — no separate read-then-write round trip is needed for the approval check.
- The reconciliation workspace's "Approve run" button (`app/dashboard/reconciliation/page.tsx`, `ApproveRunButton` in `app/dashboard/reconciliation/ManualMatchProvider.tsx`) is now a confirmation dialog showing the variance, unmatched bank/ledger counts and amounts, and open exception count for the run before approval, with a required reason field that only appears when outstanding items exist. The readiness snapshot is fetched server-side via `evaluateApprovalReadiness` (only when the viewer holds `reconciliation.approve` and the run is ready for review) and passed down as pre-formatted display strings; the server action always re-validates and enforces the reason requirement independently, so the client-side snapshot is informational only, not a trust boundary.
- Added `tests/reconciliation-approval-validation.test.ts` (11 tests: validation, organization isolation, each of the four outstanding-item categories independently and combined, the zero-net-amount/nonzero-count edge case, and bank-account/period query scoping) and extended `tests/reconciliation-run-lifecycle.test.ts` (12 new `approveReconciliationRun` tests covering a clean approval, each outstanding-item category blocking approval without a reason, a blank/whitespace-only reason being rejected, the override path with a reason succeeding and recording the audit snapshot, and a concurrency test where a competing approval already won the CAS transition) and `tests/reconciliation-actions-permissions.test.ts` (new `approveReconciliationRunAction` permission-gate tests: `ADMIN`/`FINANCE_MANAGER` allowed, `ACCOUNTANT`/`AUDITOR`/`VIEWER` denied).

## 2026-07-09

### Added

- Implemented the reconciliation run lifecycle workflow: draft/in_progress/reopened runs can be submitted for review, and ready-for-review runs can be approved (`lib/reconciliation/run-lifecycle.ts`).
- Added server-side permission enforcement for reconciliation actions: `reconciliation.run` for manual matching and submission for review, `reconciliation.approve` for run approval.
- Added audit log events for reconciliation run submission (`RECONCILIATION_RUN_SUBMITTED`) and approval (`RECONCILIATION_RUN_APPROVED`).
- Hardened reconciliation concurrency: atomic transaction-status claims prevent duplicate confirmed matches, and compare-and-swap (CAS) run status transitions keep manual matching, submission, and approval consistent under concurrent requests.
- Implemented reconciliation match correction (`correctManualMatch`): a confirmed match can be corrected by replacing one side (bank or ledger transaction) with a required reason; the original match becomes `removed` and a new `confirmed` match is created linked via `correctedFromMatchId`. Audit-logged as `RECONCILIATION_MATCH_CORRECTED`.
- Implemented reconciliation run reopening (`reopenReconciliationRun`): an `approved` run can be reopened by a user with `reconciliation.approve` and a required reason, recording `reopenedBy`/`reopenedAt` while preserving prior approval history (`approvedBy`/`approvedAt`/`completedAt` are not cleared). Audit-logged as `RECONCILIATION_RUN_REOPENED`.
- Completed Phase 6D concurrency hardening: `removeManualMatch` and `correctManualMatch` previously re-checked the parent run's lock status with a plain read (`findUnique`) before mutating match state, leaving a window where a concurrent `submitReconciliationRunForReview` or `approveReconciliationRun` could transition the run to `ready_for_review`/`approved` after the check passed but before the match write committed. Both functions now share an `assertRunEditable` helper that performs a status-preserving CAS `updateMany` on the run row immediately before the mutation, so the check and the mutation serialize atomically against concurrent lifecycle transitions. Added regression tests covering both functions failing with `CONFLICT` when a concurrent submission wins the race (`tests/reconciliation-manual-match.test.ts`, `tests/reconciliation-match-correction.test.ts`).

## 2026-07-07

## Version 0.1.0

### Completed

- Project foundation
- Authentication
- Database setup
- Organization model
- Role structure


### Added

- Implemented Phase 1 production foundation with Next.js App Router routes for sign in, first Admin registration, password reset request, and protected dashboard access.
- Added Prisma schema for organization-scoped tenants, users, memberships, fixed roles, permissions, imports, transactions, reconciliation, reports, and audit logs.
- Added typed database client, signed session cookie helpers, server-side auth actions, authorization helpers, and MVP role-permission mappings.
- Added .env.example with database and auth session secret configuration.
- Documented localization support for English and Mongolian, with translation files in `locales/en.json` and `locales/mn.json` and rules to route new user-facing text through the shared i18n helper.

### Changed

- Switched production scripts to Next.js while keeping Vite prototype scripts under prototype:*.
- Kept the generated Figma prototype intact as the visual reference and reused existing UI primitives/styles in the new route shell.


### Changed

- Tightened E-Reconcile MN documentation around the MVP reconciliation cycle.
- Deferred MFA, invitations, custom roles, billing, AI, direct bank connections, ERP integrations, and custom report builder.
- Clarified fixed roles, approval lifecycle, report export permission, audit requirements, import validation, and tenant-scoped security controls.
- Simplified architecture guidance around Next.js App Router, server-side authorization, and minimal MVP services.
- Updated user flows to prioritize manual reconciliation, approval, basic reports, and auditability.

### Added

- Created initial documentation structure for E-Reconcile MN.
- Added MVP blueprint.
- Added target architecture guidance.
- Added database design draft.
- Added API design draft.
- Added feature roadmap.
- Added coding standards.
- Added business rules.

### Notes

- Documentation is based on the current Figma-generated Vite React prototype.
- No production code was modified as part of this documentation pass.