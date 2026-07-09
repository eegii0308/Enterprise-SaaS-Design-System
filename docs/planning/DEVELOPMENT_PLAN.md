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
- [ ] Add admin-created user or membership flow if needed for launch.
- [ ] Complete password reset token, email, and new-password flow.
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

Tasks:

- Implement tenant-scoped file upload for CSV and XLSX.
- Create import batches with status tracking.
- Store import rows with raw data, normalized data, validation status, and error messages.
- Add source type selection: bank or ledger.
- Add column mapping confirmation.
- Validate required fields: transaction date, description, amount or debit/credit, currency, and source type.
- Normalize valid rows into transactions.
- Detect duplicate files and duplicate rows with fingerprints.
- Document and enforce file size and row limits.
- Show import history, row counts, duplicate rows, invalid rows, and processing failures.

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

Tasks:

- Implement paginated transaction list with server-side search and filters.
- Add transaction detail view.
- Add transaction review notes.
- Add exception marking.
- Add allowed transaction adjustments while keeping imported source data immutable.
- Add dashboard summary counts from real transaction data.
- Add loading, empty, error, and permission-denied states.

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

Tasks:

- Create reconciliation runs with period start and period end.
- Implement run statuses: draft, in_progress, ready_for_review, approved, reopened.
- Show unmatched bank and ledger candidates for a run.
- Support manual bank-to-ledger matching.
- Support match confirmation, rejection, and removal by status change.
- Update related transaction statuses after confirmed matches.
- Allow unresolved records to be marked as exceptions.
- Lock approved runs from normal edits.
- Add approval permissions for Finance Manager and Admin.

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

- Generate reconciliation summary report.
- Generate exception list report.
- Generate unmatched transaction report.
- Store report metadata and tenant-scoped file keys.
- Add report history.
- Add secure download URLs for permitted users.
- Write audit events for report generation and export.

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
- Invitation acceptance unless manual admin-created users are not acceptable.
- Custom roles and permission editing.
- Billing screens and enforcement.
- AI assistant execution.
- Direct bank connections.
- ERP integrations.
- Advanced anomaly detection.
- Real-time collaboration.
- Custom report builder.
