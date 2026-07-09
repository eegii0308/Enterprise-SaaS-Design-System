# Changelog

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