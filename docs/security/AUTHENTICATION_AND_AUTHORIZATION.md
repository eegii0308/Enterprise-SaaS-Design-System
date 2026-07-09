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

Known limitation:

- Dashboard overview currently requires only a session while showing transaction metrics and recent audit log snippets.

## Known Limitations

### Password reset placeholder

File: `lib/auth/actions.ts`

Forgot-password validates the email and returns a generic success message. It does not create a token, send an email, or complete reset flow.

### Missing rate limiting

There is no visible rate limiting for:

- Login
- Registration
- Forgot password
- Uploads
- Future exports
- Future sensitive mutations

### Test configuration issue

`npm test` currently fails for auth and authorization tests because Node cannot resolve `@/lib` path aliases in tested modules.

### Bootstrap hardening needed

First-admin registration should be protected from concurrent bootstrap races and unintended public access after setup.

## Future Improvements

### Password reset tokens

Add single-use reset tokens with expiry, secure storage, email delivery, audit events, and rate limits.

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
