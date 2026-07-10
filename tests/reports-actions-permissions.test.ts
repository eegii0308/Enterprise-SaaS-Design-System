import test from "node:test";
import assert from "node:assert/strict";
import { ReportType } from "@prisma/client";
import { generateReportTable, type ReportGenerationDatabase } from "../lib/reports/generation.ts";

// These tests exercise the permission gate that
// app/dashboard/reports/actions.ts applies in front of generateReportTable()
// before it will write a CSV export, without importing actions.ts itself.
// actions.ts pulls in requirePermission() from "@/lib/permissions/authorize",
// which transitively imports "@/lib/errors" and "@/lib/permissions/roles"
// (both use the "@/" TS path alias). That alias is only resolved by tsc, not
// by this repo's plain `node --test --experimental-strip-types` runner, so
// any file in that import chain fails to load here (the same pre-existing
// gap documented in tests/reconciliation-actions-permissions.test.ts).
//
// ROLE_PERMISSIONS mirrors the "reports.view"/"reports.export" entries of
// rolePermissions in lib/permissions/roles.ts, and
// simulateGenerateReportExportAction mirrors the
// permission-check-then-domain-call shape of the real action, so these
// tests verify the same access rules against the real domain function and a
// mocked database.

class SimulatedPermissionError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(role: string, permission: string) {
    super(`Role ${role} lacks permission ${permission}.`);
  }
}

const ROLE_PERMISSIONS = {
  ADMIN: ["reports.view", "reports.export"],
  FINANCE_MANAGER: ["reports.view", "reports.export"],
  ACCOUNTANT: ["reports.view"],
  AUDITOR: ["reports.view"],
  VIEWER: ["reports.view"],
} as const;

type RoleName = keyof typeof ROLE_PERMISSIONS;

function assertPermission(role: RoleName, permission: string) {
  if (!(ROLE_PERMISSIONS[role] as readonly string[]).includes(permission)) {
    throw new SimulatedPermissionError(role, permission);
  }
}

const context = { organizationId: "org-1" };

function createDatabase(): ReportGenerationDatabase & { findManyCallCount: number } {
  const state = { findManyCallCount: 0 };

  return {
    get findManyCallCount() {
      return state.findManyCallCount;
    },
    reconciliationRun: {
      async findMany() {
        state.findManyCallCount += 1;
        return [];
      },
    },
    reconciliationMatch: {
      async findMany() {
        state.findManyCallCount += 1;
        return [];
      },
    },
    transaction: {
      async findMany() {
        state.findManyCallCount += 1;
        return [];
      },
    },
  };
}

async function simulateGenerateReportExportAction(
  role: RoleName,
  input: { reportType: ReportType; periodStart: Date; periodEnd: Date },
  database: ReportGenerationDatabase,
) {
  assertPermission(role, "reports.export");
  return generateReportTable(input, context, database);
}

const exportInput = {
  reportType: ReportType.UNMATCHED_TRANSACTIONS,
  periodStart: new Date("2026-06-01T00:00:00.000Z"),
  periodEnd: new Date("2026-06-30T23:59:59.999Z"),
};

for (const role of ["ADMIN", "FINANCE_MANAGER"] as const) {
  test(`generateReportExportAction allows ${role} and executes report generation`, async () => {
    const db = createDatabase();

    const table = await simulateGenerateReportExportAction(role, exportInput, db);

    assert.ok(table.headers.length > 0);
    assert.equal(db.findManyCallCount, 1);
  });
}

for (const role of ["ACCOUNTANT", "AUDITOR", "VIEWER"] as const) {
  test(`generateReportExportAction denies ${role} with FORBIDDEN and never runs report generation`, async () => {
    const db = createDatabase();

    await assert.rejects(
      simulateGenerateReportExportAction(role, exportInput, db),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );

    assert.equal(db.findManyCallCount, 0);
  });
}

// ---- reports.view: all roles can view the dynamic report ----

for (const role of ["ADMIN", "FINANCE_MANAGER", "ACCOUNTANT", "AUDITOR", "VIEWER"] as const) {
  test(`the dynamic report view is available to ${role} (reports.view)`, async () => {
    assertPermission(role, "reports.view");
    const db = createDatabase();

    const table = await generateReportTable(exportInput, context, db);

    assert.ok(table.headers.length > 0);
  });
}
