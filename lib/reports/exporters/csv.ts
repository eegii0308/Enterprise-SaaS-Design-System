import { financialReportHeaders, reconciliationSummaryRowToStrings } from "../generation.ts";
import type { ReportTable } from "../generation.ts";
import type { ReconciliationSummaryPresentation } from "../render/reconciliation-summary.ts";

const fieldNeedsQuotingPattern = /["\n\r,]/;

export function escapeCsvField(value: string): string {
  if (!fieldNeedsQuotingPattern.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function serializeReportTableToCsv(table: ReportTable): string {
  const lines = [table.headers as string[], ...table.rows].map((row) => row.map(escapeCsvField).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

// The summary CSV is a flat table -- one row per reconciliation run -- built
// directly from the presentation model's `rows`, using the exact same
// reconciliationSummaryRowToStrings() formatter generateReportTable() uses
// internally. This keeps the "view report in browser" table, the plain CSV
// export, and this exporter byte-for-byte consistent, all tracing back to
// computeReconciliationSummaryRows() as the one source of truth.
export function serializeReconciliationSummaryToCsv(presentation: ReconciliationSummaryPresentation): string {
  return serializeReportTableToCsv({
    headers: financialReportHeaders,
    rows: presentation.rows.map(reconciliationSummaryRowToStrings),
  });
}
