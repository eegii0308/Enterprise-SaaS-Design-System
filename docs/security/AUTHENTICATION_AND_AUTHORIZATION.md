# Authentication and Authorization

## Current Implementation

E-Reconcile currently uses custom email/password authentication with database-backed sessions and role-based authorization.

## Authentication Flow

### First-admin registration

File: `lib/auth/core.ts`

Current behavior:

1. Validates registration form data.
2. Checks whether any organization exists.
3. Hashes the submitted password with `bcryptjs`.
4. Creates the first user.
5. Creates the first organization.
6. Creates fixed tenant roles and permissions.
7. Creates an active admin membership.
8. Writes an organization-created audit log.
9. Creates a session.
10. Redirects to `/dashboard`.

Known limitation:

- The organization count check can race under concurrent requests.

### Login

File: `lib/auth/actions.ts`

Current behavior:

1. Validates email and password.
2. Finds the user by email.
3. Requires the user to be `ACTIVE`.
4. Compares the password with the stored hash.
5. Finds active memberships for the user.
6. Requires exactly one active membership.
7. Verifies the role belongs to the membership organization.
8. Creates a session.
9. Redirects to `/dashboard`.

Known limitation:

- Multi-organization membership selection is not implemented.

### Password reset

Files: `lib/auth/password-reset.ts`, `lib/auth/actions.ts`, `app/reset-password/[token]/`

Request (`forgotPasswordAction`):

1. Validates the submitted email format.
2. Looks up the user; if not found or not `ACTIVE`, does nothing further.
3. If found, invalidates any earlier outstanding reset tokens for that user, creates a new one, and writes a `PASSWORD_RESET_REQUESTED` audit log (skipped if the user has no active membership, since `AuditLog.organizationId` is required).
4. Sends a reset email (best-effort; failures are swallowed).
5. Always returns the same generic success message, regardless of whether the email matched a real account or the email actually sent — this is the enumeration-safety boundary.

Completion (`resetPasswordAction`):

1. Hashes the submitted token and looks up the matching `PasswordResetToken`; rejects if not found, already used, or expired (`INVALID_TOKEN`).
2. Rejects a password under 8 characters (`VALIDATION`).
3. Updates the user's password hash, marks the token used, and invalidates any other outstanding tokens for the same user.
4. Revokes every active session for the user (mirrors `clearSession()`'s revocation), forcing re-authentication everywhere.
5. Writes a `PASSWORD_RESET_COMPLETED` audit log (same organization-membership caveat as above).
6. Redirects to `/login?reset=success` (no auto-login, unlike invitation acceptance — a password reset intentionally requires a fresh login with the new password).

Token: 256-bit random value (`lib/security/tokens.ts`, shared with the invitation token implementation), SHA-256 hash stored, 1-hour expiry (deliberately much shorter than the 7-day invitation TTL, since this token grants control over an existing account).

### Invitation acceptance

Files: `lib/invitations/management.ts`, `lib/invitations/accept.ts`, `app/dashboard/users/`, `app/invite/[token]/`

An `ADMIN` (the only role with `users.manage`) invites a user by email from `/dashboard/users`. Scope is intentionally limited to brand-new users only: an email that already has a `User` account in a *different* organization is rejected, because `createSessionForUser` (`lib/auth/actions.ts`) requires exactly one active membership and there is no multi-organization/session-switching support. Re-inviting an email with a `DISABLED` membership in the *same* organization is supported (reactivation).

Token: same 256-bit/SHA-256 scheme as password reset, 7-day expiry, single-row rotation on resend. Accepting creates the `User` (new-invite branch) or verifies the existing password (reactivation branch), creates/activates the `Membership`, marks the invitation `ACCEPTED`, writes an `INVITATION_ACCEPTED` audit log, and creates a session (auto-login), unlike password reset.

Known limitation:

- No rate limiting on invite/resend beyond a 60-second per-invitation resend cooldown.

### Logout

File: `lib/auth/session.ts`

Current behavior:

1. Reads the session cookie.
2. Decodes and verifies the signed session ID.
3. Marks the session revoked when found.
4. Deletes the cookie.

## Sessions

File: `lib/auth/session.ts`

Current behavior:

- Session records are stored in the database.
- The session cookie contains the session ID plus an HMAC signature.
- `AUTH_SESSION_SECRET` signs the session ID.
- Cookies are `httpOnly`.
- Cookies use `sameSite: "lax"`.
- Cookies are marked `secure` in production.
- Sessions expire after 8 hours.
- Revoked or expired sessions are rejected.

Known limitations:

- No visible session rotation after login.
- No device/session management UI.
- No idle timeout separate from absolute expiry.
- No MFA.

## Roles

Current fixed roles:

- `ADMIN`
- `FINANCE_MANAGER`
- `ACCOUNTANT`
- `AUDITOR`
- `VIEWER`

Roles are tenant-specific records in the `Role` table, with unique role names per organization.

## Permissions

Permissions are defined in `types/permissions.ts` and mapped to roles in `lib/permissions/roles.ts`.

Current permissions include:

- `transactions.view`
- `transactions.edit`
- `transactions.note`
- `imports.create`
- `reconciliation.run`
- `reconciliation.approve`
- `reports.view`
- `reports.export`
- `matching_rules.manage`
- `users.manage`
- `settings.manage`
- `audit_logs.view`
- `audit_logs.export`

## Protected Routes and Actions

Current protection helpers:

- `requireSession()`
- `requirePermission(permission)`
- `requireOrganizationAccess(organizationId)`

Current protected surfaces:

- Dashboard layout requires an active session.
- Imports page and upload action require `imports.create`.
- Transactions page requires `transactions.view`.
- Reconciliation page and manual match action require `reconciliation.run`.
- Users page and invite/cancel/resend/role-change/disable/reactivate actions require `users.manage` (`ADMIN` only).

Known limitation:

- Dashboard overview currently requires only a session while showing transaction metrics and recent audit log snippets.

## Known Limitations

### Missing rate limiting

There is no visible rate limiting for:

- Login
- Registration
- Forgot password
- Invitation send (resend has only a 60-second per-invitation cooldown, not a general limiter)
- Uploads
- Future exports
- Future sensitive mutations

### Test configuration issue

`npm test` currently fails for auth and authorization tests because Node cannot resolve `@/lib` path aliases in tested modules.

### Bootstrap hardening needed

First-admin registration should be protected from concurrent bootstrap races and unintended public access after setup.

## Future Improvements

### MFA decision

Document whether MFA is required for launch. If required, define enrollment, recovery, enforcement, and audit requirements.

### Session hardening

Consider:

- Session rotation after login.
- Idle timeout.
- Device/session list.
- Sign out other sessions.
- Suspicious session revocation.

### Authorization hardening

Add permission-filtered navigation and explicit permissions for every route that exposes financial or audit data.

### Security tests

Add tests for:

- Unauthorized route access.
- Cross-tenant access attempts.
- Missing permission attempts.
- Disabled users.
- Disabled memberships.
- Revoked sessions.
