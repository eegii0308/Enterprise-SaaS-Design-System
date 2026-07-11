import { Prisma, ReportType, TransactionStatus, type SourceType } from "@prisma/client";
import { prisma } from "../db/client.ts";
import { calculateReconciliationTieOut } from "../reconciliation/tie-out-summary.ts";
import { evaluateApprovalReadiness, type ApprovalValidationDatabase } from "../reconciliation/approval-validation.ts";

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

type RunListRecord = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  bankAccountId: string;
  createdBy: string;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  organization: { name: string };
};

type BankAccountNameRecord = { id: string; name: string };
type UserNameRecord = { id: string; fullName: string };
type ApprovalAuditLogRecord = { resourceId: string | null; metadata: unknown };

type DecimalLike = Prisma.Decimal | number | string;

// Must include `amount` (not just the new creditAmount/debitAmount fields)
// so this is a strict superset of ApprovalValidationDatabase["transaction"]'s
// own aggregate() return type -- TypeScript only resolves an intersection of
// two same-named methods to the more specific one when it's an actual
// subtype of the other, not merely overlapping.
type DecimalAggregateResult = { _sum: { amount: DecimalLike | null; creditAmount: DecimalLike | null; debitAmount: DecimalLike | null } };

export type ReportTransactionRecord = {
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

// Composes the tie-out and approval-readiness database contracts (rather than
// redeclaring reconciliationRun.findUnique/transaction.aggregate/
// reconciliationMatch.findMany/transaction.count) so calculateReconciliationTieOut
// and evaluateApprovalReadiness can be called directly with the same
// `database` this module receives -- no separate calculation logic is
// reimplemented here for figures those services already compute.
//
// `transaction` and `reconciliationRun` are declared as fresh, standalone
// types (not `ApprovalValidationDatabase["transaction"] & { ... }`) because
// intersecting two signatures for the *same* method name (aggregate here)
// does not resolve to the more specific one in TypeScript, even when one is
// a strict subtype of the other -- it silently keeps the first-declared,
// narrower signature. Declaring the full method set once, as a type that
// happens to be assignable to ApprovalValidationDatabase's shape, avoids
// that trap entirely.
type ReportRunClient = {
  findUnique: ApprovalValidationDatabase["reconciliationRun"]["findUnique"];
  findMany(args: unknown): Promise<RunListRecord[]>;
};

type ReportTransactionClient = {
  aggregate(args: unknown): Promise<DecimalAggregateResult>;
  count: ApprovalValidationDatabase["transaction"]["count"];
  findMany(args: unknown): Promise<ReportTransactionRecord[]>;
};

export type ReportAdjustmentRecord = {
  id: string;
  transactionId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
  createdBy: string;
  createdAt: Date;
};

export type ReportGenerationDatabase = {
  reconciliationRun: ReportRunClient;
  reconciliationMatch: ApprovalValidationDatabase["reconciliationMatch"];
  transaction: ReportTransactionClient;
  transactionAdjustment: {
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<ReportAdjustmentRecord[]>;
  };
  bankAccount: {
    findMany(args: unknown): Promise<BankAccountNameRecord[]>;
  };
  user: {
    findMany(args: unknown): Promise<UserNameRecord[]>;
  };
  auditLog: {
    findMany(args: unknown): Promise<ApprovalAuditLogRecord[]>;
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

function toDecimal(value: unknown): Prisma.Decimal {
  return new Prisma.Decimal((value as DecimalLike | null | undefined) ?? 0);
}

export const financialReportHeaders = [
  "Organization",
  "Bank Account",
  "Period Start",
  "Period End",
  "Run Status",
  "Prepared By",
  "Approved By",
  "Preparation Date",
  "Approval Date",
  "Opening Balance",
  "Total Deposits",
  "Total Withdrawals",
  "Bank Closing Balance",
  "Ledger Closing Balance",
  "Variance",
  "Matched Amount",
  "Unmatched Bank Amount",
  "Unmatched Ledger Amount",
  "Exception Amount",
  "Outstanding Exceptions",
  "Outstanding Transactions",
  "Adjustment Count",
  "Approval Summary",
] as const;

/**
 * The single structured source of truth for the financial reconciliation
 * report ("RECONCILIATION_SUMMARY"): one entry per reconciliation run
 * overlapping the report period. Every consumer of this report -- the flat
 * CSV table below, and the render/reconciliation-summary.ts presentation
 * model used by the PDF/XLSX exporters -- is a pure formatting function over
 * this same array. No figure here is computed twice in two different
 * places: changing a financial calculation means editing this function, not
 * any of its consumers.
 */
export type ReconciliationSummaryRow = {
  reconciliationRunId: string;
  organizationName: string;
  bankAccountId: string;
  bankAccountName: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  preparedByUserId: string;
  preparedByName: string;
  approvedByUserId: string | null;
  approvedByName: string | null;
  preparationDate: Date;
  approvalDate: Date | null;
  currency: string;
  openingBalance: Prisma.Decimal;
  totalDeposits: Prisma.Decimal;
  totalWithdrawals: Prisma.Decimal;
  bankClosingBalance: Prisma.Decimal;
  ledgerClosingBalance: Prisma.Decimal;
  variance: Prisma.Decimal;
  matchedAmount: Prisma.Decimal;
  unmatchedBankAmount: Prisma.Decimal;
  unmatchedLedgerAmount: Prisma.Decimal;
  exceptionAmount: Prisma.Decimal;
  outstandingExceptions: number;
  outstandingTransactions: number;
  adjustmentCount: number;
  approvalSummary: string;
};

function buildApprovalSummary(
  run: RunListRecord,
  hasOutstandingItems: boolean,
  approvalAudit: ApprovalAuditLogRecord | undefined,
) {
  if (run.status === "APPROVED" || run.status === "REOPENED") {
    const metadata = approvalAudit?.metadata as
      | { approvalReason?: string | null; overrodeOutstandingItems?: boolean }
      | null
      | undefined;

    if (metadata?.overrodeOutstandingItems) {
      return `Approved with outstanding items overridden: ${metadata.approvalReason ?? "no reason recorded"}`;
    }

    return "Approved clean, no outstanding items at approval time.";
  }

  return hasOutstandingItems
    ? "Not yet approved: outstanding items pending."
    : "Not yet approved: no outstanding items, ready for approval.";
}

/**
 * Computes one ReconciliationSummaryRow per reconciliation run overlapping
 * the report period, using calculateReconciliationTieOut (bank/ledger
 * totals, matched/unmatched/exception amounts, variance) and
 * evaluateApprovalReadiness (outstanding counts, approval readiness) for
 * every figure those services already compute -- this function adds only
 * what neither of them does: total deposits/withdrawals, adjustment counts,
 * and user/bank-account/audit-log lookups for display.
 *
 * "Opening balance" is always 0: this system reconciles transaction activity
 * within a period rather than tracking an absolute running account balance
 * (no balance field exists anywhere in the schema), so "closing balance" is
 * reported as the period's net movement -- which is exactly
 * calculateReconciliationTieOut's bank/ledger transaction total, since
 * amount = creditAmount - debitAmount for every transaction (see
 * lib/imports/csv-core.ts and lib/transactions/adjustment.ts). Total
 * deposits/withdrawals are the only genuinely new aggregate here (tie-out
 * only sums the net `amount`, never separates credit from debit).
 */
export async function computeReconciliationSummaryRows(
  input: GenerateReportInput,
  context: GenerateReportContext,
  database: ReportGenerationDatabase,
): Promise<ReconciliationSummaryRow[]> {
  const runs = await database.reconciliationRun.findMany({
    where: {
      organizationId: context.organizationId,
      periodStart: { lte: input.periodEnd },
      periodEnd: { gte: input.periodStart },
    },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      bankAccountId: true,
      createdBy: true,
      createdAt: true,
      approvedBy: true,
      approvedAt: true,
      organization: { select: { name: true } },
    },
    orderBy: { periodStart: "asc" },
  });

  if (runs.length === 0) {
    return [];
  }

  const bankAccountIds = [...new Set(runs.map((run) => run.bankAccountId))];
  const userIds = [
    ...new Set(runs.flatMap((run) => [run.createdBy, run.approvedBy].filter((id): id is string => Boolean(id)))),
  ];
  const runIds = runs.map((run) => run.id);

  const [bankAccounts, users, approvalAuditLogs] = await Promise.all([
    database.bankAccount.findMany({ where: { id: { in: bankAccountIds } }, select: { id: true, name: true } }),
    userIds.length
      ? database.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
      : Promise.resolve([]),
    database.auditLog.findMany({
      where: {
        organizationId: context.organizationId,
        resourceType: "reconciliationRun",
        action: "RECONCILIATION_RUN_APPROVED",
        resourceId: { in: runIds },
      },
      select: { resourceId: true, metadata: true },
    }),
  ]);

  const bankAccountNamesById = new Map(bankAccounts.map((account) => [account.id, account.name]));
  const userNamesById = new Map(users.map((user) => [user.id, user.fullName]));
  const approvalAuditByRunId = new Map(approvalAuditLogs.map((entry) => [entry.resourceId, entry]));

  return Promise.all(
    runs.map(async (run) => {
      const [tieOut, readiness, depositsWithdrawals, bankAdjustmentCount, ledgerAdjustmentCount] = await Promise.all([
        calculateReconciliationTieOut({ reconciliationRunId: run.id }, context, database),
        evaluateApprovalReadiness({ reconciliationRunId: run.id }, context, database),
        database.transaction.aggregate({
          where: {
            organizationId: context.organizationId,
            bankAccountId: run.bankAccountId,
            sourceType: "BANK",
            transactionDate: { gte: run.periodStart, lte: run.periodEnd },
          },
          _sum: { creditAmount: true, debitAmount: true },
        }),
        database.transactionAdjustment.count({
          where: {
            transaction: {
              organizationId: context.organizationId,
              bankAccountId: run.bankAccountId,
              sourceType: "BANK",
              transactionDate: { gte: run.periodStart, lte: run.periodEnd },
            },
          },
        }),
        database.transactionAdjustment.count({
          where: {
            transaction: {
              organizationId: context.organizationId,
              sourceType: "LEDGER",
              transactionDate: { gte: run.periodStart, lte: run.periodEnd },
            },
          },
        }),
      ]);

      const approvalAudit = approvalAuditByRunId.get(run.id);

      const row: ReconciliationSummaryRow = {
        reconciliationRunId: run.id,
        organizationName: run.organization.name,
        bankAccountId: run.bankAccountId,
        bankAccountName: bankAccountNamesById.get(run.bankAccountId) ?? run.bankAccountId,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        status: run.status,
        preparedByUserId: run.createdBy,
        preparedByName: userNamesById.get(run.createdBy) ?? run.createdBy,
        approvedByUserId: run.approvedBy,
        approvedByName: run.approvedBy ? (userNamesById.get(run.approvedBy) ?? run.approvedBy) : null,
        preparationDate: run.createdAt,
        approvalDate: run.approvedAt,
        currency: tieOut.currency,
        openingBalance: new Prisma.Decimal(0),
        totalDeposits: toDecimal(depositsWithdrawals._sum.creditAmount),
        totalWithdrawals: toDecimal(depositsWithdrawals._sum.debitAmount),
        bankClosingBalance: tieOut.bankTransactionTotal,
        ledgerClosingBalance: tieOut.ledgerTransactionTotal,
        variance: tieOut.variance,
        matchedAmount: tieOut.matchedAmount,
        unmatchedBankAmount: tieOut.unmatchedBankAmount,
        unmatchedLedgerAmount: tieOut.unmatchedLedgerAmount,
        exceptionAmount: tieOut.exceptionAmount,
        outstandingExceptions: readiness.exceptionCount,
        outstandingTransactions: readiness.unmatchedBankCount + readiness.unmatchedLedgerCount,
        adjustmentCount: bankAdjustmentCount + ledgerAdjustmentCount,
        approvalSummary: buildApprovalSummary(run, readiness.hasOutstandingItems, approvalAudit),
      };

      return row;
    }),
  );
}

export function reconciliationSummaryRowToStrings(row: ReconciliationSummaryRow): string[] {
  return [
    row.organizationName,
    row.bankAccountName,
    formatDateOnly(row.periodStart),
    formatDateOnly(row.periodEnd),
    row.status,
    row.preparedByName,
    row.approvedByName ?? "",
    row.preparationDate.toISOString(),
    row.approvalDate ? row.approvalDate.toISOString() : "",
    row.openingBalance.toFixed(2),
    row.totalDeposits.toFixed(2),
    row.totalWithdrawals.toFixed(2),
    row.bankClosingBalance.toFixed(2),
    row.ledgerClosingBalance.toFixed(2),
    row.variance.toFixed(2),
    row.matchedAmount.toFixed(2),
    row.unmatchedBankAmount.toFixed(2),
    row.unmatchedLedgerAmount.toFixed(2),
    row.exceptionAmount.toFixed(2),
    String(row.outstandingExceptions),
    String(row.outstandingTransactions),
    String(row.adjustmentCount),
    row.approvalSummary,
  ];
}

async function buildFinancialReconciliationReportTable(
  input: GenerateReportInput,
  context: GenerateReportContext,
  database: ReportGenerationDatabase,
): Promise<ReportTable> {
  const rows = await computeReconciliationSummaryRows(input, context, database);
  return { headers: financialReportHeaders, rows: rows.map(reconciliationSummaryRowToStrings) };
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
      return buildFinancialReconciliationReportTable(input, context, database);
    case ReportType.EXCEPTION_LIST:
      return buildExceptionListTable(input, context, database);
    case ReportType.UNMATCHED_TRANSACTIONS:
      return buildUnmatchedTransactionsTable(input, context, database);
    default:
      throw new ReportGenerationError("A valid report type is required.", "VALIDATION");
  }
}
