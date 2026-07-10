-- Grant the new "bank_accounts.manage" permission (Phase 7D) to every
-- existing ADMIN and FINANCE_MANAGER role. New organizations already pick
-- this up from rolePermissions in lib/permissions/roles.ts at registration
-- time; this backfills roles created before this permission existed.
INSERT INTO "role_permissions" ("id", "role_id", "permission")
SELECT
  'perm_' || substr(md5(r.id || 'bank_accounts.manage'), 1, 24),
  r.id,
  'bank_accounts.manage'
FROM "roles" r
WHERE r.name IN ('ADMIN', 'FINANCE_MANAGER')
ON CONFLICT ("role_id", "permission") DO NOTHING;

-- Only one active bank account per organization may share the same bank and
-- account number; archived accounts are excluded so a re-added account never
-- collides with its own history. Prisma's schema DSL cannot express a
-- partial (WHERE-qualified) unique index, so this is enforced here as
-- defense-in-depth alongside the duplicate check in
-- lib/bank-accounts/management.ts.
CREATE UNIQUE INDEX "bank_accounts_org_bank_number_active_key"
  ON "bank_accounts"("organization_id", "bank_name", "masked_account_number")
  WHERE "status" = 'active';

-- CreateIndex
CREATE INDEX "bank_accounts_organization_id_status_idx" ON "bank_accounts"("organization_id", "status");
