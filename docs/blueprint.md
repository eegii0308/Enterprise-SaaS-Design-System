# E-Reconcile MN Blueprint

## Purpose

E-Reconcile MN is an internal SaaS product for finance teams to import financial data, review transactions, reconcile bank and ledger records, and produce reconciliation reports.

The current codebase is a Figma-generated Vite React prototype. It should be used as the visual and workflow reference for the MVP, not as the final production architecture.

## MVP Product Scope

The MVP should prove one complete reconciliation cycle:

1. Admin creates the first organization.
2. Admin or finance user signs in.
3. User imports bank and ledger CSV/XLSX files.
4. User validates mapping and row-level import errors.
5. User reviews unmatched transactions.
6. User manually matches bank and ledger records.
7. User marks and reviews exceptions.
8. Finance Manager approves the reconciliation run.
9. User exports summary, exception, and unmatched reports.
10. Audit log records all critical actions.

## Current Prototype Coverage

The prototype already includes screens for:

- Authentication: login, register, password reset, MFA, invitation acceptance, session expired.
- Onboarding: company setup, fiscal year, currency, integrations, team invitations.
- Dashboard: KPIs, reconciliation status, charts, recent activity.
- Transactions: searchable/filterable table, row selection, details drawer.
- Imports: file upload, import history, source mapping concepts.
- Reconciliation: bank vs ledger matching workspace.
- Matching rules: list and create/edit modal concepts.
- Bank accounts and integrations.
- AI assistant.
- Reports.
- Audit logs.
- Notifications.
- Users and roles.
- Settings and billing.
- Error states: 403, 404, 500, maintenance, offline.

These screens are reference material. Production implementation should include only what supports the MVP cycle.

## MVP In Scope

- Email/password authentication.
- MFA design placeholders only; implementation is deferred unless launch policy requires it.
- Single organization per signed-in user for initial MVP.
- Basic organization membership.
- Fixed system roles: Admin, Finance Manager, Accountant, Auditor, and Viewer.
- CSV/XLSX file import for bank and ledger records.
- Mapping confirmation, duplicate detection, and row-level validation errors.
- Transaction list with server-side filtering and pagination.
- Transaction review notes and exception marking.
- Manual reconciliation workflow.
- Reconciliation run lifecycle from draft through approval.
- Basic matching rules after manual reconciliation works; rules only propose matches.
- Basic reports for reconciliation summary, exception list, and unmatched transaction list.
- Audit log for imports, transaction edits, matches, approvals, exports, user changes, and settings changes.
- Organization settings for company name, fiscal year start month, and default currency.

## MVP Decisions

- MFA: deferred, except for UI placeholders if useful.
- Invitations: deferred if manual admin-created users are acceptable for first launch.
- Custom roles: deferred; MVP uses fixed system roles and role assignment only.
- Billing: hidden from production navigation until a later phase.
- AI assistant, direct bank connections, ERP integrations, and custom report builder: deferred.

## Out of Scope For Initial MVP

- Full AI assistant automation.
- Billing enforcement.
- Custom role and permission editing.
- Complex multi-tenant enterprise hierarchy.
- SSO/SAML.
- MFA implementation unless required by launch policy.
- Invitation workflows unless required by launch policy.
- Direct bank connections.
- ERP integrations beyond import-ready data structures.
- Real-time collaboration.
- Advanced anomaly detection.
- Custom report builder.

These concepts may remain visible in design references, but production implementation should prioritize the core reconciliation workflow first.

## Success Criteria

- A finance user can complete one reconciliation cycle from import to report.
- Admins can assign fixed roles.
- All financial data is scoped to the user's organization.
- Imports and reconciliation decisions are auditable.
- The product handles loading, empty, error, and permission-denied states.
- The frontend is split into maintainable Next.js routes and feature modules.