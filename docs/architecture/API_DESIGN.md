# API Design

## API Goals

The MVP API should support the core reconciliation cycle without expanding into enterprise platform features.

API behavior should be:

- Organization-scoped.
- Permission-checked.
- Typed.
- Paginated where lists may grow.
- Consistent in error format.

## Response Shape

Success responses:

```json
{
  "data": {},
  "meta": {}
}
```

Error responses:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

## Authentication

Routes under the dashboard require an authenticated session.

Server-side checks must confirm:

- User is signed in.
- User has an active membership.
- User belongs to the requested organization.

## MVP Endpoints

### Auth

Authentication may be implemented through provider SDKs, but the app needs these flows:

- Sign in.
- Sign out.
- Register organization owner.
- Forgot password.
- Reset password.

Deferred unless required by launch policy:

- Accept invitation.
- Verify MFA.

### Dashboard

`GET /api/dashboard/summary`

Returns:

- total transactions
- matched count
- unmatched count
- exception count
- match rate
- recent activity

### Transactions

`GET /api/transactions`

Query parameters:

- `page`
- `page_size`
- `search`
- `status`
- `source_type`
- `date_from`
- `date_to`

`GET /api/transactions/:id`

`PATCH /api/transactions/:id`

Allowed MVP updates:

- status
- vendor
- reference
- review notes, stored as review note records

### Imports

`POST /api/imports`

Creates an import batch and uploads a file.

`GET /api/imports`

Lists import history.

`GET /api/imports/:id`

Returns import status, row counts, mapping status, duplicate counts, row-level errors, and processing errors.

`POST /api/imports/:id/process`

Starts import processing after mapping is confirmed.

### Reconciliation

`GET /api/reconciliation/runs`

`POST /api/reconciliation/runs`

`GET /api/reconciliation/runs/:id`

`PATCH /api/reconciliation/runs/:id/status`

Moves a run through allowed lifecycle states.

`GET /api/reconciliation/runs/:id/candidates`

Returns unmatched bank and ledger transactions for the workspace.

`POST /api/reconciliation/runs/:id/matches`

Creates a manual match or a rule-based proposed match.

`PATCH /api/reconciliation/matches/:id`

Confirms or rejects a proposed match.

`DELETE /api/reconciliation/matches/:id`

Removes a match by status change and audit log entry; hard delete is not part of the MVP.

### Matching Rules

`GET /api/matching-rules`

`POST /api/matching-rules`

`PATCH /api/matching-rules/:id`

`DELETE /api/matching-rules/:id`

Deletion may be implemented as `inactive` status for audit safety.

Matching rules are MVP-late and only create proposed matches. They must not auto-approve matches.

### Reports

`GET /api/reports`

`POST /api/reports`

Creates a report generation job for summary, exception, or unmatched reports.

`GET /api/reports/:id`

Returns report metadata and download URL when ready.

### Users And Roles

`GET /api/users`

`POST /api/users`

Creates a user or membership through an admin-controlled MVP flow.

`PATCH /api/memberships/:id`

Updates role or status.

`GET /api/roles`

Roles are fixed system roles for MVP. Custom role editing is deferred.

### Settings

`GET /api/settings/organization`

`PATCH /api/settings/organization`

Supports:

- company name
- default currency
- fiscal year start month

### Audit Logs

`GET /api/audit-logs`

Query parameters:

- `page`
- `page_size`
- `actor_user_id`
- `resource_type`
- `date_from`
- `date_to`

## API Security Rules

- All mutations require CSRF/session protection appropriate to the auth strategy.
- All file uploads require extension, size, MIME, and content validation.
- Financial data export requires explicit permission.
- Auth, upload, and export endpoints require rate limits.
- Role changes and reconciliation approvals must write audit logs.
- API errors must not expose secrets, stack traces, raw database errors, storage paths, signed URL internals, or SQL details.
- Every read and mutation must validate organization context on the server.