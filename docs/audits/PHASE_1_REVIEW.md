# Phase 1 Review

## 1. What was implemented

Phase 1 established the production foundation for E-Reconcile MN on Next.js App Router while preserving the existing Vite/Figma prototype as a separate prototype path.

Implemented areas:

- Next.js production app shell with `/`, `/login`, `/register`, `/forgot-password`, and `/dashboard` routes.
- First-organization setup flow that creates the initial organization, first Admin user, fixed tenant roles, role permissions, membership, and audit log entry.
- Email/password login using hashed passwords with `bcryptjs`.
- Signed HTTP-only cookie session handling with an 8-hour max age.
- Server-side dashboard guard using `requireSession()`.
- Fixed role and permission model for Admin, Finance Manager, Accountant, Auditor, and Viewer.
- Prisma database schema for organization-scoped reconciliation workflows.
- Shared auth validation schemas using Zod.
- Production scripts switched to Next.js while retaining prototype scripts for Vite.

## 2. Files changed

Core app and routing:

- `app/layout.tsx`
- `app/globals.css`
- `app/page.tsx`
- `app/login/page.tsx`
- `app/register/page.tsx`
- `app/forgot-password/page.tsx`
- `app/dashboard/page.tsx`

Auth and permissions:

- `features/auth/components/AuthFormShell.tsx`
- `features/auth/components/AuthSubmitButton.tsx`
- `features/auth/components/FormMessage.tsx`
- `features/auth/components/LoginForm.tsx`
- `features/auth/components/RegisterForm.tsx`
- `features/auth/components/ForgotPasswordForm.tsx`
- `lib/auth/actions.ts`
- `lib/auth/session.ts`
- `lib/validations/auth.ts`
- `lib/permissions/roles.ts`
- `lib/permissions/authorize.ts`
- `types/permissions.ts`

Database and infrastructure:

- `prisma/schema.prisma`
- `lib/db/client.ts`
- `lib/errors.ts`
- `package.json`
- `package-lock.json`
- `next.config.ts`
- `next-env.d.ts`
- `tsconfig.json`

Documentation:

- `docs/changelog.md`
- `docs/phase-1-review.md`

Prototype preserved:

- `src/main.tsx`
- `src/app/App.tsx`
- `src/app/components/**`
- `src/styles/**`
- `vite.config.ts`
- `index.html`
- `dist/**`

## 3. Database changes

The Prisma schema now targets PostgreSQL through `DATABASE_URL` and defines the tenant-centered data model.

Enums added:

- `UserStatus`
- `MembershipStatus`
- `SystemRoleName`
- `SourceType`
- `ImportStatus`
- `ImportRowStatus`
- `TransactionStatus`
- `ReconciliationRunStatus`
- `ReconciliationMatchType`
- `ReconciliationMatchStatus`
- `MatchingRuleStatus`
- `ReportType`
- `ReportStatus`

Models added:

- `Organization`
- `User`
- `Membership`
- `Role`
- `RolePermission`
- `BankAccount`
- `ImportBatch`
- `ImportRow`
- `Transaction`
- `TransactionReviewNote`
- `TransactionAdjustment`
- `ReconciliationRun`
- `ReconciliationMatch`
- `MatchingRule`
- `Report`
- `AuditLog`

Important database behaviors:

- All finance workflow entities are scoped to `organizationId`.
- Users can belong to organizations through memberships.
- Roles are unique per organization and use fixed system role names.
- Role permissions are stored as rows so seeded permissions can be queried later.
- First Admin registration creates all fixed roles and permissions inside a single transaction.
- Import batches are deduplicated by `[organizationId, fileHash]`.
- Import rows are deduplicated by `[organizationId, rowHash]`.
- Transactions are deduplicated by `[organizationId, externalFingerprint]`.
- Reconciliation runs, matches, reports, audit logs, and matching rules include indexes for common tenant-scoped access.

No migration file is present in this workspace snapshot, so the schema exists but still needs an applied Prisma migration against a real database.

## 4. Current functionality

Working today:

- Visiting `/` redirects authenticated users to `/dashboard` and unauthenticated users to `/login`.
- `/register` performs one-time first organization setup when no organizations exist.
- Registration validates email, password, full name, organization name, currency, and fiscal year start month.
- Registration hashes the password, creates the organization, creates fixed roles, creates role permission rows, creates the Admin membership, writes an audit log, sets a session cookie, and redirects to `/dashboard`.
- `/login` validates credentials, checks active user status, verifies the password hash, selects the first active membership, sets the session cookie, and redirects to `/dashboard`.
- `/forgot-password` validates the email field and returns a generic success message.
- `/dashboard` requires a valid signed session and displays organization, user, role, phase, and granted permissions.
- Sign out clears the session cookie and redirects to `/login`.

## 5. Known issues

- Password reset is a placeholder. It does not create a token, send email, or allow setting a new password.
- Session payload is signed but not encrypted. It should not contain secrets; currently it stores user and organization identity metadata.
- Session validation trusts the signed cookie payload and does not re-check user, membership, or role status on every protected request.
- The login flow chooses the first active membership by creation date. There is no organization switcher for multi-tenant users.
- First Admin setup is guarded by `organization.count()`, which is fine for MVP setup but should be reviewed for race conditions in concurrent first-run attempts.
- No migration files are included, so database provisioning is not repeatable yet through committed migrations.
- No seed script exists for roles outside the first organization transaction.
- No automated tests are present for auth actions, session signing, permission checks, or registration transaction behavior.
- `next lint` may require project lint configuration depending on the installed Next.js version.
- The dashboard is still a tenant foundation/status page, not a functional reconciliation workspace.

## 6. Missing parts

Still needed after Phase 1:

- Applied Prisma migration files and deployment migration workflow.
- `.env.example` or environment setup documentation for `DATABASE_URL` and `AUTH_SESSION_SECRET` if not already available in the target repo branch.
- Invite and user management flow for adding Finance Managers, Accountants, Auditors, and Viewers.
- Organization switcher for users with multiple active memberships.
- Password reset token model, email delivery, reset form, and token expiry handling.
- Import pipeline for CSV/XLSX bank and ledger files.
- File storage integration for uploaded source files and generated reports.
- Transaction normalization, validation, duplicate review, and import error handling.
- Reconciliation run creation, matching rules, manual match review, approval, reopen, and exception workflows.
- Reports generation and export.
- Audit log viewing and export UI.
- Authorization checks on future mutation routes with `requirePermission()`.
- Error boundary and user-friendly handling for missing env vars or database connectivity failures.
- Automated test coverage and CI checks.

## 7. Manual testing checklist

Environment setup:

- Create a PostgreSQL database.
- Set `DATABASE_URL`.
- Set `AUTH_SESSION_SECRET` to at least 32 characters.
- Run `npm install` if dependencies are not installed.
- Run `npx prisma generate`.
- Apply the schema to the database with the chosen Prisma migration workflow.
- Start the app with `npm run dev`.

First Admin registration:

- Open `/`.
- Confirm unauthenticated users are redirected to `/login`.
- Click or navigate to `/register`.
- Submit empty or invalid fields and confirm validation messages appear.
- Register with valid first Admin details.
- Confirm redirect to `/dashboard`.
- Confirm dashboard shows the organization name, user full name, Admin role, and Admin permissions.
- Confirm the database contains one organization, one user, one active membership, five roles, role permission rows, and an `organization.created` audit log.

Login and logout:

- Sign out from the dashboard.
- Confirm redirect to `/login`.
- Attempt login with an incorrect email or password.
- Confirm a generic error is shown.
- Login with the first Admin credentials.
- Confirm redirect to `/dashboard`.

Session guard:

- Clear the `ereconcile_session` cookie manually.
- Visit `/dashboard`.
- Confirm redirect to `/login`.
- Log in again.
- Confirm the cookie is HTTP-only and has an 8-hour max age.

First setup lock:

- While an organization already exists, visit `/register`.
- Attempt to create another first Admin organization.
- Confirm the action returns the "First organization setup is already complete" message.

Forgot password placeholder:

- Visit `/forgot-password`.
- Submit an invalid email and confirm validation appears.
- Submit a valid email and confirm the generic success message appears.
- Confirm no email is expected yet in Phase 1.

Build checks:

- Run `npm run typecheck`.
- Run `npm run build`.
- Run `npm run lint` if lint configuration is available.
