import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationMatchStatus, ReconciliationRunStatus, ReportType, SourceType, TransactionStatus } from "@prisma/client";
import { generateReportTable, ReportGenerationError, type ReportGenerationDatabase } from "../lib/reports/generation.ts";

const context = { organizationId: "org-1" };

function decimal(value: number) {
  return { toFixed: (digits: number) => value.toFixed(digits) };
}

type CapturedCalls = {
  reconciliationRunFindManyArgs: unknown[];
  reconciliationMatchFindManyArgs: unknown[];
  transactionFindManyArgs: unknown[];
};

function createDatabase(overrides: {
  runs?: unknown[];
  matches?: unknown[];
  transactions?: unknown[];
}): ReportGenerationDatabase & { calls: CapturedCalls } {
  const calls: CapturedCalls = {
    reconciliationRunFindManyArgs: [],
    reconciliationMatchFindManyArgs: [],
    transactionFindManyArgs: [],
  };

  return {
    calls,
    reconciliationRun: {
      async findMany(args) {
        calls.reconciliationRunFindManyArgs.push(args);
        return (overrides.runs ?? []) as never;
      },
    },
    reconciliationMatch: {
      async findMany(args) {
        calls.reconciliationMatchFindManyArgs.push(args);
        return (overrides.matches ?? []) as never;
      },
    },
    transaction: {
      async findMany(args) {
        calls.transactionFindManyArgs.push(args);
        return (overrides.transactions ?? []) as never;
      },
    },
  };
}

const periodStart = new Date("2026-06-01T00:00:00.000Z");
const periodEnd = new Date("2026-06-30T23:59:59.999Z");

// ---- RECONCILIATION_SUMMARY ----

test("generateReportTable (RECONCILIATION_SUMMARY) scopes the run query to the organization and period", async () => {
  const db = createDatabase({ runs: [] });

  await generateReportTable({ reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd }, context, db);

  assert.equal(db.calls.reconciliationRunFindManyArgs.length, 1);
  const args = db.calls.reconciliationRunFindManyArgs[0] as { where: Record<string, unknown> };
  assert.equal(args.where.organizationId, "org-1");
  assert.deepEqual(args.where.periodStart, { lte: periodEnd });
  assert.deepEqual(args.where.periodEnd, { gte: periodStart });
});

test("generateReportTable (RECONCILIATION_SUMMARY) counts matches per run by status", async () => {
  const runs = [
    {
      id: "run-1",
      name: "June reconciliation",
      periodStart,
      periodEnd,
      status: ReconciliationRunStatus.APPROVED,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      approvedAt: new Date("2026-06-05T00:00:00.000Z"),
    },
  ];
  const matches = [
    { reconciliationRunId: "run-1", status: ReconciliationMatchStatus.CONFIRMED },
    { reconciliationRunId: "run-1", status: ReconciliationMatchStatus.CONFIRMED },
    { reconciliationRunId: "run-1", status: ReconciliationMatchStatus.REJECTED },
    { reconciliationRunId: "run-1", status: ReconciliationMatchStatus.REMOVED },
  ];
  const db = createDatabase({ runs, matches });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.deepEqual(table.headers, [
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
  ]);
  assert.equal(table.rows.length, 1);
  assert.deepEqual(table.rows[0], [
    "June reconciliation",
    "2026-06-01",
    "2026-06-30",
    "APPROVED",
    "2",
    "1",
    "1",
    "4",
    "2026-06-01T00:00:00.000Z",
    "2026-06-05T00:00:00.000Z",
  ]);
});

test("generateReportTable (RECONCILIATION_SUMMARY) reports zero counts for a run with no matches and skips the match query when there are no runs", async () => {
  const runs = [
    {
      id: "run-2",
      name: "Empty run",
      periodStart,
      periodEnd,
      status: ReconciliationRunStatus.DRAFT,
      createdAt: new Date("2026-06-02T00:00:00.000Z"),
      approvedAt: null,
    },
  ];
  const db = createDatabase({ runs, matches: [] });

  const table = await generateReportTable(
    { reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd },
    context,
    db,
  );

  assert.deepEqual(table.rows[0], ["Empty run", "2026-06-01", "2026-06-30", "DRAFT", "0", "0", "0", "0", "2026-06-02T00:00:00.000Z", ""]);

  const dbNoRuns = createDatabase({ runs: [] });
  await generateReportTable({ reportType: ReportType.RECONCILIATION_SUMMARY, periodStart, periodEnd }, context, dbNoRuns);
  assert.equal(dbNoRuns.calls.reconciliationMatchFindManyArgs.length, 0);
});

// ---- EXCEPTION_LIST ----

test("generateReportTable (EXCEPTION_LIST) scopes the transaction query to EXCEPTION status, org, and exceptionMarkedAt period", async () => {
  const db = createDatabase({ transactions: [] });

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
  const db = createDatabase({ transactions });

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
  const db = createDatabase({ transactions: [] });

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
  const db = createDatabase({ transactions });

  const table = await generateReportTable(
    { reportType: ReportType.UNMATCHED_TRANSACTIONS, periodStart, periodEnd },
    context,
    db,
  );

  assert.deepEqual(table.rows[0], ["txn-2", "LEDGER", "2026-06-15", "Vendor invoice", "Acme Corp", "", "500.00", "MNT"]);
});

// ---- Validation ----

test("generateReportTable rejects an invalid report type", async () => {
  const db = createDatabase({});

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
  const db = createDatabase({});

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
  const db = createDatabase({});

  await assert.rejects(
    generateReportTable(
      { reportType: ReportType.UNMATCHED_TRANSACTIONS, periodStart: new Date("not-a-date"), periodEnd },
      context,
      db,
    ),
    (error) => error instanceof ReportGenerationError && error.code === "VALIDATION",
  );
});
