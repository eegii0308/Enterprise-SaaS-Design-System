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