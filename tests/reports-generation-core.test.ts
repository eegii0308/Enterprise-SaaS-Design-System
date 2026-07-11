import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationRunStatus, ReportType, SourceType, TransactionStatus } from "@prisma/client";
import { generateReportTable, ReportGenerationError, type ReportGenerationDatabase } from "../lib/reports/generation.ts";

const context = { organizationId: "org-1" };

function decimal(value: number) {
  return { toFixed: (digits: number) => value.toFixed(digits) };
}

const periodStart = new Date("2026-06-01T00:00:00.000Z");
const periodEnd = new Date("2026-06-30T23:59:59.999Z");

type MockRun = {
  id: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  bankAccountId: string;
  createdBy: string;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  organization: { name: string; defaultCurrency: string };
};

type CapturedCalls = {
  reconciliationRunFindManyArgs: unknown[];
  reconciliationRunFindUniqueArgs: unknown[];
  transactionFindManyArgs: unknown[];
  bankAccountFindManyArgs: unknown[];
  userFindManyArgs: unknown[];
  auditLogFindManyArgs: unknown[];
};

function createFinancialDatabase(overrides: {
  runs?: MockRun[];
  aggregateSums?: Record<string, number>;
  depositsWithdrawals?: { credit: number; debit: number };
  confirmedMatches?: { bankTransactionId: string }[];
  matchedAggregateSum?: number;
  counts?: Record<string, number>;
  adjustmentCounts?: { bank: number; ledger: number };
  bankAccounts?: { id: string; name: string }[];
  users?: { id: string; fullName: string }[];
  approvalAuditLogs?: { resourceId: string; metadata: unknown }[];
  transactions?: unknown[];
}): ReportGenerationDatabase & { calls: CapturedCalls } {
  const calls: CapturedCalls = {
    reconciliationRunFindManyArgs: [],
    reconciliationRunFindUniqueArgs: [],
    transactionFindManyArgs: [],
    bankAccountFindManyArgs: [],
    userFindManyArgs: [],
    auditLogFindManyArgs: [],
  };

  const runs = overrides.runs ?? [];
  const aggregateSums = overrides.aggregateSums ?? {};
  const depositsWithdrawals = overrides.depositsWithdrawals ?? { credit: 0, debit: 0 };
  const confirmedMatches = overrides.confirmedMatches ?? [];
  const counts = overrides.counts ?? {};
  const adjustmentCounts = overrides.adjustmentCounts ?? { bank: 0, ledger: 0 };

  return {
    calls,
    reconciliationRun: {
      async findMany(args) {
        calls.reconciliationRunFindManyArgs.push(args);
        return runs as never;
      },
      async findUnique(args) {
        calls.reconciliationRunFindUniqueArgs.push(args);
        const id = (args as { where: { id: string } }).where.id;
        return (runs.find((run) => run.id === id) ?? null) as never;
      },
    },
    reconciliationMatch: {
      async findMany() {
        return confirmedMatches as never;
      },
    },
    transaction: {
      async findMany(args) {
        calls.transactionFindManyArgs.push(args);
        return (overrides.transactions ?? []) as never;
      },
      async aggregate(args) {
        const typedArgs = args as { where: Record<string, unknown>; _sum: Record<string, boolean> };
        const where = typedArgs.where;

        if (typedArgs._sum.creditAmount || typedArgs._sum.debitAmount) {
          return { _sum: { amount: null, creditAmount: depositsWithdrawals.credit, debitAmount: depositsWithdrawals.debit } } as never;
        }

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
      async count(args) {
        const where = (args as { where: Record<string, unknown> }).where;
        const sourceType = where.sourceType as SourceType | undefined;
        const status = where.status as TransactionStatus | undefined;
        const isBank = sourceType === SourceType.BANK;

        let key: string;
        if (status === TransactionStatus.UNMATCHED) {
          key = isBank ? "unmatchedBank" : "unmatchedLedger";
        } else {
          key = isBank ? "exceptionBank" : "exceptionLedger";
        }

        return counts[key] ?? 0;
      },
    },
    transactionAdjustment: {
      async count(args) {
        const where = (args as { where: { transaction: { sourceType: SourceType } } }).where;
        return where.transaction.sourceType === SourceType.BANK ? adjustmentCounts.bank : adjustmentCounts.ledger;
      },
    },
    bankAccount: {
      async findMany(args) {
        calls.bankAccountFindManyArgs.push(args);
        return (overrides.bankAccounts ?? []) as never;
      },
    },
    user: {
      async findMany(args) {
        calls.userFindManyArgs.push(args);
        return (overrides.users ?? []) as never;
      },
    },
    auditLog: {
      async findMany(args) {
        calls.auditLogFindManyArgs.push(args);
        return (overrides.approvalAuditLogs ?? []) as never;
      },
    },
  };
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

function baseRun(overrides: Partial<MockRun> = {}): MockRun {
  return {
    id: "run-1",
    organizationId: "org-1",
    periodStart,
    periodEnd,
    status: ReconciliationRunStatus.DRAFT,
    bankAccountId: "account-1",
    createdBy: "user-1",
    createdAt: new Date("2026-06-01T08:00:00.000Z"),
    approvedBy: null,
    approvedAt: null,
    organization: { name: "Acme Reconciliation", defaultCurrency: "MNT" },
    ...overrides,
  };
}

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
