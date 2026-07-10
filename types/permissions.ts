export const permissions = [
  "transactions.view",
  "transactions.edit",
  "transactions.note",
  "imports.create",
  "reconciliation.run",
  "reconciliation.approve",
  "bank_accounts.manage",
  "reports.view",
  "reports.export",
  "matching_rules.manage",
  "users.manage",
  "settings.manage",
  "audit_logs.view",
  "audit_logs.export",
] as const;

export type Permission = (typeof permissions)[number];
export type RoleName = "ADMIN" | "FINANCE_MANAGER" | "ACCOUNTANT" | "AUDITOR" | "VIEWER";
