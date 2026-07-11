import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildReconciliationSummaryPresentation } from "../lib/reports/render/reconciliation-summary.ts";
import { serializeReconciliationSummaryToCsv } from "../lib/reports/exporters/csv.ts";
import { buildReconciliationSummaryPdfSections, renderReconciliationSummaryPdf } from "../lib/reports/exporters/pdf.ts";
import { renderReconciliationSummaryXlsx } from "../lib/reports/exporters/xlsx.ts";
import { createFinancialDatabase, baseRun } from "./helpers/reports-mock-database.ts";
import { samplePresentation } from "./helpers/reports-fixtures.ts";

// These tests exercise the permission gate and org-scoping that
// app/api/reports/[reportId]/download/route.ts applies before rendering an
// export, without importing the route itself. The real route imports
// requirePermission() from "@/lib/permissions/authorize", which uses the
// "@/" path alias this plain `node --test` runner cannot resolve -- same
// pre-existing gap documented in tests/reports-actions-permissions.test.ts.
// simulateDownload mirrors the route's actual shape (permission check ->
// org-scoped report lookup -> branch by format -> audit log write) closely
// enough to verify the same access rules and audit behavior against the
// real domain functions.

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

type MockReport = { id: string; organizationId: string; periodStart: Date; periodEnd: Date; storedCsv: string };
type AuditEntry = { action: string; reportId: string; reportType: string; format: string; userId: string; timestamp: string };

async function simulateDownload(
  role: RoleName,
  requestingOrgId: string,
  reportId: string,
  format: "csv" | "pdf" | "xlsx",
  reports: MockReport[],
  database: ReturnType<typeof createFinancialDatabase>,
  auditLog: AuditEntry[],
) {
  assertPermission(role, "reports.export");

  const report = reports.find((candidate) => candidate.id === reportId && candidate.organizationId === requestingOrgId);

  if (!report) {
    return { status: 404 as const };
  }

  let fileBuffer: Buffer | string;

  if (format === "csv") {
    fileBuffer = report.storedCsv;
  } else {
    const presentation = await buildReconciliationSummaryPresentation(
      { periodStart: report.periodStart, periodEnd: report.periodEnd },
      { organizationId: requestingOrgId },
      database,
    );
    fileBuffer =
      format === "pdf" ? await renderReconciliationSummaryPdf(presentation) : await renderReconciliationSummaryXlsx(presentation);
  }

  auditLog.push({
    action: "REPORT_DOWNLOADED",
    reportId,
    reportType: "RECONCILIATION_SUMMARY",
    format,
    userId: `${role}-user`,
    timestamp: new Date().toISOString(),
  });

  return { status: 200 as const, fileBuffer };
}

const org1Report: MockReport = {
  id: "report-1",
  organizationId: "org-1",
  periodStart: new Date("2026-06-01T00:00:00.000Z"),
  periodEnd: new Date("2026-06-30T23:59:59.999Z"),
  storedCsv: "stored csv content",
};

function emptyDatabase() {
  return createFinancialDatabase({ runs: [baseRun()], bankAccounts: [{ id: "account-1", name: "Operating account" }] });
}

// ---- Permissions ----

for (const role of ["ADMIN", "FINANCE_MANAGER"] as const) {
  for (const format of ["csv", "pdf", "xlsx"] as const) {
    test(`${role} can download a ${format} export`, async () => {
      const auditLog: AuditEntry[] = [];
      const result = await simulateDownload(role, "org-1", "report-1", format, [org1Report], emptyDatabase(), auditLog);

      assert.equal(result.status, 200);
      assert.equal(auditLog.length, 1);
      assert.equal(auditLog[0]?.format, format);
    });
  }
}

for (const role of ["ACCOUNTANT", "AUDITOR", "VIEWER"] as const) {
  test(`${role} cannot download any export format`, async () => {
    const auditLog: AuditEntry[] = [];

    await assert.rejects(
      simulateDownload(role, "org-1", "report-1", "csv", [org1Report], emptyDatabase(), auditLog),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );
    assert.equal(auditLog.length, 0);
  });
}

// ---- Organization isolation ----

test("a report from another organization is not found, and nothing is rendered or audited", async () => {
  const auditLog: AuditEntry[] = [];

  const result = await simulateDownload("ADMIN", "org-2", "report-1", "pdf", [org1Report], emptyDatabase(), auditLog);

  assert.equal(result.status, 404);
  assert.equal(auditLog.length, 0);
});

// ---- Repeat downloads ----

test("downloading the same report twice writes two separate audit entries", async () => {
  const auditLog: AuditEntry[] = [];
  const database = emptyDatabase();

  await simulateDownload("ADMIN", "org-1", "report-1", "csv", [org1Report], database, auditLog);
  await simulateDownload("ADMIN", "org-1", "report-1", "pdf", [org1Report], database, auditLog);

  assert.equal(auditLog.length, 2);
  assert.equal(auditLog[0]?.format, "csv");
  assert.equal(auditLog[1]?.format, "pdf");
  assert.equal(auditLog[0]?.reportId, "report-1");
  assert.equal(auditLog[1]?.reportId, "report-1");
});

// ---- Report consistency across formats ----
//
// Built from ONE presentation model, the variance/matched-amount/etc.
// figures must appear identically in the CSV row, the PDF content plan, and
// the XLSX Summary sheet -- proving all three exporters trace back to the
// same computeReconciliationSummaryRows() output rather than each
// recomputing (or worse, disagreeing on) the numbers.

test("CSV, PDF, and XLSX summaries all reflect the same figures for the same presentation model", async () => {
  const presentation = samplePresentation();
  const row = presentation.rows[0]!;

  const csv = serializeReconciliationSummaryToCsv(presentation);
  const csvDataLine = csv.split("\r\n")[1]!;
  assert.ok(csvDataLine.includes("50.00")); // variance
  assert.ok(csvDataLine.includes("930.00")); // matched amount

  const [pdfSection] = buildReconciliationSummaryPdfSections(presentation);
  assert.equal(pdfSection!.financialFields.find((f) => f.label === "Variance")?.value, `${row.currency} 50.00`);
  assert.equal(pdfSection!.financialFields.find((f) => f.label === "Matched Amount")?.value, `${row.currency} 930.00`);

  const xlsxBuffer = await renderReconciliationSummaryXlsx(presentation);
  const workbook = new ExcelJS.Workbook();
  // See loadWorkbook() in reports-exporters-xlsx.test.ts for why `any` here.
  await workbook.xlsx.load(xlsxBuffer as any);
  const summarySheet = workbook.getWorksheet("Summary")!;
  const dataRow = summarySheet.getRow(2);
  const varianceColumnIndex = 15; // 1-indexed position of "Variance" in financialReportHeaders
  const matchedColumnIndex = 16; // "Matched Amount"
  assert.equal(String(dataRow.getCell(varianceColumnIndex).value), "50.00");
  assert.equal(String(dataRow.getCell(matchedColumnIndex).value), "930.00");
});
