# Audit Log Policy

## Current Implementation

The `AuditLog` model stores:

- Organization ID
- Actor user ID
- Action
- Resource type
- Resource ID
- Metadata
- IP address
- Created timestamp

Audit logs are tenant-owned through `organizationId`.

## Existing Usage

Current code writes audit logs for:

- First organization creation in `lib/auth/core.ts`
- Import creation in `app/dashboard/imports/actions.ts`
- Import processing start in `lib/imports/processor.ts`
- Import completion in `lib/imports/processor.ts`
- Import failure in `lib/imports/processor.ts`
- Manual reconciliation match creation in `lib/reconciliation/manual-match.ts`

## Current Limitations

- There is no central audit service.
- Event names are not defined in a shared catalog.
- Metadata shape is not standardized.
- Request context such as IP and user agent is not consistently captured.
- Retention policy is not defined.
- Audit log immutability is not enforced beyond normal application behavior.
- Not every future financial mutation is implemented or audited yet.

## Policy Requirements

Every material financial or security-sensitive action should write an audit event.

Required event categories:

- Authentication and session events.
- Import lifecycle events.
- Transaction correction events.
- Transaction review note events.
- Manual match creation.
- Match rejection or removal.
- Reconciliation run approval.
- Reconciliation run reopening.
- Report generation.
- Report export/download.
- User invitation and membership changes.
- Role and permission changes.
- Settings changes.
- Failed authorization attempts where useful for security monitoring.

## Future Requirements

### Central audit service

Create one shared audit writer used by all server actions and domain services.

### Actor tracking

Audit events should record:

- Actor user ID.
- Organization ID.
- Membership or role context where relevant.
- Whether the actor was a system process or user.

### Metadata

Metadata should be structured and stable. It should include:

- Resource identifiers.
- Before and after values where appropriate.
- Timestamps.
- Request or correlation ID.
- Workflow-specific details.

Sensitive values should not be stored directly in audit metadata.

### Immutable audit history

Audit logs should be append-only from application code. Updates or deletes should not be part of normal workflows.

### Retention policy

Define retention by environment and compliance requirements. Production retention should account for financial audit expectations, customer contracts, and legal requirements.

### Access control

Audit log viewing should require `audit_logs.view`. Audit log exports should require `audit_logs.export`.

## Current Status

The project has the right audit log table and initial audit events, but audit logging is not yet production-complete.
