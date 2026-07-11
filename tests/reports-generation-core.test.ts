import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationRunStatus, ReportType, SourceType, TransactionStatus } from "@prisma/client";
import { generateReportTable, ReportGenerationError } from "../lib/reports/generation.ts";
import { createFinancialDatabase, baseRun as sharedBaseRun } from "./helpers/reports-mock-database.ts";

const context = { organizationId: "org-1" };

function decimal(value: number) {
  return { toFixed: (digits: number) => value.toFixed(digits) };
}

const periodStart = new Date("2026-06-01T00:00:00.000Z");
const periodEnd = new Date("2026-06-30T23:59:59.999Z");

// Local wrapper so existing calls to baseRun() below need no changes; the
// shared helper's default status is a plain "DRAFT" string, equivalent at
// runtime to the ReconciliationRunStatus.DRAFT enum member used here.
function baseRun(overrides: Parameters<typeof sharedBaseRun>[0] = {}) {
  return sharedBaseRun({ status: ReconciliationRunStatus.DRAFT, ...overrides });
}

// ---- RECONCILIATION_SUMMARY (financial reconciliation report) ----

test("generateReportTable (RECONCILIATION_SUMMARY) scopes the run query to the organization and period", async () => {
  const db = createFinancialDatabase({ runs: [] });

  await generateReportTable({ reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd }, context, db);

  assert.equal(db.calls.reconciliationRunFindManyArgs.length, 1);
  const args = db.calls.reconciliationRunFindManyArgs[0] as { where: Record<string, unknown> };
  assert.equal(args.where.organizationId, "org-1");
  assert.deepEqual(args.where.periodStart, { lte: periodEnd });
  assert.deepEqual(args.where.periodEnd, { gte: periodStart });
});

test("generateReportTable (RECONCILIATION_SUMMARY) returns the financial report headers and no rows, skipping lookups, when there are no runs", async () => {
  const db = createFinancialDatabase({ runs: [] });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.deepEqual(table.headers, [
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
  ]);
  assert.deepEqual(table.rows, []);
  assert.equal(db.calls.bankAccountFindManyArgs.length, 0);
  assert.equal(db.calls.userFindManyArgs.length, 0);
  assert.equal(db.calls.auditLogFindManyArgs.length, 0);
});

test("generateReportTable (RECONCILIATION_SUMMARY) assembles a full financial row for a single run", async () => {
  const runs = [baseRun()];
  const db = createFinancialDatabase({
    runs,
    aggregateSums: { bankTotal: 1000, ledgerTotal: 950, unmatchedBank: 50, unmatchedLedger: 0, exceptionBank: 20, exceptionLedger: 5 },
    depositsWithdrawals: { credit: 1200, debit: 200 },
    confirmedMatches: [{ bankTransactionId: "txn-1" }],
    matchedAggregateSum: 930,
    counts: { unmatchedBank: 1, unmatchedLedger: 0, exceptionBank: 1, exceptionLedger: 1 },
    adjustmentCounts: { bank: 2, ledger: 1 },
    bankAccounts: [{ id: "account-1", name: "Operating account" }],
    users: [{ id: "user-1", fullName: "Preparer One" }],
  });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.equal(table.rows.length, 1);
  assert.deepEqual(table.rows[0], [
    "Acme Reconciliation",
    "Operating account",
    "2026-06-01",
    "2026-06-30",
    "DRAFT",
    "Preparer One",
    "",
    "2026-06-01T08:00:00.000Z",
    "",
    "0.00",
    "1200.00",
    "200.00",
    "1000.00",
    "950.00",
    "50.00",
    "930.00",
    "50.00",
    "0.00",
    "25.00",
    "2",
    "1",
    "3",
    "Not yet approved: outstanding items pending.",
  ]);
});

test("generateReportTable (RECONCILIATION_SUMMARY) falls back to the raw ID when a bank account or user lookup is missing", async () => {
  const runs = [baseRun({ createdBy: "ghost-user" })];
  const db = createFinancialDatabase({ runs, bankAccounts: [], users: [] });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.equal(table.rows[0]?.[1], "account-1");
  assert.equal(table.rows[0]?.[5], "ghost-user");
});

test("generateReportTable (RECONCILIATION_SUMMARY) reports a clean approval summary with no outstanding items", async () => {
  const runs = [baseRun()];
  const db = createFinancialDatabase({ runs });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.equal(table.rows[0]?.at(-1), "Not yet approved: no outstanding items, ready for approval.");
});

test("generateReportTable (RECONCILIATION_SUMMARY) reports a clean approval for an APPROVED run with no override", async () => {
  const runs = [
    baseRun({
      status: ReconciliationRunStatus.APPROVED,
      approvedBy: "user-2",
      approvedAt: new Date("2026-06-05T00:00:00.000Z"),
    }),
  ];
  const db = createFinancialDatabase({
    runs,
    users: [{ id: "user-1", fullName: "Preparer One" }, { id: "user-2", fullName: "Approver Two" }],
    approvalAuditLogs: [{ resourceId: "run-1", metadata: { approvalReason: null, overrodeOutstandingItems: false } }],
  });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.equal(table.rows[0]?.[6], "Approver Two");
  assert.equal(table.rows[0]?.at(-1), "Approved clean, no outstanding items at approval time.");
});

test("generateReportTable (RECONCILIATION_SUMMARY) reports the override reason for an approval with outstanding items", async () => {
  const runs = [baseRun({ status: ReconciliationRunStatus.APPROVED, approvedBy: "user-2", approvedAt: new Date() })];
  const db = createFinancialDatabase({
    runs,
    approvalAuditLogs: [
      { resourceId: "run-1", metadata: { approvalReason: "Known timing difference, cleared next period", overrodeOutstandingItems: true } },
    ],
  });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.equal(
    table.rows[0]?.at(-1),
    "Approved with outstanding items overridden: Known timing difference, cleared next period",
  );
});

test("generateReportTable (RECONCILIATION_SUMMARY) computes tie-out and approval readiness independently per run", async () => {
  const runA = baseRun({ id: "run-a", bankAccountId: "account-a" });
  const runB = baseRun({ id: "run-b", bankAccountId: "account-b" });
  const db = createFinancialDatabase({ runs: [runA, runB] });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.equal(table.rows.length, 2);
  assert.equal(db.calls.reconciliationRunFindUniqueArgs.length, 4); // tie-out + approval readiness (which re-runs tie-out) per run
});

// ---- EXCEPTION_LIST ----

test("generateReportTable (EXCEPTION_LIST) scopes the transaction query to EXCEPTION status, org, and exceptionMarkedAt period", async () => {
  const db = createFinancialDatabase({ transactions: [] });

  await generateReportTable({ reportType: ReportType.EXCEPTION_LIST, periodStart, periodEnd }, context, db);

  assert.equal(db.calls.transactionFindManyArgs.length, 1);
  const args = db.calls.transactionFindManyArgs[0] as { where: Record<string, unknown> };
  assert.equal(args.where.organizationId, "org-1");
  assert.equal(args.where.status, TransactionStatus.EXCEPTION);
  assert.deepEqual(args.where.exceptionMarkedAt, { gte: periodStart, lte: periodEnd });
});

test("generateReportTable (EXCEPTION_LIST) formats exception rows", async () => {
  const transactions = [
    {
      id: "txn-1",
      sourceType: SourceType.BANK,
      transactionDate: new Date("2026-06-10T00:00:00.000Z"),
      description: "Unrecognized bank fee",
      vendor: null,
      reference: "REF-1",
      amount: decimal(12.5),
      currency: "MNT",
      exceptionReason: "No ledger counterpart",
      exceptionMarkedBy: "user-1",
      exceptionMarkedAt: new Date("2026-06-11T00:00:00.000Z"),
    },
  ];
  const db = createFinancialDatabase({ transactions });

  const table = await generateReportTable({ reportType: ReportType.EXCEPTION_LIST, periodStart, periodEnd }, context, db);

  assert.deepEqual(table.rows[0], [
    "txn-1",
    "BANK",
    "2026-06-10",
    "Unrecognized bank fee",
    "",
    "REF-1",
    "12.50",
    "MNT",
    "No ledger counterpart",
    "user-1",
    "2026-06-11T00:00:00.000Z",
  ]);
});

// ---- UNMATCHED_TRANSACTIONS ----

test("generateReportTable (UNMATCHED_TRANSACTIONS) scopes the transaction query to UNMATCHED status, org, and transactionDate period", async () => {
  const db = createFinancialDatabase({ transactions: [] });

  await generateReportTable({ reportType: ReportType.UNMATCHED_TRANSACTIONS, periodStart, periodEnd }, context, db);

  assert.equal(db.calls.transactionFindManyArgs.length, 1);
  const args = db.calls.transactionFindManyArgs[0] as { where: Record<string, unknown> };
  assert.equal(args.where.organizationId, "org-1");
  assert.equal(args.where.status, TransactionStatus.UNMATCHED);
  assert.deepEqual(args.where.transactionDate, { gte: periodStart, lte: periodEnd });
});

test("generateReportTable (UNMATCHED_TRANSACTIONS) formats unmatched transaction rows", async () => {
  const transactions = [
    {
      id: "txn-2",
      sourceType: SourceType.LEDGER,
      transactionDate: new Date("2026-06-15T00:00:00.000Z"),
      description: "Vendor invoice",
      vendor: "Acme Corp",
      reference: null,
      amount: decimal(500),
      currency: "MNT",
    },
  ];
  const db = createFinancialDatabase({ transactions });

  const table = await generateReportTable(
    { reportType: ReportType.UNMATCHED_TRANSACTIONS, periodStart, periodEnd },
    context,
    db,
  );

  assert.deepEqual(table.rows[0], ["txn-2", "LEDGER", "2026-06-15", "Vendor invoice", "Acme Corp", "", "500.00", "MNT"]);
});

// ---- Validation ----

test("generateReportTable rejects an invalid report type", async () => {
  const db = createFinancialDatabase({});

  await assert.rejects(
    generateReportTable(
      { reportType: "NOT_A_REPORT_TYPE" as ReportType, periodStart, periodEnd },
      context,
      db,
    ),
    (error) => error instanceof ReportGenerationError && error.code === "VALIDATION",
  );
});

test("generateReportTable rejects a period start after the period end", async () => {
  const db = createFinancialDatabase({});

  await assert.rejects(
    generateReportTable(
      {
        reportType: ReportType.UNMATCHED_TRANSACTIONS,
        periodStart: new Date("2026-06-30T00:00:00.000Z"),
        periodEnd: new Date("2026-06-01T00:00:00.000Z"),
      },
      context,
      db,
    ),
    (error) => error instanceof ReportGenerationError && error.code === "VALIDATION",
  );
});

test("generateReportTable rejects invalid period dates", async () => {
  const db = createFinancialDatabase({});

  await assert.rejects(
    generateReportTable(
      { reportType: ReportType.UNMATCHED_TRANSACTIONS, periodStart: new Date("not-a-date"), periodEnd },
      context,
      db,
    ),
    (error) => error instanceof ReportGenerationError && error.code === "VALIDATION",
  );
});
