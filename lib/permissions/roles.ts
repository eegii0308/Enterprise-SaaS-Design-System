import type { Permission, RoleName } from "@/types/permissions";

export const fixedRoleLabels: Record<RoleName, string> = {
  ADMIN: "Admin",
  FINANCE_MANAGER: "Finance Manager",
  ACCOUNTANT: "Accountant",
  AUDITOR: "Auditor",
  VIEWER: "Viewer",
};

export const fixedRoleDescriptions: Record<RoleName, string> = {
  ADMIN: "Full tenant administration and financial workflow access.",
  FINANCE_MANAGER: "Reviews, approves, reports, and manages reconciliation work.",
  ACCOUNTANT: "Imports transactions, reviews records, and prepares reconciliations.",
  AUDITOR: "Reviews transactions, reports, and audit history without editing financial data.",
  VIEWER: "Read-only access to approved finance workspace views.",
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
