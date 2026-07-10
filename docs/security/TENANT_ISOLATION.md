# Tenant Isolation

## Current Implementation

E-Reconcile uses an organization-centered multi-tenant model. Each customer tenant is represented by an `Organization` record. Most operational and financial records include `organizationId`.

The active tenant is determined from the authenticated session. Session loading verifies:

- The session exists.
- The session is not revoked.
- The session is not expired.
- The membership is active.
- The user is active.
- The role belongs to the same organization as the membership.

## Organization Model

The `Organization` model owns:

- Audit logs
- Bank accounts
- Import batches
- Import rows
- Matching rules
- Memberships
- Reconciliation matches
- Reconciliation runs
- Reports
- Roles
- Transaction adjustments
- Transaction review notes
- Transactions

## organizationId Usage

Current application code uses `organizationId` from the active session to scope financial data.

Examples:

- Dashboard metrics query transactions and audit logs by organization.
- Import list queries `ImportBatch` by organization.
- Transaction list queries `Transaction` by organization.
- Reconciliation queues query unmatched transactions by organization.
- Import processing checks that the import batch belongs to the active organization before processing.
- Manual matching validates that both transactions belong to the active organization before creating a match.

## Prisma Filtering Approach

The current approach is application-level tenant filtering with Prisma.

Expected pattern:

```text
where: {
  organizationId: session.organizationId
}
```

For server actions and domain functions, the organization boundary should come from the authenticated session, not from client-provided input.

## Composite Foreign Key Strategy

The schema and migrations show an intended strategy of database-level tenant enforcement using composite foreign keys such as:

- Transaction to import batch by `(organizationId, importBatchId)`
- Transaction to bank account by `(organizationId, bankAccountId)`
- Import row to import batch by `(organizationId, importBatchId)`
- Reconciliation match to run by `(organizationId, reconciliationRunId)`
- Reconciliation match to bank and ledger transactions by `(organizationId, transactionId)`
- Transaction notes and adjustments to transactions by `(organizationId, transactionId)`

This is the correct direction for a multi-tenant financial SaaS because it prevents invalid cross-tenant relations even if application code makes a mistake.

## Known Risks

### Missing or inconsistent composite foreign keys

The migration sequence currently appears inconsistent:

- `20260708043000_phase_4b_tenant_isolation_hardening` adds several composite tenant foreign keys.
- `20260708050504_new_mid` drops many of those constraints and indexes.
- `20260708100000_phase_5d_restore_transaction_import_batch_tenant_fk` restores only the transaction-to-import-batch relation.

This means the final migrated database may not enforce all intended tenant boundaries.

### Migration naming inconsistencies

Some constraint names dropped in `20260708050504_new_mid` appear not to match names created in the earlier migration. This may break clean migration application.

### Application checks are not enough

Application-level checks are necessary but not sufficient for production SaaS data isolation. Database constraints should make cross-tenant relations impossible.

## Current Safety Signals

- Most financial queries include `organizationId`.
- Authorization context is loaded from the database, not trusted from the cookie alone.
- Import processing rejects batches outside the active organization.
- Manual matching rejects cross-organization transactions.
- Several tests verify organization scoping in import and reconciliation logic.

## Future Improvements

### Complete database enforcement

Restore and validate composite foreign keys for all organization-owned relations.

### Tenant isolation testing

Add tests that attempt cross-tenant access for every organization-owned model and every server action.

### PostgreSQL row-level security

Consider PostgreSQL RLS after application-level tenant scoping and composite foreign keys are stable. RLS can provide defense in depth, but it should not replace clear application authorization.

### Query helper conventions

Create tenant-scoped query helpers or repository functions for common financial models so future features do not duplicate scoping logic manually.
