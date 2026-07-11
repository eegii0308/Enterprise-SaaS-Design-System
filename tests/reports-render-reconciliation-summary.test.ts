import test from "node:test";
import assert from "node:assert/strict";
import { buildReconciliationSummaryPresentation } from "../lib/reports/render/reconciliation-summary.ts";
import { createFinancialDatabase, baseRun } from "./helpers/reports-mock-database.ts";

const context = { organizationId: "org-1" };
const periodStart = new Date("2026-06-01T00:00:00.000Z");
const periodEnd = new Date("2026-06-30T23:59:59.999Z");

// These tests verify the renderer *composes* computeReconciliationSummaryRows,
// generateReportTable(UNMATCHED_TRANSACTIONS/EXCEPTION_LIST), and the new
// adjustments listing into one presentation object -- not the underlying
// report calculations themselves, which are already covered by
// reports-generation-core.test.ts (per the "do not duplicate existing report
// calculation tests" instruction).

test("buildReconciliationSummaryPresentation composes rows, detail tables, and adjustments from a single call", async () => {
  const runs = [baseRun()];
  const transactions = [
    {
      id: "txn-1",
      sourceType: "BANK",
      transactionDate: new Date("2026-06-10T00:00:00.000Z"),
      description: "Unmatched deposit",
      vendor: null,
      reference: "REF-1",
      amount: { toFixed: (d: number) => (250).toFixed(d) },
      currency: "MNT",
      exceptionReason: "No ledger counterpart",
      exceptionMarkedBy: "user-1",
      exceptionMarkedAt: new Date("2026-06-11T00:00:00.000Z"),
    },
  ];
  const db = createFinancialDatabase({
    runs,
    transactions,
    bankAccounts: [{ id: "account-1", name: "Operating account" }],
    users: [{ id: "user-1", fullName: "Preparer One" }],
    adjustments: [
      {
        sourceType: "BANK" as never,
        id: "adj-1",
        transactionId: "txn-1",
        fieldName: "amount",
        oldValue: "100.00",
        newValue: "250.00",
        reason: "Corrected typo",
        createdBy: "user-1",
        createdAt: new Date("2026-06-12T00:00:00.000Z"),
      },
      {
        sourceType: "LEDGER" as never,
        id: "adj-2",
        transactionId: "txn-2",
        fieldName: "description",
        oldValue: "Old desc",
        newValue: "New desc",
        reason: "Clarified vendor",
        createdBy: "user-1",
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
      },
    ],
  });

  const presentation = await buildReconciliationSummaryPresentation({ periodStart, periodEnd }, context, db);

  assert.equal(presentation.rows.length, 1);
  assert.equal(presentation.rows[0]?.bankAccountName, "Operating account");
  assert.equal(presentation.rows[0]?.preparedByName, "Preparer One");

  assert.deepEqual(presentation.unmatchedTransactions.headers, [
    "Transaction ID",
    "Source",
    "Transaction Date",
    "Description",
    "Vendor",
    "Reference",
    "Amount",
    "Currency",
  ]);
  assert.equal(presentation.unmatchedTransactions.rows.length, 1);

  assert.deepEqual(presentation.exceptions.headers, [
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
  ]);
  assert.equal(presentation.exceptions.rows.length, 1);

  // Adjustments come back sorted chronologically regardless of bank/ledger origin.
  assert.equal(presentation.adjustments.length, 2);
  assert.equal(presentation.adjustments[0]?.id, "adj-2");
  assert.equal(presentation.adjustments[1]?.id, "adj-1");

  assert.equal(presentation.periodStart, periodStart);
  assert.equal(presentation.periodEnd, periodEnd);
  assert.ok(presentation.generatedAt instanceof Date);
});

test("buildReconciliationSummaryPresentation still returns detail tables when there are no reconciliation runs", async () => {
  const db = createFinancialDatabase({ runs: [], transactions: [] });

  const presentation = await buildReconciliationSummaryPresentation({ periodStart, periodEnd }, context, db);

  assert.deepEqual(presentation.rows, []);
  assert.deepEqual(presentation.unmatchedTransactions.rows, []);
  assert.deepEqual(presentation.exceptions.rows, []);
  assert.deepEqual(presentation.adjustments, []);
});
