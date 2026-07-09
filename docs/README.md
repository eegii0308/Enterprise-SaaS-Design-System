# Documentation

This folder contains the product, architecture, database, security, financial, development, operations, audit, planning, and localization documentation for E-Reconcile MN.

Documentation should help contributors understand the current production direction, preserve important decisions, and keep implementation work aligned with financial SaaS requirements.

## Folder Structure

- `architecture/` - system architecture, data flow, and API design.
- `database/` - database schema, relationships, tenant ownership, migrations, indexes, and legacy database design context.
- `security/` - authentication, authorization, tenant isolation, and security controls.
- `financial/` - financial rules, audit logging policy, and financial data integrity.
- `features/` - user flows and feature-level implementation specifications.
- `development/` - engineering workflow, coding standards, AI development context, and local development guidance.
- `operations/` - environment setup, deployment requirements, changelog, and operational notes.
- `audits/` - readiness reviews, phase reviews, and technical audit reports.
- `planning/` - roadmap, blueprint, and development planning documents.
- `localization/` - localization audits and final checks.

## Source Of Truth

Use these documents as the primary references:

- Architecture: `architecture/ARCHITECTURE_OVERVIEW.md`
- Data flow: `architecture/DATA_FLOW.md`
- API design: `architecture/API_DESIGN.md`
- Database design: `database/DATABASE_DESIGN.md`
- Authentication and authorization: `security/AUTHENTICATION_AND_AUTHORIZATION.md`
- Tenant isolation: `security/TENANT_ISOLATION.md`
- Financial data integrity: `financial/FINANCIAL_DATA_INTEGRITY.md`
- Audit logging policy: `financial/AUDIT_LOG_POLICY.md`
- Development guide: `development/DEVELOPMENT_GUIDE.md`
- Current roadmap: `planning/FEATURE_ROADMAP.md`

Files marked as deprecated reference are retained for historical context only. Do not update deprecated files as active specifications; update the relevant source-of-truth document instead.

## Updating Documentation

Documentation should be updated in the same change set as the feature, migration, security control, operational change, or policy decision it describes.

When implementation behavior changes:

- Update the source-of-truth document for that area.
- Keep audit and review documents as historical records unless a new review is being added.
- Add changelog entries for meaningful user-facing, operational, or architecture changes.
- Preserve important historical context, but consolidate duplicates instead of creating competing documents.
- Move new documents into the most specific folder in this structure.

When adding a new document, use a clear descriptive filename, include a top-level heading, and link or reference the source-of-truth document if the new file is supporting material rather than the primary specification.
