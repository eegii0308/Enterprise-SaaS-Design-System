import { ReconciliationMatchStatus, ReportType, TransactionStatus, type SourceType } from "@prisma/client";
import { prisma } from "../db/client.ts";

export type ReportGenerationErrorCode = "VALIDATION" | "SERVER";

export class ReportGenerationError extends Error {
  readonly code: ReportGenerationErrorCode;

  constructor(message: string, code: ReportGenerationErrorCode) {
    super(message);
    this.name = "ReportGenerationError";
    this.code = code;
  }
}

export type ReportTable = {
  headers: readonly string[];
  rows: string[][];
};

export type GenerateReportInput = {
  reportType: ReportType;
  periodStart: Date;
  periodEnd: Date;
};

export type GenerateReportContext = {
  organizationId: string;
};

type RunRecord = {
  id: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
};

type MatchRecord = {
  reconciliationRunId: string;
  status: ReconciliationMatchStatus;
};

type ReportTransactionRecord = {
  id: string;
  sourceType: SourceType;
  transactionDate: Date;
  description: string;
  vendor: string | null;
  reference: string | null;
  amount: { toFixed(digits: number): string };
  currency: string;
  exceptionReason?: string | null;
  exceptionMarkedBy?: string | null;
  exceptionMarkedAt?: Date | null;
};

export type ReportGenerationDatabase = {
  reconciliationRun: {
    findMany(args: unknown): Promise<RunRecord[]>;
  };
  reconciliationMatch: {
    findMany(args: unknown): Promise<MatchRecord[]>;
  };
  transaction: {
    findMany(args: unknown): Promise<ReportTransactionRecord[]>;
  };
};

function validateInput(input: GenerateReportInput) {
  if (!Object.values(ReportType).includes(input.reportType)) {
    throw new ReportGenerationError("A valid report type is required.", "VALIDATION");
  }

  if (Number.isNaN(input.periodStart.getTime()) || Number.isNaN(input.periodEnd.getTime())) {
    throw new ReportGenerationError("A valid period start and end date are required.", "VALIDATION");
  }

  if (input.periodStart.getTime() > input.periodEnd.getTime()) {
    throw new ReportGenerationError("The period start date must not be after the period end date.", "VALIDATION");
  }
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function buildReconciliationSummaryTable(
  input: GenerateReportInput,
  context: GenerateReportContext,
  database: ReportGenerationDatabase,
): Promise<ReportTable> {
  const runs = await database.reconciliationRun.findMany({
    where: {
      organizationId: context.organizationId,
      periodStart: { lte: input.periodEnd },
      periodEnd: { gte: input.periodStart },
    },
    select: { id: true, name: true, periodStart: true, periodEnd: true, status: true, createdAt: true, approvedAt: true },
    orderBy: { periodStart: "asc" },
  });

  const runIds = runs.map((run) => run.id);

  const matches = runIds.length
    ? await database.reconciliationMatch.findMany({
        where: { organizationId: context.organizationId, reconciliationRunId: { in: runIds } },
        select: { reconciliationRunId: true, status: true },
      })
    : [];

  const matchCountsByRun = new Map<string, Record<ReconciliationMatchStatus, number>>();

  for (const match of matches) {
    const counts = matchCountsByRun.get(match.reconciliationRunId) ?? {
      PROPOSED: 0,
      CONFIRMED: 0,
      REJECTED: 0,
      REMOVED: 0,
    };
    counts[match.status] += 1;
    matchCountsByRun.set(match.reconciliationRunId, counts);
  }

  const rows = runs.map((run) => {
    const counts = matchCountsByRun.get(run.id) ?? { PROPOSED: 0, CONFIRMED: 0, REJECTED: 0, REMOVED: 0 };
    const totalMatches = counts.PROPOSED + counts.CONFIRMED + counts.REJECTED + counts.REMOVED;

    return [
      run.name,
      formatDateOnly(run.periodStart),
      formatDateOnly(run.periodEnd),
      run.status,
      String(counts.CONFIRMED),
      String(counts.REJECTED),
      String(counts.REMOVED),
      String(totalMatches),
      run.createdAt.toISOString(),
      run.approvedAt ? run.approvedAt.toISOString() : "",
    ];
  });

  return {
    headers: [
      "Reconciliation Run",
      "Period Start",
      "Period End",
      "Status",
      "Confirmed Matches",
      "Rejected Matches",
      "Removed Matches",
      "Total Matches",
      "Created At",
      "Approved At",
    ],
    rows,
  };
}

async function buildExceptionListTable(
  input: GenerateReportInput,
  context: GenerateReportContext,
  database: ReportGenerationDatabase,
): Promise<ReportTable> {
  const transactions = await database.transaction.findMany({
    where: {
      organizationId: context.organizationId,
      status: TransactionStatus.EXCEPTION,
      exceptionMarkedAt: { gte: input.periodStart, lte: input.periodEnd },
    },
    select: {
      id: true,
      sourceType: true,
      transactionDate: true,
      description: true,
      vendor: true,
      reference: true,
      amount: true,
      currency: true,
      exceptionReason: true,
      exceptionMarkedBy: true,
      exceptionMarkedAt: true,
    },
    orderBy: { exceptionMarkedAt: "asc" },
  });

  const rows = transactions.map((transaction) => [
    transaction.id,
    transaction.sourceType,
    formatDateOnly(transaction.transactionDate),
    transaction.description,
    transaction.vendor ?? "",
    transaction.reference ?? "",
    transaction.amount.toFixed(2),
    transaction.currency,
    transaction.exceptionReason ?? "",
    transaction.exceptionMarkedBy ?? "",
    transaction.exceptionMarkedAt ? transaction.exceptionMarkedAt.toISOString() : "",
  ]);

  return {
    headers: [
      "Transaction ID",
      "Source",
      "Transaction Date",
      "Description",
      "Vendor",
      "Reference",
      "Amount",
      "Currency",
      "Exception Reason",
      "Marked By",
      "Marked At",
    ],
    rows,
  };
}

async function buildUnmatchedTransactionsTable(
  input: GenerateReportInput,
  context: GenerateReportContext,
  database: ReportGenerationDatabase,
): Promise<ReportTable> {
  const transactions = await database.transaction.findMany({
    where: {
      organizationId: context.organizationId,
      status: TransactionStatus.UNMATCHED,
      transactionDate: { gte: input.periodStart, lte: input.periodEnd },
    },
    select: {
      id: true,
      sourceType: true,
      transactionDate: true,
      description: true,
      vendor: true,
      reference: true,
      amount: true,
      currency: true,
    },
    orderBy: [{ sourceType: "asc" }, { transactionDate: "asc" }],
  });

  const rows = transactions.map((transaction) => [
    transaction.id,
    transaction.sourceType,
    formatDateOnly(transaction.transactionDate),
    transaction.description,
    transaction.vendor ?? "",
    transaction.reference ?? "",
    transaction.amount.toFixed(2),
    transaction.currency,
  ]);

  return {
    headers: ["Transaction ID", "Source", "Transaction Date", "Description", "Vendor", "Reference", "Amount", "Currency"],
    rows,
  };
}

export async function generateReportTable(
  input: GenerateReportInput,
  context: GenerateReportContext,
  database: ReportGenerationDatabase = prisma as unknown as ReportGenerationDatabase,
): Promise<ReportTable> {
  validateInput(input);

  switch (input.reportType) {
    case ReportType.RECONCILIATION_SUMMARY:
      return buildReconciliationSummaryTable(input, context, database);
    case ReportType.EXCEPTION_LIST:
      return buildExceptionListTable(input, context, database);
    case ReportType.UNMATCHED_TRANSACTIONS:
      return buildUnmatchedTransactionsTable(input, context, database);
    default:
      throw new ReportGenerationError("A valid report type is required.", "VALIDATION");
  }
}
