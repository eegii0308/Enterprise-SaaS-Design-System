import { Prisma, ReconciliationMatchStatus, SourceType, TransactionStatus, type ReconciliationRun } from "@prisma/client";
import { prisma } from "../db/client.ts";

export type TieOutSummaryErrorCode = "VALIDATION" | "FORBIDDEN";

export class TieOutSummaryError extends Error {
  readonly code: TieOutSummaryErrorCode;

  constructor(message: string, code: TieOutSummaryErrorCode) {
    super(message);
    this.name = "TieOutSummaryError";
    this.code = code;
  }
}

type SummaryContext = {
  organizationId: string;
};

export type CalculateTieOutSummaryInput = {
  reconciliationRunId: string;
};

type RunRecord = Pick<ReconciliationRun, "id" | "organizationId" | "bankAccountId" | "periodStart" | "periodEnd"> & {
  organization: { defaultCurrency: string };
};

type DecimalLike = Prisma.Decimal | number | string;

type AmountAggregateResult = { _sum: { amount: DecimalLike | null } };

type MatchBankLegRecord = { bankTransactionId: string };

export type TieOutSummaryDatabase = {
  reconciliationRun: {
    findUnique(args: unknown): Promise<RunRecord | null>;
  };
  transaction: {
    aggregate(args: unknown): Promise<AmountAggregateResult>;
  };
  reconciliationMatch: {
    findMany(args: unknown): Promise<MatchBankLegRecord[]>;
  };
};

export type ReconciliationTieOutSummary = {
  reconciliationRunId: string;
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  bankTransactionTotal: Prisma.Decimal;
  ledgerTransactionTotal: Prisma.Decimal;
  matchedAmount: Prisma.Decimal;
  unmatchedBankAmount: Prisma.Decimal;
  unmatchedLedgerAmount: Prisma.Decimal;
  exceptionAmount: Prisma.Decimal;
  variance: Prisma.Decimal;
};

function validateInput(input: CalculateTieOutSummaryInput) {
  if (!input.reconciliationRunId) {
    throw new TieOutSummaryError("reconciliationRunId is required.", "VALIDATION");
  }
}

function assertRunAccess(
  run: RunRecord | null,
  reconciliationRunId: string,
  organizationId: string,
): asserts run is RunRecord {
  if (!run) {
    throw new TieOutSummaryError(`Reconciliation run ${reconciliationRunId} was not found.`, "VALIDATION");
  }

  if (run.organizationId !== organizationId) {
    throw new TieOutSummaryError("Reconciliation run does not belong to the current organization.", "FORBIDDEN");
  }
}

function toDecimal(value: DecimalLike | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

async function sumAmount(
  database: TieOutSummaryDatabase,
  where: Record<string, unknown>,
): Promise<Prisma.Decimal> {
  const result = await database.transaction.aggregate({ where, _sum: { amount: true } });
  return toDecimal(result._sum.amount);
}

/**
 * Computes the financial tie-out for a reconciliation run: bank and ledger
 * totals, the matched/unmatched/exception breakdown, and the variance
 * between the bank and ledger totals. All arithmetic uses Prisma.Decimal
 * (backed by decimal.js), never JS floats, to match the DECIMAL(18,2)
 * precision of the underlying columns.
 *
 * Every run now has exactly one bank account (Phase 7B), so the bank leg of
 * the tie-out (bank total, unmatched bank, exception bank) is always scoped
 * to run.bankAccountId. The ledger leg is not tied to a bank account and is
 * scoped by organization + the run's period only. Both legs are additionally
 * scoped to transactions whose transactionDate falls within the run's
 * period, mirroring how lib/reports/generation.ts scopes unmatched and
 * exception transactions to a report period. Matched amount is scoped by
 * ReconciliationMatch's direct reconciliationRunId foreign key instead,
 * since that is the authoritative link between a match and its run. It is
 * reported from the bank leg of each confirmed match, consistent with
 * variance being bank-anchored (bank total - ledger total).
 */
export async function calculateReconciliationTieOut(
  input: CalculateTieOutSummaryInput,
  context: SummaryContext,
  database: TieOutSummaryDatabase = prisma as unknown as TieOutSummaryDatabase,
): Promise<ReconciliationTieOutSummary> {
  validateInput(input);

  const run = await database.reconciliationRun.findUnique({
    where: { id: input.reconciliationRunId },
    select: {
      id: true,
      organizationId: true,
      bankAccountId: true,
      periodStart: true,
      periodEnd: true,
      organization: { select: { defaultCurrency: true } },
    },
  });

  assertRunAccess(run, input.reconciliationRunId, context.organizationId);

  const period = { transactionDate: { gte: run.periodStart, lte: run.periodEnd } };
  const bankWhere = { organizationId: context.organizationId, bankAccountId: run.bankAccountId, sourceType: SourceType.BANK, ...period };
  const ledgerWhere = { organizationId: context.organizationId, sourceType: SourceType.LEDGER, ...period };

  const [
    bankTransactionTotal,
    ledgerTransactionTotal,
    unmatchedBankAmount,
    unmatchedLedgerAmount,
    exceptionBankAmount,
    exceptionLedgerAmount,
    confirmedMatches,
  ] = await Promise.all([
    sumAmount(database, bankWhere),
    sumAmount(database, ledgerWhere),
    sumAmount(database, { ...bankWhere, status: TransactionStatus.UNMATCHED }),
    sumAmount(database, { ...ledgerWhere, status: TransactionStatus.UNMATCHED }),
    sumAmount(database, { ...bankWhere, status: TransactionStatus.EXCEPTION }),
    sumAmount(database, { ...ledgerWhere, status: TransactionStatus.EXCEPTION }),
    database.reconciliationMatch.findMany({
      where: {
        organizationId: context.organizationId,
        reconciliationRunId: run.id,
        status: ReconciliationMatchStatus.CONFIRMED,
      },
      select: { bankTransactionId: true },
    }),
  ]);

  const matchedAmount = confirmedMatches.length
    ? await sumAmount(database, { id: { in: confirmedMatches.map((match) => match.bankTransactionId) }, bankAccountId: run.bankAccountId })
    : new Prisma.Decimal(0);

  return {
    reconciliationRunId: run.id,
    bankAccountId: run.bankAccountId,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    currency: run.organization.defaultCurrency,
    bankTransactionTotal,
    ledgerTransactionTotal,
    matchedAmount,
    unmatchedBankAmount,
    unmatchedLedgerAmount,
    exceptionAmount: exceptionBankAmount.plus(exceptionLedgerAmount),
    variance: bankTransactionTotal.minus(ledgerTransactionTotal),
  };
}
