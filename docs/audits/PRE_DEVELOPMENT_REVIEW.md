# E-Reconcile MN Pre-Development Review

Date: 2026-07-07
Reviewer: Senior SaaS CTO
Scope: `docs/*`, current source code, and current Figma-generated UI implementation

## Executive Summary

E-Reconcile MN is not ready for full feature implementation yet. The product direction is strong, and the newer planning docs correctly narrow the MVP around one import-to-reconciliation-to-report cycle. However, the current source remains a Figma-generated Vite React prototype, while the target architecture is a production Next.js SaaS application with server-side auth, organization scoping, database persistence, API contracts, auditability, and financial controls.

Approval to begin coding should be limited to Phase 0 foundation work only: production app structure, typed domain contracts, auth/database/storage decisions, and design extraction. Do not begin core feature implementation until the blockers below are resolved.

## 1. Architecture Readiness

Status: Conditionally ready for foundation work, not ready for product feature implementation.

The documentation now gives a reasonable target: a Next.js App Router application with protected dashboard routes, server-side authorization, feature modules, typed API boundaries, database persistence, tenant-safe storage, and audit logging. That is the right production direction.

The current implementation is not that architecture. `src/app/App.tsx` contains mock data, local view routing, auth screens, product screens, layout, demo error navigation, charts, forms, and many deferred product areas in one large file. This is acceptable as a design reference, but it should not become the production codebase by incremental patching.

Architecture readiness gaps:

- No production route structure exists.
- No real authentication/session boundary exists.
- No database integration exists.
- No API/server action implementation exists.
- No organization-scoped data access helper exists.
- No test harness, lint script, typecheck script, or CI-ready quality gates are defined in `package.json`.
- The current bundle loads the prototype as one broad app surface rather than route-level product modules.

CTO recommendation: start with a production foundation branch or migration pass. Extract visual patterns from the prototype, but build core implementation against the documented domain model and API contracts.

## 2. Figma UI And Documentation Conflicts

Status: Several conflicts must be resolved before production navigation and backlog are finalized.

The docs say the MVP should exclude or defer AI assistant execution, billing, direct bank connections, ERP integrations, MFA implementation, invitation acceptance, custom roles, and broad enterprise functionality. The Figma-generated UI still prominently includes these surfaces.

Conflicts found:

- UI includes `ai-assistant`, AI auto-match, AI accuracy charts, anomaly language, and AI-created rules, while docs defer AI execution.
- UI includes direct integrations such as SAP, QuickBooks, Stripe, Plaid, scheduled syncs, rate-limit warnings, XML/OFX/QFX imports, and bank connection flows, while docs limit MVP import to CSV/XLSX files.
- UI includes Billing and plan management, while docs say billing should be hidden from production navigation.
- UI includes MFA, invitation acceptance, email verification, and MFA status metrics, while docs defer MFA/invitations unless launch policy requires them.
- UI includes a Roles screen that appears broader than fixed role assignment, while docs defer custom role and permission editing.
- UI source data uses U.S. companies, USD-only examples, and enterprise integrations, while the product name and documentation imply a Mongolian finance product. The launch locale, currency expectations, and sample data strategy should be made explicit.
- UI has demo-only controls such as fixed bottom-right error/auth page navigation that must not ship.

Recommendation: create a production navigation allowlist for MVP: Dashboard, Imports, Transactions, Reconciliation, Reports, Audit Logs, Users, Settings, and Help only if required. Hide or remove AI, Billing, Integrations, Bank Accounts, custom Roles, Notifications, and broad support/demo pages from production MVP navigation.

## 3. MVP Feature Completeness

Status: The documentation covers the right MVP cycle, but several implementation-critical details are still missing or need firmer acceptance criteria.

Required MVP features that are documented well:

- First organization/admin setup.
- Email/password auth and protected dashboard access.
- Fixed roles: Admin, Finance Manager, Accountant, Auditor, Viewer.
- CSV/XLSX imports for bank and ledger records.
- Import mapping, row-level validation, duplicate detection, and import history.
- Transaction list, review notes, adjustments, and exception marking.
- Manual reconciliation runs and match workflow.
- Approval lifecycle with audit logs.
- Summary, exception, and unmatched reports.
- Organization scoping and server-side authorization.

Missing or under-specified MVP items:

- Auth provider/session strategy.
- Database choice and migration strategy.
- File storage provider, tenant-scoped key format, retention policy, and upload size/row limits.
- Exact import mapping schema and required columns for bank versus ledger files.
- Amount normalization rules across debit, credit, signed amount, refunds, reversals, and zero values.
- Reconciliation run eligibility rules, especially whether one-to-many or many-to-one matches are allowed.
- Status transition matrix for transactions, matches, import batches, and reconciliation runs.
- Separation-of-duties launch decision: whether preparer and approver must be different users.
- Report formats: CSV, XLSX, PDF, or a combination.
- Test data and seed strategy for roles, permissions, and demo organizations.

Recommendation: convert these into acceptance criteria before Phase 1 begins.

## 4. Features To Remove Or Defer

Status: The prototype contains too much product surface for an MVP finance workflow.

Remove from MVP implementation and production navigation:

- AI assistant and AI auto-match.
- Direct bank connections and Plaid-like flows.
- ERP/API integrations and scheduled syncs.
- Billing, plans, invoices, and payment enforcement.
- Custom role and permission editor.
- Full MFA implementation unless launch policy requires it.
- Invitation acceptance unless manual admin-created users are unacceptable.
- Notifications center unless needed for import/reconciliation status.
- Custom report builder or performance dashboard.
- Advanced anomaly detection.
- Broad help center content about non-MVP features.
- XML, OFX, and QFX support unless explicitly reprioritized.

Keep but narrow:

- Matching rules: proposal-only and after manual reconciliation, reports, and audit logs work.
- Users: fixed role assignment and membership status only.
- Settings: company name, default currency, fiscal year start month only.
- Reports: reconciliation summary, exception list, unmatched transactions only.

## 5. Database Design Sufficiency

Status: Directionally sufficient, but not implementation-ready without constraints and final decisions.

The database design includes the right core entities: organizations, users, memberships, roles, permissions, bank accounts, import batches, import rows, transactions, review notes, adjustments, reconciliation runs, matches, matching rules, reports, and audit logs.

What is strong:

- Every business table includes or should include `organization_id`.
- Imports preserve raw rows and validation results.
- Transaction corrections are modeled as adjustments instead of destructive edits.
- Reconciliation runs and matches are explicit.
- Reports store generated metadata.
- Audit logs are first-class.

What still needs definition before implementation:

- Concrete SQL schema, indexes, constraints, and migration files.
- Unique indexes for membership, role names, permissions, import file hashes, row hashes, and transaction fingerprints.
- Composite constraints to prevent cross-organization matches.
- Foreign key behavior for deleted/disabled users.
- Check constraints for debit/credit/amount consistency.
- Decimal precision and currency minor-unit policy.
- Status enum strategy.
- Whether roles are global system roles or organization-scoped seeded roles. Current docs list `organization_id` on roles, but fixed system roles may be simpler as global definitions plus memberships.
- Match cardinality: one bank to one ledger only, or support grouped matches.
- Report file lifecycle and expiration behavior.
- Audit log immutability expectations.

Recommendation: produce a database migration spec before writing application features. Treat organization scoping and financial constraints as database-enforced where possible, not only application convention.

## 6. API Design Realism

Status: Realistic as a high-level contract, but too optimistic for file processing and financial controls.

The endpoint list maps well to the MVP. The shape is conventional, permission-aware, and organization-scoped. The API can work if implemented conservatively with server-side validation and background-capable import/report processing.

API risks:

- `POST /api/imports` cannot safely be just "creates an import batch and uploads a file" unless upload validation, storage, mapping draft, and idempotency are designed.
- `POST /api/imports/:id/process` needs clear behavior for retries, partial failures, duplicate rows, and already-processed batches.
- `PATCH /api/transactions/:id` mixes status/vendor/reference/review notes; review notes should be a separate append-only action or clearly persisted as note records.
- `DELETE /api/reconciliation/matches/:id` is described as status change, so use `PATCH` or document soft-delete semantics clearly.
- Reports should probably be asynchronous jobs even for MVP if PDF/XLSX generation or large exports are possible.
- Missing explicit organization context convention: path, subdomain, session active organization, or membership selection.
- Missing rate-limit, CSRF, and idempotency-key decisions.

Recommendation: define typed request/response schemas and mutation-level audit events before backend implementation. Use server actions or API routes consistently rather than mixing patterns ad hoc.

## 7. Implementation Order

Recommended first implementation sequence:

1. Foundation: create production Next.js structure, route groups, shared layout, UI primitives, typed domain models, validation conventions, lint/typecheck/test scripts, and environment conventions.
2. Tenant/auth/access: choose auth provider, implement first organization setup, fixed roles, memberships, protected routes, server-side permissions, and organization-scoping tests.
3. Database/storage: implement migrations, seed roles/permissions, tenant-scoped file storage, upload limits, and audit log helper.
4. Import engine: CSV/XLSX upload, mapping, validation, duplicate detection, import rows, batch status, and transaction normalization.
5. Transactions/review: server-paginated list, filters, details, notes, adjustments, exception marking, and dashboard counts.
6. Manual reconciliation: runs, unmatched candidates, manual matching, confirmation/rejection/removal, status transitions, approval locking.
7. Audit and controls: complete audit coverage, safe API errors, rate limits, and separation-of-duties if required.
8. Reports/export: summary, exception, unmatched reports, secure download URLs, export audit logs.
9. Matching rules: simple proposal-only rules after the manual workflow is stable.
10. Admin polish: users, fixed role assignment, and organization settings.

Do not start with dashboard charts, AI, integrations, billing, or broad prototype parity.

## Blockers Before Coding

- Decide production stack: Next.js version, auth provider, database, ORM/query layer, storage provider, test framework, and deployment target.
- Decide launch policy for MFA, invitations, and preparer/approver separation.
- Finalize production MVP navigation and hide deferred prototype surfaces.
- Produce first database migration spec with indexes, constraints, enums/statuses, and organization-scoping controls.
- Define import contract: supported file types, size limits, row limits, required columns, mapping behavior, duplicate detection, error format, and retention.
- Define transaction amount normalization and currency policy.
- Define reconciliation lifecycle transition matrix and permissions.
- Define report formats and secure export behavior.
- Add quality gates to `package.json`: lint, typecheck, test, and build.
- Establish sample data that reflects the target launch market and MVP capabilities.

## Recommended Improvements

- Treat the prototype as a visual catalog, not a codebase to extend directly.
- Build production components from typed contracts and fixtures before connecting real APIs.
- Keep server-side authorization centralized and tested.
- Prefer append-only financial records for notes, adjustments, match changes, approvals, and exports.
- Add audit logging as a shared service before financial mutations are implemented.
- Keep matching rules out of the critical path until manual reconciliation and reports work.
- Use feature flags or navigation allowlists to prevent deferred screens from leaking into MVP.
- Add accessibility checks for forms, drawers, tables, dialogs, and keyboard navigation.
- Add an end-to-end smoke test for the full MVP cycle before launch approval.

## Final Approval Checklist

Use this checklist before approving full implementation beyond foundation work.

- [ ] Production stack selected and documented.
- [ ] Auth/session strategy selected.
- [ ] Database and migration strategy selected.
- [ ] File storage and retention policy selected.
- [ ] MVP navigation allowlist approved.
- [ ] Deferred features hidden from production navigation.
- [ ] MFA, invitations, and separation-of-duties decisions made.
- [ ] Database migration spec covers all MVP tables, indexes, constraints, and statuses.
- [ ] Organization-scoping enforcement strategy approved.
- [ ] API schemas defined for MVP endpoints.
- [ ] Import mapping, validation, duplicate detection, and limits documented.
- [ ] Amount normalization and currency rules documented.
- [ ] Reconciliation lifecycle transition matrix documented.
- [ ] Audit event matrix documented for all MVP mutations.
- [ ] Report formats and export permissions documented.
- [ ] Lint, typecheck, test, and build scripts added.
- [ ] Seed data strategy approved for roles, permissions, and local development.
- [ ] End-to-end MVP acceptance test defined.

## CTO Decision

Approved to begin Phase 0 foundation work only.

Not approved to begin core MVP feature implementation until the blockers above are resolved. The most important discipline now is resisting prototype parity. Build the smallest trustworthy finance workflow first: import, validate, review, manually reconcile, approve, export, and audit.
