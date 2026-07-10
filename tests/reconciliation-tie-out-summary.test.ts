import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationMatchStatus, SourceType, TransactionStatus } from "@prisma/client";
import {
  calculateReconciliationTieOut,
  TieOutSummaryError,
  type TieOutSummaryDatabase,
} from "../lib/reconciliation/tie-out-summary.ts";

const context = { organizationId: "org-1" };

const periodStart = new Date("2026-06-01T00:00:00.000Z");
const periodEnd = new Date("2026-06-30T23:59:59.999Z");

const defaultRun = {
  id: "run-1",
  organizationId: "org-1",
  bankAccountId: "account-1",
  periodStart,
  periodEnd,
  organization: { defaultCurrency: "MNT" },
};

type CapturedCalls = {
  runFindUniqueArgs: unknown[];
  transactionAggregateArgs: unknown[];
  matchFindManyArgs: unknown[];
};

function createDatabase(overrides: {
  run?: typeof defaultRun | null;
  aggregateSums?: Record<string, string | number | null>;
  confirmedMatches?: { bankTransactionId: string }[];
  matchedAggregateSum?: string | number | null;
}): TieOutSummaryDatabase & { calls: CapturedCalls } {
  const calls: CapturedCalls = {
    runFindUniqueArgs: [],
    transactionAggregateArgs: [],
    matchFindManyArgs: [],
  };

  const run = overrides.run === undefined ? defaultRun : overrides.run;
  const aggregateSums = overrides.aggregateSums ?? {};
  const confirmedMatches = overrides.confirmedMatches ?? [];

  return {
    calls,
    reconciliationRun: {
      async findUnique(args) {
        calls.runFindUniqueArgs.push(args);
        return run as never;
      },
    },
    transaction: {
      async aggregate(args) {
        calls.transactionAggregateArgs.push(args);

        const where = (args as { where: Record<string, unknown> }).where;

        // The matched-amount lookup is the only aggregate keyed by `id: { in: [...] }`.
        if (where.id) {
          return { _sum: { amount: overrides.matchedAggregateSum ?? null } } as never;
        }

        const sourceType = where.sourceType as SourceType | undefined;
        const status = where.status as TransactionStatus | undefined;
        const isBank = sourceType === SourceType.BANK;

        let key: string;
        if (status === TransactionStatus.UNMATCHED) {
          key = isBank ? "unmatchedBank" : "unmatchedLedger";
        } else if (status === TransactionStatus.EXCEPTION) {
          key = isBank ? "exceptionBank" : "exceptionLedger";
        } else {
          key = isBank ? "bankTotal" : "ledgerTotal";
        }

        return { _sum: { amount: aggregateSums[key] ?? null } } as never;
      },
    },
    reconciliationMatch: {
      async findMany(args) {
        calls.matchFindManyArgs.push(args);
        return confirmedMatches as never;
      },
    },
  };
}

test("calculateReconciliationTieOut rejects a missing reconciliationRunId", async () => {
  const db = createDatabase({});

  await assert.rejects(
    calculateReconciliationTieOut({ reconciliationRunId: "" }, context, db),
    (error) => error instanceof TieOutSummaryError && error.code === "VALIDATION",
  );
});

test("calculateReconciliationTieOut rejects an unknown run", async () => {
  const db = createDatabase({ run: null });

  await assert.rejects(
    calculateReconciliationTieOut({ reconciliationRunId: "run-404" }, context, db),
    (error) => error instanceof TieOutSummaryError && error.code === "VALIDATION",
  );
});

test("calculateReconciliationTieOut rejects a run from another organization", async () => {
  const db = createDatabase({ run: { ...defaultRun, organizationId: "org-2" } });

  await assert.rejects(
    calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, db),
    (error) => error instanceof TieOutSummaryError && error.code === "FORBIDDEN",
  );
});

test("calculateReconciliationTieOut scopes the bank total to the run's bank account, and the ledger total to the org and period only", async () => {
  const db = createDatabase({ aggregateSums: { bankTotal: "1000.00", ledgerTotal: "950.00" } });

  await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, db);

  const bankArgs = db.calls.transactionAggregateArgs[0] as { where: Record<string, unknown> };
  assert.equal(bankArgs.where.organizationId, "org-1");
  assert.equal(bankArgs.where.sourceType, SourceType.BANK);
  assert.equal(bankArgs.where.bankAccountId, "account-1");
  assert.deepEqual(bankArgs.where.transactionDate, { gte: periodStart, lte: periodEnd });

  const ledgerArgs = db.calls.transactionAggregateArgs[1] as { where: Record<string, unknown> };
  assert.equal(ledgerArgs.where.sourceType, SourceType.LEDGER);
  assert.equal(ledgerArgs.where.bankAccountId, undefined);
  assert.deepEqual(ledgerArgs.where.transactionDate, { gte: periodStart, lte: periodEnd });
});

test("calculateReconciliationTieOut computes bank total, ledger total, and variance with exact decimal arithmetic", async () => {
  // 0.3 - 0.1 is 0.19999999999999998 under IEEE-754 float subtraction;
  // Decimal arithmetic must produce exactly 0.20.
  const db = createDatabase({ aggregateSums: { bankTotal: "0.3", ledgerTotal: "0.1" } });

  const summary = await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(summary.bankTransactionTotal.toFixed(2), "0.30");
  assert.equal(summary.ledgerTransactionTotal.toFixed(2), "0.10");
  assert.equal(summary.variance.toFixed(2), "0.20");
});

test("calculateReconciliationTieOut reports a negative variance when the ledger total exceeds the bank total", async () => {
  const db = createDatabase({ aggregateSums: { bankTotal: "500.00", ledgerTotal: "525.50" } });

  const summary = await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(summary.variance.toFixed(2), "-25.50");
});

test("calculateReconciliationTieOut treats an empty aggregate sum as zero", async () => {
  const db = createDatabase({ aggregateSums: {} });

  const summary = await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(summary.bankTransactionTotal.toFixed(2), "0.00");
  assert.equal(summary.ledgerTransactionTotal.toFixed(2), "0.00");
  assert.equal(summary.unmatchedBankAmount.toFixed(2), "0.00");
  assert.equal(summary.unmatchedLedgerAmount.toFixed(2), "0.00");
  assert.equal(summary.exceptionAmount.toFixed(2), "0.00");
  assert.equal(summary.matchedAmount.toFixed(2), "0.00");
  assert.equal(summary.variance.toFixed(2), "0.00");
});

test("calculateReconciliationTieOut scopes unmatched amounts by status and source type, filtering the bank leg by bank account", async () => {
  const db = createDatabase({
    aggregateSums: { unmatchedBank: "120.00", unmatchedLedger: "45.00" },
  });

  const summary = await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(summary.unmatchedBankAmount.toFixed(2), "120.00");
  assert.equal(summary.unmatchedLedgerAmount.toFixed(2), "45.00");

  const unmatchedBankArgs = db.calls.transactionAggregateArgs.find(
    (args) => (args as { where: Record<string, unknown> }).where.sourceType === SourceType.BANK &&
      (args as { where: Record<string, unknown> }).where.status === TransactionStatus.UNMATCHED,
  ) as { where: Record<string, unknown> } | undefined;
  assert.ok(unmatchedBankArgs);
  assert.equal(unmatchedBankArgs.where.organizationId, "org-1");
  assert.equal(unmatchedBankArgs.where.bankAccountId, "account-1");

  const unmatchedLedgerArgs = db.calls.transactionAggregateArgs.find(
    (args) => (args as { where: Record<string, unknown> }).where.sourceType === SourceType.LEDGER &&
      (args as { where: Record<string, unknown> }).where.status === TransactionStatus.UNMATCHED,
  ) as { where: Record<string, unknown> } | undefined;
  assert.ok(unmatchedLedgerArgs);
  assert.equal(unmatchedLedgerArgs.where.bankAccountId, undefined);
});

test("calculateReconciliationTieOut sums the exception amount across both source types, filtering the bank leg by bank account", async () => {
  const db = createDatabase({ aggregateSums: { exceptionBank: "50.00", exceptionLedger: "27.25" } });

  const summary = await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(summary.exceptionAmount.toFixed(2), "77.25");

  const exceptionBankArgs = db.calls.transactionAggregateArgs.find(
    (args) => (args as { where: Record<string, unknown> }).where.sourceType === SourceType.BANK &&
      (args as { where: Record<string, unknown> }).where.status === TransactionStatus.EXCEPTION,
  ) as { where: Record<string, unknown> } | undefined;
  assert.ok(exceptionBankArgs);
  assert.equal(exceptionBankArgs.where.bankAccountId, "account-1");

  const exceptionLedgerArgs = db.calls.transactionAggregateArgs.find(
    (args) => (args as { where: Record<string, unknown> }).where.sourceType === SourceType.LEDGER &&
      (args as { where: Record<string, unknown> }).where.status === TransactionStatus.EXCEPTION,
  ) as { where: Record<string, unknown> } | undefined;
  assert.ok(exceptionLedgerArgs);
  assert.equal(exceptionLedgerArgs.where.bankAccountId, undefined);
});

test("calculateReconciliationTieOut sums the bank leg of confirmed matches scoped to the run, and skips the lookup when there are none", async () => {
  const dbWithMatches = createDatabase({
    confirmedMatches: [{ bankTransactionId: "bank-1" }, { bankTransactionId: "bank-2" }],
    matchedAggregateSum: "300.00",
  });

  const summary = await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, dbWithMatches);

  assert.equal(summary.matchedAmount.toFixed(2), "300.00");
  const matchArgs = dbWithMatches.calls.matchFindManyArgs[0] as { where: Record<string, unknown> };
  assert.equal(matchArgs.where.organizationId, "org-1");
  assert.equal(matchArgs.where.reconciliationRunId, "run-1");
  assert.equal(matchArgs.where.status, ReconciliationMatchStatus.CONFIRMED);

  const matchedAmountArgs = dbWithMatches.calls.transactionAggregateArgs.find(
    (args) => (args as { where: Record<string, unknown> }).where.id !== undefined,
  ) as { where: Record<string, unknown> } | undefined;
  assert.ok(matchedAmountArgs);
  assert.equal(matchedAmountArgs.where.bankAccountId, "account-1");

  const dbWithoutMatches = createDatabase({ confirmedMatches: [] });
  const emptySummary = await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, dbWithoutMatches);
  assert.equal(emptySummary.matchedAmount.toFixed(2), "0.00");
  // Only the 6 unconditional aggregates (bank/ledger totals, unmatched x2,
  // exception x2) ran; the matched-amount aggregate was skipped because
  // there were no confirmed matches.
  assert.equal(dbWithoutMatches.calls.transactionAggregateArgs.length, 6);
});

test("calculateReconciliationTieOut returns the run's id, bank account, period, and organization's default currency", async () => {
  const db = createDatabase({});

  const summary = await calculateReconciliationTieOut({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(summary.reconciliationRunId, "run-1");
  assert.equal(summary.bankAccountId, "account-1");
  assert.equal(summary.periodStart, periodStart);
  assert.equal(summary.periodEnd, periodEnd);
  assert.equal(summary.currency, "MNT");
});
