import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { renderReconciliationSummaryXlsx } from "../lib/reports/exporters/xlsx.ts";
import { financialReportHeaders } from "../lib/reports/generation.ts";
import { sampleReconciliationSummaryRow, samplePresentation } from "./helpers/reports-fixtures.ts";

async function loadWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled Buffer type resolves to a different (incompatible)
  // nominal type than this project's global Buffer -- both are the same
  // runtime Buffer, so `any` here is a deliberate, narrow escape from a pure
  // type-declaration mismatch, not a real type-safety gap.
  await workbook.xlsx.load(buffer as any);
  return workbook;
}

function rowValues(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  const values: string[] = [];
  for (let col = 1; col <= sheet.columnCount; col++) {
    values.push(String(row.getCell(col).value ?? ""));
  }
  return values;
}

test("renderReconciliationSummaryXlsx produces a workbook with the four expected sheets", async () => {
  const buffer = await renderReconciliationSummaryXlsx(samplePresentation());
  const workbook = await loadWorkbook(buffer);

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Summary", "Unmatched Transactions", "Exceptions", "Adjustments"],
  );
});

test("renderReconciliationSummaryXlsx's Summary sheet matches the CSV summary headers and one row per run", async () => {
  const rowA = sampleReconciliationSummaryRow({ reconciliationRunId: "run-a", bankAccountName: "Account A" });
  const rowB = sampleReconciliationSummaryRow({ reconciliationRunId: "run-b", bankAccountName: "Account B" });
  const buffer = await renderReconciliationSummaryXlsx(samplePresentation([rowA, rowB]));
  const workbook = await loadWorkbook(buffer);

  const summarySheet = workbook.getWorksheet("Summary")!;
  assert.deepEqual(rowValues(summarySheet, 1), [...financialReportHeaders]);
  assert.equal(summarySheet.rowCount, 3); // header + 2 runs
  assert.equal(rowValues(summarySheet, 2)[1], "Account A");
  assert.equal(rowValues(summarySheet, 3)[1], "Account B");
});

test("renderReconciliationSummaryXlsx's Unmatched Transactions sheet mirrors the presentation model's table", async () => {
  const presentation = samplePresentation();
  const buffer = await renderReconciliationSummaryXlsx(presentation);
  const workbook = await loadWorkbook(buffer);

  const sheet = workbook.getWorksheet("Unmatched Transactions")!;
  assert.deepEqual(rowValues(sheet, 1), [...presentation.unmatchedTransactions.headers]);
  assert.deepEqual(rowValues(sheet, 2), presentation.unmatchedTransactions.rows[0]);
});

test("renderReconciliationSummaryXlsx's Exceptions sheet mirrors the presentation model's table", async () => {
  const presentation = samplePresentation();
  const buffer = await renderReconciliationSummaryXlsx(presentation);
  const workbook = await loadWorkbook(buffer);

  const sheet = workbook.getWorksheet("Exceptions")!;
  assert.deepEqual(rowValues(sheet, 1), [...presentation.exceptions.headers]);
  assert.deepEqual(rowValues(sheet, 2), presentation.exceptions.rows[0]);
});

test("renderReconciliationSummaryXlsx's Adjustments sheet lists every adjustment with its reason and author", async () => {
  const presentation = samplePresentation();
  const buffer = await renderReconciliationSummaryXlsx(presentation);
  const workbook = await loadWorkbook(buffer);

  const sheet = workbook.getWorksheet("Adjustments")!;
  assert.deepEqual(rowValues(sheet, 1), ["Transaction ID", "Field", "Old Value", "New Value", "Reason", "Adjusted By", "Adjusted At"]);
  const adjustment = presentation.adjustments[0]!;
  assert.deepEqual(rowValues(sheet, 2), [
    adjustment.transactionId,
    adjustment.fieldName,
    adjustment.oldValue,
    adjustment.newValue,
    adjustment.reason,
    adjustment.createdBy,
    adjustment.createdAt.toISOString(),
  ]);
});

test("renderReconciliationSummaryXlsx produces an empty Summary sheet (header only) when there are no runs", async () => {
  const buffer = await renderReconciliationSummaryXlsx(samplePresentation([]));
  const workbook = await loadWorkbook(buffer);

  const summarySheet = workbook.getWorksheet("Summary")!;
  assert.equal(summarySheet.rowCount, 1);
});
