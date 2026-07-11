import ExcelJS from "exceljs";
import { financialReportHeaders, reconciliationSummaryRowToStrings } from "../generation.ts";
import type { ReportTable } from "../generation.ts";
import type { ReconciliationSummaryPresentation } from "../render/reconciliation-summary.ts";

const adjustmentHeaders = ["Transaction ID", "Field", "Old Value", "New Value", "Reason", "Adjusted By", "Adjusted At"] as const;

function addTableSheet(workbook: ExcelJS.Workbook, name: string, table: ReportTable | { headers: readonly string[]; rows: string[][] }) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const headerRow = sheet.addRow([...table.headers]);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });

  for (const row of table.rows) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((column) => {
    column.width = 22;
  });

  return sheet;
}

/**
 * Builds a workbook with a Summary sheet (one row per reconciliation run,
 * identical in content to the CSV summary export) plus Unmatched
 * Transactions, Exceptions, and Adjustments detail sheets. Every value comes
 * from the presentation model built in render/reconciliation-summary.ts --
 * no querying or financial calculation happens in this module.
 */
export async function renderReconciliationSummaryXlsx(presentation: ReconciliationSummaryPresentation): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "E-Reconcile MN";
  workbook.created = presentation.generatedAt;

  addTableSheet(workbook, "Summary", {
    headers: financialReportHeaders,
    rows: presentation.rows.map(reconciliationSummaryRowToStrings),
  });

  addTableSheet(workbook, "Unmatched Transactions", presentation.unmatchedTransactions);
  addTableSheet(workbook, "Exceptions", presentation.exceptions);

  addTableSheet(workbook, "Adjustments", {
    headers: adjustmentHeaders,
    rows: presentation.adjustments.map((adjustment) => [
      adjustment.transactionId,
      adjustment.fieldName,
      adjustment.oldValue,
      adjustment.newValue,
      adjustment.reason,
      adjustment.createdBy,
      adjustment.createdAt.toISOString(),
    ]),
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
