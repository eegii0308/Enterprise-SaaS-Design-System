import test from "node:test";
import assert from "node:assert/strict";
import { SourceType, TransactionStatus } from "@prisma/client";
import { buildReconciliationTransactionQuery } from "../lib/reconciliation/transaction-query.ts";

const runPeriodStart = new Date("2026-06-01T00:00:00.000");
const runPeriodEnd = new Date("2026-06-30T23:59:59.999");
const run = { bankAccountId: "account-1", periodStart: runPeriodStart, periodEnd: runPeriodEnd };

test("default reconciliation query shows only unmatched transactions scoped to the run's bank account and period", () => {
  const query = buildReconciliationTransactionQuery({}, "org-1", run);

  assert.equal(query.bankWhere.organizationId, "org-1");
  assert.equal(query.bankWhere.status, TransactionStatus.UNMATCHED);
  assert.equal(query.bankWhere.sourceType, SourceType.BANK);
  assert.equal(query.bankWhere.bankAccountId, "account-1");
  assert.deepEqual(query.bankWhere.transactionDate, { gte: runPeriodStart, lte: runPeriodEnd });
  assert.equal(query.ledgerWhere.organizationId, "org-1");
  assert.equal(query.ledgerWhere.status, TransactionStatus.UNMATCHED);
  assert.equal(query.ledgerWhere.sourceType, SourceType.LEDGER);
  assert.equal(query.ledgerWhere.bankAccountId, undefined);
  assert.deepEqual(query.ledgerWhere.transactionDate, { gte: runPeriodStart, lte: runPeriodEnd });
  assert.equal(query.shouldShowBank, true);
  assert.equal(query.shouldShowLedger, true);
});

test("reconciliation query ignores status=MATCHED", () => {
  const query = buildReconciliationTransactionQuery({ status: TransactionStatus.MATCHED }, "org-1", run);

  assert.equal(query.bankWhere.status, TransactionStatus.UNMATCHED);
  assert.equal(query.ledgerWhere.status, TransactionStatus.UNMATCHED);
});

test("reconciliation query keeps transactions scoped to the current organization", () => {
  const query = buildReconciliationTransactionQuery({ sourceType: SourceType.BANK }, "org-current", run);

  assert.equal(query.bankWhere.organizationId, "org-current");
  assert.equal(query.ledgerWhere.organizationId, "org-current");
  assert.equal(query.shouldShowBank, true);
  assert.equal(query.shouldShowLedger, false);
});

test("a user-supplied date range narrows the run period but cannot widen it", () => {
  const withinRange = buildReconciliationTransactionQuery(
    { dateFrom: "2026-06-10", dateTo: "2026-06-15" },
    "org-1",
    run,
  );
  assert.deepEqual(withinRange.bankWhere.transactionDate, {
    gte: new Date("2026-06-10T00:00:00.000"),
    lte: new Date("2026-06-15T23:59:59.999"),
  });

  const beyondRange = buildReconciliationTransactionQuery(
    { dateFrom: "2026-01-01", dateTo: "2026-12-31" },
    "org-1",
    run,
  );
  assert.deepEqual(beyondRange.bankWhere.transactionDate, { gte: runPeriodStart, lte: runPeriodEnd });
});
