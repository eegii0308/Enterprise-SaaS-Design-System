import { ReportType } from "@prisma/client";
import { prisma } from "../../db/client.ts";
import {
  computeReconciliationSummaryRows,
  generateReportTable,
  type ReconciliationSummaryRow,
  type ReportGenerationDatabase,
  type GenerateReportContext,
  type ReportTable,
  type ReportAdjustmentRecord,
} from "../generation.ts";

export type ReconciliationSummaryReportInput = {
  periodStart: Date;
  periodEnd: Date;
};

/**
 * The single presentation model for the financial reconciliation report.
 * Every exporter (CSV summary rows, PDF, XLSX) is built from this same
 * object -- none of them queries the database or performs a financial
 * calculation of its own. `rows` comes from computeReconciliationSummaryRows
 * (generation.ts), the same structured computation the CSV table and this
 * presentation model both format independently; `unmatchedTransactions` and
 * `exceptions` are the exact same generateReportTable() output already used
 * by the standalone UNMATCHED_TRANSACTIONS/EXCEPTION_LIST reports, reused
 * rather than re-queried; `adjustments` is the one genuinely new listing
 * query this phase adds (there was no existing "list adjustments" report to
 * reuse), scoped identically to the adjustment *counts* already computed in
 * computeReconciliationSummaryRows.
 */
export type ReconciliationSummaryPresentation = {
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  rows: ReconciliationSummaryRow[];
  unmatchedTransactions: ReportTable;
  exceptions: ReportTable;
  adjustments: ReportAdjustmentRecord[];
};

export async function buildReconciliationSummaryPresentation(
  input: ReconciliationSummaryReportInput,
  context: GenerateReportContext,
  database: ReportGenerationDatabase = prisma as unknown as ReportGenerationDatabase,
): Promise<ReconciliationSummaryPresentation> {
  const reportInput = { ...input, reportType: ReportType.RECONCILIATION_SUMMARY };
  const period = { transactionDate: { gte: input.periodStart, lte: input.periodEnd } };

  const [rows, unmatchedTransactions, exceptions, bankAdjustments, ledgerAdjustments] = await Promise.all([
    computeReconciliationSummaryRows(reportInput, context, database),
    generateReportTable({ ...input, reportType: ReportType.UNMATCHED_TRANSACTIONS }, context, database),
    generateReportTable({ ...input, reportType: ReportType.EXCEPTION_LIST }, context, database),
    database.transactionAdjustment.findMany({
      where: { transaction: { organizationId: context.organizationId, sourceType: "BANK", ...period } },
      select: { id: true, transactionId: true, fieldName: true, oldValue: true, newValue: true, reason: true, createdBy: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    database.transactionAdjustment.findMany({
      where: { transaction: { organizationId: context.organizationId, sourceType: "LEDGER", ...period } },
      select: { id: true, transactionId: true, fieldName: true, oldValue: true, newValue: true, reason: true, createdBy: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const adjustments = [...bankAdjustments, ...ledgerAdjustments].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  return {
    generatedAt: new Date(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    rows,
    unmatchedTransactions,
    exceptions,
    adjustments,
  };
}
