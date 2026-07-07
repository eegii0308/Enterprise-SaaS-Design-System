import type { Permission, RoleName } from "@/types/permissions";
import { t } from "@/lib/i18n";

export const fixedRoleLabels: Record<RoleName, string> = {
  ADMIN: t("roles.admin"),
  FINANCE_MANAGER: t("roles.financeManager"),
  ACCOUNTANT: t("roles.accountant"),
  AUDITOR: t("roles.auditor"),
  VIEWER: t("roles.viewer"),
};

export const fixedRoleDescriptions: Record<RoleName, string> = {
  ADMIN: t("roles.descriptions.admin"),
  FINANCE_MANAGER: t("roles.descriptions.financeManager"),
  ACCOUNTANT: t("roles.descriptions.accountant"),
  AUDITOR: t("roles.descriptions.auditor"),
  VIEWER: t("roles.descriptions.viewer"),
};

export const rolePermissions: Record<RoleName, readonly Permission[]> = {
  ADMIN: [
    "transactions.view",
    "transactions.edit",
    "transactions.note",
    "imports.create",
    "reconciliation.run",
    "reconciliation.approve",
    "reports.view",
    "reports.export",
    "matching_rules.manage",
    "users.manage",
    "settings.manage",
    "audit_logs.view",
    "audit_logs.export",
  ],
  FINANCE_MANAGER: [
    "transactions.view",
    "transactions.edit",
    "transactions.note",
    "imports.create",
    "reconciliation.run",
    "reconciliation.approve",
    "reports.view",
    "reports.export",
    "matching_rules.manage",
    "audit_logs.view",
  ],
  ACCOUNTANT: [
    "transactions.view",
    "transactions.edit",
    "transactions.note",
    "imports.create",
    "reconciliation.run",
    "reports.view",
  ],
  AUDITOR: ["transactions.view", "reports.view", "audit_logs.view", "audit_logs.export"],
  VIEWER: ["transactions.view", "reports.view"],
};

export function hasPermission(roleName: RoleName, permission: Permission) {
  return rolePermissions[roleName].includes(permission);
}
