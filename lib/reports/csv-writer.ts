import type { ReportTable } from "./generation.ts";

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
