import test from "node:test";
import assert from "node:assert/strict";
import { SourceType, TransactionStatus } from "@prisma/client";
import {
  evaluateApprovalReadiness,
  ApprovalValidationError,
  type ApprovalValidationDatabase,
} from "../lib/reconciliation/approval-validation.ts";

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
  transactionCountArgs: unknown[];
};

function createDatabase(overrides: {
  run?: typeof defaultRun | null;
  aggregateSums?: Record<string, string | number | null>;
  counts?: Record<string, number>;
  confirmedMatches?: { bankTransactionId: string }[];
  matchedAggregateSum?: string | number | null;
} = {}): ApprovalValidationDatabase & { calls: CapturedCalls } {
  const calls: CapturedCalls = { transactionCountArgs: [] };
  const run = overrides.run === undefined ? defaultRun : overrides.run;
  const aggregateSums = overrides.aggregateSums ?? {};
  const counts = overrides.counts ?? {};
  const confirmedMatches = overrides.confirmedMatches ?? [];

  return {
    calls,
    reconciliationRun: {
      async findUnique() {
        return run as never;
      },
    },
    transaction: {
      async aggregate(args) {
        const where = (args as { where: Record<string, unknown> }).where;

        if (where.id) {
          return { _sum: { amount: overrides.matchedAggregateSum ?? null } } as never;
        }

        const isBank = where.sourceType === SourceType.BANK;
        const status = where.status as TransactionStatus | undefined;
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
      async count(args) {
        calls.transactionCountArgs.push(args);
        const where = (args as { where: Record<string, unknown> }).where;
        const isBank = where.sourceType === SourceType.BANK;
        const status = where.status as TransactionStatus | undefined;
        const key = `${status === TransactionStatus.EXCEPTION ? "exception" : "unmatched"}${isBank ? "Bank" : "Ledger"}`;
        return counts[key] ?? 0;
      },
    },
    reconciliationMatch: {
      async findMany() {
        return confirmedMatches as never;
      },
    },
  };
}

test("evaluateApprovalReadiness rejects a missing reconciliationRunId", async () => {
  const db = createDatabase();

  await assert.rejects(
    evaluateApprovalReadiness({ reconciliationRunId: "" }, context, db),
    (error) => error instanceof ApprovalValidationError && error.code === "VALIDATION",
  );
});

test("evaluateApprovalReadiness rejects an unknown run", async () => {
  const db = createDatabase({ run: null });

  await assert.rejects(
    evaluateApprovalReadiness({ reconciliationRunId: "run-404" }, context, db),
    (error) => error instanceof ApprovalValidationError && error.code === "VALIDATION",
  );
});

test("evaluateApprovalReadiness rejects a run from another organization", async () => {
  const db = createDatabase({ run: { ...defaultRun, organizationId: "org-2" } });

  await assert.rejects(
    evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db),
    (error) => error instanceof ApprovalValidationError && error.code === "FORBIDDEN",
  );
});

test("evaluateApprovalReadiness reports no outstanding items for a fully clean run", async () => {
  const db = createDatabase({ aggregateSums: { bankTotal: "1000.00", ledgerTotal: "1000.00" } });

  const readiness = await evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(readiness.reconciliationRunId, "run-1");
  assert.equal(readiness.bankAccountId, "account-1");
  assert.equal(readiness.currency, "MNT");
  assert.equal(readiness.variance.toString(), "0");
  assert.equal(readiness.unmatchedBankCount, 0);
  assert.equal(readiness.unmatchedLedgerCount, 0);
  assert.equal(readiness.exceptionCount, 0);
  assert.equal(readiness.hasOutstandingItems, false);
  assert.ok(readiness.evaluatedAt instanceof Date);
});

test("evaluateApprovalReadiness flags outstanding items when bank and ledger totals differ (variance)", async () => {
  const db = createDatabase({ aggregateSums: { bankTotal: "1000.00", ledgerTotal: "950.00" } });

  const readiness = await evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(readiness.variance.toString(), "50");
  assert.equal(readiness.hasOutstandingItems, true);
});

test("evaluateApprovalReadiness flags outstanding items for unmatched bank transactions", async () => {
  const db = createDatabase({ counts: { unmatchedBank: 3 } });

  const readiness = await evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(readiness.unmatchedBankCount, 3);
  assert.equal(readiness.hasOutstandingItems, true);
});

test("evaluateApprovalReadiness flags outstanding items for unmatched ledger transactions", async () => {
  const db = createDatabase({ counts: { unmatchedLedger: 1 } });

  const readiness = await evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(readiness.unmatchedLedgerCount, 1);
  assert.equal(readiness.hasOutstandingItems, true);
});

test("evaluateApprovalReadiness flags outstanding items for open exceptions and sums bank+ledger exception counts", async () => {
  const db = createDatabase({ counts: { exceptionBank: 2, exceptionLedger: 1 } });

  const readiness = await evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(readiness.exceptionCount, 3);
  assert.equal(readiness.hasOutstandingItems, true);
});

test("evaluateApprovalReadiness flags outstanding items by count even when the unmatched amount nets to zero", async () => {
  // Two offsetting unmatched bank transactions (+100 / -100) sum to zero,
  // which would look clean by amount alone; the count must still catch it.
  const db = createDatabase({ aggregateSums: { unmatchedBank: "0.00" }, counts: { unmatchedBank: 2 } });

  const readiness = await evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(readiness.unmatchedBankAmount.toString(), "0");
  assert.equal(readiness.unmatchedBankCount, 2);
  assert.equal(readiness.hasOutstandingItems, true);
});

test("evaluateApprovalReadiness scopes bank-side count queries by bank account, and ledger-side queries by org and period only", async () => {
  const db = createDatabase();

  await evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db);

  const bankUnmatchedArgs = db.calls.transactionCountArgs.find(
    (args) => (args as { where: Record<string, unknown> }).where.sourceType === SourceType.BANK &&
      (args as { where: Record<string, unknown> }).where.status === TransactionStatus.UNMATCHED,
  ) as { where: Record<string, unknown> };
  assert.equal(bankUnmatchedArgs.where.organizationId, "org-1");
  assert.equal(bankUnmatchedArgs.where.bankAccountId, "account-1");
  assert.deepEqual(bankUnmatchedArgs.where.transactionDate, { gte: periodStart, lte: periodEnd });

  const ledgerUnmatchedArgs = db.calls.transactionCountArgs.find(
    (args) => (args as { where: Record<string, unknown> }).where.sourceType === SourceType.LEDGER &&
      (args as { where: Record<string, unknown> }).where.status === TransactionStatus.UNMATCHED,
  ) as { where: Record<string, unknown> };
  assert.equal(ledgerUnmatchedArgs.where.bankAccountId, undefined);
  assert.deepEqual(ledgerUnmatchedArgs.where.transactionDate, { gte: periodStart, lte: periodEnd });
});

test("evaluateApprovalReadiness combines multiple simultaneous outstanding categories in one snapshot", async () => {
  const db = createDatabase({
    aggregateSums: { bankTotal: "1000.00", ledgerTotal: "900.00", unmatchedBank: "40.00", unmatchedLedger: "60.00" },
    counts: { unmatchedBank: 1, unmatchedLedger: 2, exceptionBank: 1, exceptionLedger: 0 },
  });

  const readiness = await evaluateApprovalReadiness({ reconciliationRunId: "run-1" }, context, db);

  assert.equal(readiness.variance.toString(), "100");
  assert.equal(readiness.unmatchedBankCount, 1);
  assert.equal(readiness.unmatchedBankAmount.toString(), "40");
  assert.equal(readiness.unmatchedLedgerCount, 2);
  assert.equal(readiness.unmatchedLedgerAmount.toString(), "60");
  assert.equal(readiness.exceptionCount, 1);
  assert.equal(readiness.hasOutstandingItems, true);
});
