# CTO Review Report

## Critical Issues

### 1. MVP scope is broader than the stated objective

The stated MVP goal is one complete reconciliation cycle from import to report, but the documents still include several enterprise-adjacent areas in the MVP path:

- Invitation acceptance is included in Phase 1 and API flows, even though single-organization access is the initial target.
- Admin management includes users, roles, organization settings, and audit visibility in the core MVP.
- Matching rule CRUD is included before the first reporting and audit-log phase.
- Role editing is present in the API even though custom roles are described as mostly fixed or deferred.

This creates a delivery risk: the team could spend too much time on access administration, rule management, and prototype parity before proving the import-to-reconciliation loop.

### 2. MFA requirements are contradictory

`blueprint.md` says MFA-ready UI is in scope but implementation is deferred unless required by launch policy. `api-design.md` includes "Verify MFA if enabled" as an auth flow. `architecture.md` also includes an `mfa` route in the target structure.

The documents need one launch decision:

- Either MFA is deferred entirely except for design placeholders.
- Or MFA is a real launch requirement with provider choice, enrollment, recovery, enforcement, audit events, and testing criteria.

Right now the docs imply both.

### 3. Role and permission model is under-specified for financial controls

The docs list roles and permissions, but they do not define enough separation of duties for finance workflows:

- No clear rule for who may approve a reconciliation run.
- No rule preventing the same user from preparing and approving a reconciliation, if required by policy.
- No distinction between editing transactions, creating matches, confirming matches, and approving a run.
- No permission listed for report export, despite API security saying exports require explicit permission.
- No permission listed for audit-log export or sensitive settings changes.

This is a control weakness for a finance product.

### 4. Database design cannot fully support auditability and corrections

The docs say imports should be immutable and corrections should create new records or audit events, but the schema does not define:

- A transaction adjustment/correction model.
- Import row storage for raw uploaded values and validation errors.
- Review notes, despite the API allowing transaction review notes.
- Match removal history, despite business rules requiring removed matches to be audited.
- Approval metadata on reconciliation runs.
- Report files/storage lifecycle beyond a `file_url`.

The schema describes the happy path but not enough of the audit trail needed for financial reconciliation.

### 5. Transaction amount modeling is ambiguous

The transaction table stores `debit_amount` and `credit_amount`, while matching rules refer to `amount_tolerance`. The docs do not define:

- Whether debit and credit are mutually exclusive.
- How signs are represented across bank and ledger imports.
- Whether zero or both debit/credit values are allowed.
- How currency conversion is handled or explicitly disallowed.
- Precision and scale for financial amounts.

This can cause reconciliation bugs, failed matches, and inconsistent reports.

### 6. Multi-tenancy security is stated but not enforceable from the docs alone

The docs repeatedly require `organization_id` scoping, which is good, but they do not specify implementation-level safeguards:

- Database-level constraints or row-level security strategy.
- Composite foreign keys or checks that matched transactions belong to the same organization and reconciliation run.
- Unique constraints scoped by organization.
- Tenant-safe file storage paths.
- How organization context is selected and validated in API routes.

For a SaaS handling financial records, relying only on application query discipline is too fragile.

### 7. Import processing is missing operational requirements

CSV/XLSX import is core to the MVP, but the docs do not define:

- Required fields per bank and ledger source.
- Mapping rules and saved mappings.
- Duplicate detection.
- Idempotency if users upload the same file twice.
- Maximum file size and row limits.
- Background job behavior, retries, timeout handling, and partial failure handling.
- Where uploaded files are stored and when they are deleted or retained.

Import quality will determine whether the product feels trustworthy.

## Recommended Changes

### 1. Reduce the MVP to a tighter reconciliation path

Define the MVP as:

1. Admin creates the first organization.
2. Admin or finance user signs in.
3. User uploads bank and ledger CSV/XLSX files.
4. User validates mapping and import errors.
5. User views unmatched transactions.
6. User manually matches records.
7. User marks exceptions.
8. Finance Manager approves the reconciliation run.
9. User exports summary and exception reports.
10. Audit log records all critical actions.

Everything else should support this path or move later.

### 2. Make launch decisions explicit

Add a short "MVP Decisions" section covering:

- MFA: deferred or required.
- Invitations: required for MVP or manual admin-created users only.
- Custom roles: deferred, with fixed system roles for MVP.
- Billing: hidden from production navigation until a later phase.
- AI assistant, direct bank connections, ERP integrations, and custom report builder: deferred.

### 3. Strengthen the data model before implementation

Add or revise schema coverage for:

- `import_rows` with raw row data, normalized row data, validation status, and error messages.
- `transaction_notes` or `review_notes` on transactions.
- `transaction_adjustments` or an explicit immutable correction pattern.
- `reconciliation_run_approvals` or approval fields on `reconciliation_runs`.
- Match constraints that ensure bank and ledger transactions belong to the same organization and are compatible with the run period.
- Precision definitions such as `decimal(18, 2)` or currency-specific minor-unit handling.
- Unique indexes for memberships, roles, permissions, import rows, and external transaction fingerprints.

### 4. Define security requirements as implementation controls

Add requirements for:

- Server-side authorization on every read and mutation.
- CSRF/session protection for cookie-based auth.
- Rate limits for auth, upload, and export endpoints.
- File upload scanning, extension and MIME validation, size limits, and safe storage.
- Tenant-scoped storage keys for uploaded and generated files.
- Audit logs for sensitive reads and exports where appropriate.
- No raw stack traces, SQL errors, storage paths, or signed URL internals in API errors.
- Optional database row-level security or equivalent query enforcement helpers with tests.

### 5. Clarify reconciliation lifecycle

Define reconciliation run states and allowed transitions:

- `draft`
- `in_progress`
- `ready_for_review`
- `approved`
- `reopened`

Also define who can transition each state, what happens to exceptions, and whether approved runs can be edited.

### 6. Simplify architecture for the MVP

Next.js App Router is reasonable, but avoid adding unnecessary layers too early:

- Use server-side data loading and API/server actions consistently.
- Delay TanStack Query unless the UI needs advanced client caching.
- Avoid a generic custom report engine.
- Avoid custom role-management UI beyond assignment of fixed roles.
- Keep matching rules simple and auditable, not a generalized rules engine.

### 7. Align API and database documents

Specific mismatches to fix:

- `PATCH /api/transactions/:id` allows `review notes`, but the transaction schema has no field/table for notes.
- API security requires explicit export permission, but `role_permissions` does not include `reports.export`.
- Business rules require removed matches to be audited, but API design does not expose match removal or define how removal works.
- Blueprint says basic reports include reconciliation summary and exception list, while business rules also include unmatched transaction list.
- Role editing appears in the API even though custom role editing is deferred/minimal.

## MVP Priority Adjustments

### Move earlier

- Import validation details, duplicate detection, and row-level error visibility.
- Transaction amount normalization rules.
- Reconciliation run lifecycle and approval rules.
- Audit-log requirements tied to each MVP mutation.
- Organization-scoping tests and authorization tests.
- Basic report export permission and storage/security rules.

### Keep in MVP but narrow

- Roles: fixed system roles only, with role assignment but no custom permission editor.
- Matching rules: simple proposal-only rules after manual reconciliation works.
- Reports: reconciliation summary, exception list, and unmatched list only.
- Admin settings: company name, fiscal year start month, default currency, and user role assignment only.

### Move later

- MFA implementation unless launch policy requires it.
- Invitation workflows if manual user creation is acceptable for first launch.
- Custom roles and permission editing.
- Billing screens and enforcement.
- AI assistant.
- Direct bank connections.
- ERP integrations.
- Advanced anomaly detection.
- Real-time collaboration.
- Custom report builder.

## Suggested Revised Phase Order

1. Foundation: Next.js route structure, auth boundary, typed domain models, validation setup, test harness.
2. Tenant and access: first organization admin, fixed roles, protected routes, server-side authorization, organization scoping tests.
3. Import engine: CSV/XLSX upload, mapping, validation, import rows, duplicate detection, batch status.
4. Transactions: normalized transaction list, filters, review notes, exception marking.
5. Manual reconciliation: runs, candidate lists, manual matches, confirmations, run status transitions.
6. Audit and controls: audit logs for imports, edits, matches, approvals, user/role changes, exports.
7. Reports: summary, exception list, unmatched list, secure export.
8. Matching rules: simple proposal-only rules with auditability.
9. Admin polish: organization settings, user management, role assignment.

## Bottom Line

The blueprint is directionally strong and correctly identifies the prototype as a workflow reference rather than production architecture. The biggest risk is not technical feasibility; it is scope diffusion. Tighten the MVP around trustworthy imports, manual reconciliation, approval, auditability, and basic reports. Defer platform features until the core finance workflow is proven end to end.
