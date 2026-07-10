import { SourceType, TransactionStatus, type Prisma } from "@prisma/client";
import { prisma } from "../db/client.ts";
import {
  calculateReconciliationTieOut,
  TieOutSummaryError,
  type TieOutSummaryDatabase,
  type ReconciliationTieOutSummary,
} from "./tie-out-summary.ts";

export type ApprovalValidationErrorCode = "VALIDATION" | "FORBIDDEN";

export class ApprovalValidationError extends Error {
  readonly code: ApprovalValidationErrorCode;

  constructor(message: string, code: ApprovalValidationErrorCode) {
    super(message);
    this.name = "ApprovalValidationError";
    this.code = code;
  }
}

type ApprovalValidationContext = {
  organizationId: string;
};

export type EvaluateApprovalReadinessInput = {
  reconciliationRunId: string;
};

// Extends TieOutSummaryDatabase (rather than redeclaring reconciliationRun/
// reconciliationMatch/transaction.aggregate) so any object that already
// satisfies calculateReconciliationTieOut's database contract only needs to
// add transaction.count to also satisfy this one.
export type ApprovalValidationDatabase = TieOutSummaryDatabase & {
  transaction: TieOutSummaryDatabase["transaction"] & {
    count(args: unknown): Promise<number>;
  };
};

export type ApprovalReadiness = {
  reconciliationRunId: string;
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  variance: Prisma.Decimal;
  unmatchedBankCount: number;
  unmatchedBankAmount: Prisma.Decimal;
  unmatchedLedgerCount: number;
  unmatchedLedgerAmount: Prisma.Decimal;
  exceptionCount: number;
  exceptionAmount: Prisma.Decimal;
  hasOutstandingItems: boolean;
  evaluatedAt: Date;
};

/**
 * Evaluates whether a reconciliation run is clean to approve: zero financial
 * variance, no unmatched bank transactions, no unmatched ledger
 * transactions, and no open exceptions. Reuses calculateReconciliationTieOut
 * for the run lookup, access check, and amount/variance figures (bank total,
 * ledger total, variance, unmatched/exception amounts) rather than
 * duplicating that arithmetic, and adds the count-based checks the tie-out
 * summary doesn't need for display: two unmatched transactions that happen
 * to net to a zero amount would otherwise look "clean" by amount alone, so
 * counts are checked independently of amounts.
 *
 * This is a read-only evaluation; approveReconciliationRun (run-lifecycle.ts)
 * is what actually enforces the outcome (requiring an approval reason when
 * hasOutstandingItems is true) as part of its own atomic transition.
 */
export async function evaluateApprovalReadiness(
  input: EvaluateApprovalReadinessInput,
  context: ApprovalValidationContext,
  database: ApprovalValidationDatabase = prisma as unknown as ApprovalValidationDatabase,
): Promise<ApprovalReadiness> {
  let tieOut: ReconciliationTieOutSummary;
  try {
    tieOut = await calculateReconciliationTieOut(input, context, database);
  } catch (error) {
    if (error instanceof TieOutSummaryError) {
      throw new ApprovalValidationError(error.message, error.code);
    }
    throw error;
  }

  const period = { transactionDate: { gte: tieOut.periodStart, lte: tieOut.periodEnd } };
  const bankWhere = { organizationId: context.organizationId, bankAccountId: tieOut.bankAccountId, sourceType: SourceType.BANK, ...period };
  const ledgerWhere = { organizationId: context.organizationId, sourceType: SourceType.LEDGER, ...period };

  const [unmatchedBankCount, unmatchedLedgerCount, exceptionBankCount, exceptionLedgerCount] = await Promise.all([
    database.transaction.count({ where: { ...bankWhere, status: TransactionStatus.UNMATCHED } }),
    database.transaction.count({ where: { ...ledgerWhere, status: TransactionStatus.UNMATCHED } }),
    database.transaction.count({ where: { ...bankWhere, status: TransactionStatus.EXCEPTION } }),
    database.transaction.count({ where: { ...ledgerWhere, status: TransactionStatus.EXCEPTION } }),
  ]);

  const exceptionCount = exceptionBankCount + exceptionLedgerCount;
  const hasOutstandingItems =
    !tieOut.variance.isZero() || unmatchedBankCount > 0 || unmatchedLedgerCount > 0 || exceptionCount > 0;

  return {
    reconciliationRunId: tieOut.reconciliationRunId,
    bankAccountId: tieOut.bankAccountId,
    periodStart: tieOut.periodStart,
    periodEnd: tieOut.periodEnd,
    currency: tieOut.currency,
    variance: tieOut.variance,
    unmatchedBankCount,
    unmatchedBankAmount: tieOut.unmatchedBankAmount,
    unmatchedLedgerCount,
    unmatchedLedgerAmount: tieOut.unmatchedLedgerAmount,
    exceptionCount,
    exceptionAmount: tieOut.exceptionAmount,
    hasOutstandingItems,
    evaluatedAt: new Date(),
  };
}
