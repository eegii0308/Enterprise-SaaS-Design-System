# Architecture Overview

## Current Implementation

E-Reconcile currently uses a Next.js App Router application as the production direction while preserving a Vite/Figma prototype for design reference.

The production app lives mainly under:

- `app/`: Next.js routes, layouts, pages, server actions, and route-level UI.
- `lib/`: domain logic, authentication helpers, permissions, import processing, reconciliation logic, database client, validation, and shared errors.
- `features/`: feature-specific client components for authentication forms.
- `prisma/`: Prisma schema and migrations for PostgreSQL.
- `tests/`: Node test files for core auth, authorization, import, and reconciliation logic.
- `src/` and `dist/`: preserved prototype/generated frontend artifacts.

## Next.js Architecture

The application uses server-rendered App Router pages for the dashboard and financial workflows. Server-side data loading happens directly in route components using Prisma and session/permission helpers.

Current production routes include:

- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password/[token]`
- `/invite/[token]`
- `/dashboard`
- `/dashboard/imports`
- `/dashboard/transactions`
- `/dashboard/reconciliation`
- `/dashboard/users`

Server actions currently handle:

- Login
- First-admin registration
- Forgot-password request (`forgotPasswordAction`, `lib/auth/actions.ts`) and password reset completion (`resetPasswordAction`, `app/reset-password/[token]/actions.ts`)
- Logout
- Import upload
- Manual reconciliation match creation
- User invitations: invite/cancel/resend, member role change, disable/reactivate (`app/dashboard/users/actions.ts`) and invitation acceptance (`app/invite/[token]/actions.ts`)

## App Router Structure

`app/dashboard/layout.tsx` provides the authenticated dashboard shell and navigation. It calls `requireSession()` to ensure only authenticated users can access dashboard pages.

Individual pages apply more specific permissions where implemented:

- `app/dashboard/imports/page.tsx`: requires `imports.create`
- `app/dashboard/imports/actions.ts`: requires `imports.create`
- `app/dashboard/transactions/page.tsx`: requires `transactions.view`
- `app/dashboard/reconciliation/page.tsx`: requires `reconciliation.run`
- `app/dashboard/reconciliation/actions.ts`: requires `reconciliation.run`

## Prisma/PostgreSQL Architecture

The database is modeled with Prisma and PostgreSQL. `lib/db/client.ts` creates a singleton Prisma client for application code.

The schema includes core SaaS and financial models:

- Organizations
- Users
- Sessions
- Memberships
- Roles and role permissions
- Bank accounts
- Import batches and import rows
- Transactions
- Transaction review notes and adjustments
- Reconciliation runs and matches
- Matching rules
- Reports
- Audit logs

The schema is explicitly tenant-aware through `organizationId` on organization-owned models.

## Authentication Architecture

Authentication is custom and currently uses:

- Email and password login
- `bcryptjs` password hashing
- Database-backed `Session` records
- HMAC-signed session cookie named `ereconcile_session`
- `AUTH_SESSION_SECRET` for signing
- Active user and active membership checks when loading a session

Only users with exactly one active membership can currently create a session through the login flow.

## Authorization Architecture

Authorization is role and permission based.

Roles are fixed system roles:

- `ADMIN`
- `FINANCE_MANAGER`
- `ACCOUNTANT`
- `AUDITOR`
- `VIEWER`

Permissions are defined in `types/permissions.ts` and mapped to roles in `lib/permissions/roles.ts`.

Runtime authorization uses:

- `requireSession()`
- `requirePermission(permission)`
- `requireOrganizationAccess(organizationId)`

Authorization context is loaded from the database using the active session membership and role permissions.

## Multi-Tenant SaaS Model

Each organization owns its financial data. Most financial and operational models include `organizationId`.

The current application relies on:

- Session-derived `organizationId`
- Prisma `where: { organizationId }` filters
- Composite unique constraints in selected models
- Intended composite foreign key strategy in migrations

Known limitation: migration history currently appears inconsistent around composite tenant foreign keys and must be corrected before production.

## Main Application Modules

### Authentication

Files:

- `lib/auth/core.ts`
- `lib/auth/actions.ts`
- `lib/auth/session.ts`
- `lib/validations/auth.ts`
- `features/auth/components/*`

### Permissions

Files:

- `types/permissions.ts`
- `lib/permissions/roles.ts`
- `lib/permissions/authorize.ts`
- `lib/permissions/authorize-core.ts`

### Imports

Files:

- `app/dashboard/imports/page.tsx`
- `app/dashboard/imports/actions.ts`
- `lib/imports/csv-core.ts`
- `lib/imports/processor.ts`
- `lib/imports/processor-core.ts`
- `lib/imports/storage.ts`

### Transactions

Files:

- `app/dashboard/transactions/page.tsx`
- `prisma/schema.prisma`

### Reconciliation

Files:

- `app/dashboard/reconciliation/page.tsx`
- `app/dashboard/reconciliation/actions.ts`
- `lib/reconciliation/manual-match.ts`
- `lib/reconciliation/transaction-query.ts`

### Audit Logging

Files:

- `prisma/schema.prisma`
- `lib/auth/core.ts`
- `app/dashboard/imports/actions.ts`
- `lib/imports/processor.ts`
- `lib/reconciliation/manual-match.ts`

## Current Design Decisions

- Use Next.js App Router for production application routes.
- Keep the Vite prototype available as a visual reference.
- Use Prisma with PostgreSQL for relational financial data.
- Use custom database-backed sessions instead of a third-party auth provider.
- Use fixed roles and explicit permissions for MVP simplicity.
- Scope financial data by `organizationId`.
- Store uploaded import files under tenant-scoped storage keys.
- Record audit logs for implemented high-value actions.

## Known Limitations

- Prototype and production app are still both present.
- Some planned routes in navigation do not yet have implemented pages.
- Rate limiting is missing for login, registration, and forgot-password requests (invitation resend has a 60s per-invitation cooldown, `lib/invitations/management.ts`, but this is not a general rate limiter).
- Test configuration does not currently run all tests successfully.

## Future Improvements

- Complete production route set for reports, audit logs, users, settings, and matching rules.
- Add permission-aware navigation.
- Introduce background jobs for imports and report generation.
- Add structured logging, tracing, monitoring, and error reporting.
- Consider PostgreSQL row-level security after application-level tenant isolation is stable.

## Consolidation note

This document is the architecture source of truth. The previous flat docs/architecture.md file was consolidated here as legacy target-design context below.

## Legacy target architecture context

# Architecture

## Current State

The current application is a Vite React prototype:

- Entry point: `src/main.tsx`
- Main app: `src/app/App.tsx`
- UI primitives: `src/app/components/ui`
- Styles: `src/styles`

The main `App.tsx` file contains mock data, screen routing, layout, auth screens, dashboard screens, product screens, local UI helpers, and error pages in one file. This is acceptable for a prototype but not for production SaaS development.

## Target Architecture

The MVP should be migrated to a Next.js App Router architecture before major feature development.

Recommended structure:

```txt
app/
  (auth)/
    login/
    register/
    forgot-password/
    reset-password/
  (dashboard)/
    dashboard/
    transactions/
    imports/
    reconciliation/
    matching-rules/
    reports/
    audit-logs/
    users/
    settings/
  api/
components/
  ui/
  layout/
features/
  auth/
  dashboard/
  transactions/
  imports/
  reconciliation/
  matching-rules/
  reports/
  users/
  settings/
lib/
  api/
  auth/
  db/
  permissions/
  validations/
types/
```

## Frontend Principles

- Route screens should live under `app/`.
- Reusable product components should live under `features/<domain>/components`.
- Shared primitives should live under `components/ui`.
- Data access should not be embedded in visual components.
- Mock data should live in fixtures only and should not be mixed with production components.
- Page components should compose smaller components instead of owning all UI logic directly.

## Localization

- Supported languages: English and Mongolian.
- Default locale: Mongolian.
- Translation files live in `locales/en.json` and `locales/mn.json`.
- User-facing text should be routed through the shared translation helper in `lib/i18n.ts` instead of being hardcoded in components or pages.
- When adding new UI text, add a new translation key to both locale files and use the same key in the codebase so the app stays consistent across languages.
- Keep placeholders and interpolation values explicit, and prefer descriptive translation keys over ad hoc string literals.

## State Management

Use simple state boundaries:

- URL state: filters, search, pagination, selected tab.
- Server state: transactions, imports, reconciliation runs, users, roles, reports.
- Local UI state: modals, drawers, selected rows, temporary form state.

Recommended MVP tools:

- Next.js routing for navigation.
- Server-side data loading first.
- Server actions or API routes for mutations.
- TanStack Query only if the UI needs richer client caching and refetch control.
- React Hook Form plus a validation schema library for forms.

## Authentication Boundary

Authentication should be enforced outside page components:

- Public routes under `(auth)`.
- Protected routes under `(dashboard)`.
- Middleware or server layout checks for authenticated access.
- Server-side session validation before loading protected data.

## Authorization Boundary

Authorization must be enforced on the server:

- UI may hide unavailable actions.
- API/server actions must check permissions before reading or mutating data.
- All queries must be scoped by `organization_id`.
- Use a shared organization-scoped query helper or database row-level security equivalent.
- Add tests that prove users cannot access another organization's records.

## Database Migration Workflow

Prisma migrations are the source of truth for database shape. The initial migration lives in prisma/migrations and must be committed with the schema it represents.

Use this workflow for database changes:

    npm run prisma:generate
    npm run prisma:migrate

When prisma/schema.prisma changes, create a named migration with npx prisma migrate dev --name <change-name> and commit both the schema change and the generated files under prisma/migrations. Avoid prisma db push for shared development because it changes database state without preserving a reviewable migration history.

Before starting a feature phase that depends on database changes, verify the migration history against a clean PostgreSQL database by pointing DATABASE_URL at an empty database and running npm run prisma:migrate.
## MVP Architecture Decisions

- Keep the first production build as a single Next.js app with server-side auth and data loading.
- Avoid custom role-management UI; support fixed role assignment only.
- Avoid a generic report engine; generate summary, exception, and unmatched reports only.
- Keep matching rules as auditable match proposal helpers, not a generalized rules engine.
- Keep background processing minimal for MVP imports: reliable status, retries, and clear failure states are more important than a complex job platform.

## Build And Performance

The current Vite production build succeeds, but the JavaScript bundle is large because every screen is loaded at once. Next.js route-level splitting should reduce initial load.

Performance priorities:

- Split screens by route.
- Lazy-load charts where possible.
- Avoid importing large icon sets through broad imports.
- Use server pagination for transaction tables.
- Use table virtualization only when row counts require it.
