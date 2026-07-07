# Changelog

## 2026-07-07

### Added

- Implemented Phase 1 production foundation with Next.js App Router routes for sign in, first Admin registration, password reset request, and protected dashboard access.
- Added Prisma schema for organization-scoped tenants, users, memberships, fixed roles, permissions, imports, transactions, reconciliation, reports, and audit logs.
- Added typed database client, signed session cookie helpers, server-side auth actions, authorization helpers, and MVP role-permission mappings.
- Added .env.example with database and auth session secret configuration.

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