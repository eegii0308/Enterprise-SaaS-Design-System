import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationRunStatus, SourceType, TransactionStatus } from "@prisma/client";
import {
  createReconciliationRun,
  submitReconciliationRunForReview,
  approveReconciliationRun,
  reopenReconciliationRun,
  type RunLifecycleDatabase,
  type CreateRunInput,
  type SubmitRunInput,
  type ApproveRunInput,
  type ReopenRunInput,
  RunLifecycleError,
} from "../lib/reconciliation/run-lifecycle.ts";

const periodStart = new Date("2026-06-01T00:00:00.000Z");
const periodEnd = new Date("2026-06-30T23:59:59.999Z");

type MockRun = {
  id: string;
  organizationId: string;
  status: ReconciliationRunStatus;
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  organization: { defaultCurrency: string };
};

type MockBankAccount = {
  id: string;
  organizationId: string;
  status: string;
};

type MockState = {
  run?: MockRun | null;
  bankAccount?: MockBankAccount | null;
  overlappingRun?: { id: string } | null;
  confirmedMatchCount: number;
  runUpdates: unknown[];
  runCreates: unknown[];
  auditLogs: unknown[];
  transitionCount?: number;
  // Approval-readiness inputs (evaluateApprovalReadiness, via tx). Default to
  // an entirely clean run (no variance, no unmatched items, no exceptions)
  // so existing approve tests that don't care about readiness keep passing
  // without an approvalReason.
  aggregateSums?: Record<string, string | number | null>;
  counts?: Record<string, number>;
  confirmedMatches?: { bankTransactionId: string }[];
  matchedAggregateSum?: string | number | null;
};

const context = {
  organizationId: "org-1",
  userId: "user-1",
};

function run(overrides: Partial<MockRun> = {}): MockRun {
  return {
    id: "run-1",
    organizationId: "org-1",
    status: ReconciliationRunStatus.IN_PROGRESS,
    bankAccountId: "account-1",
    periodStart,
    periodEnd,
    organization: { defaultCurrency: "MNT" },
    ...overrides,
  };
}

function bankAccount(overrides: Partial<MockBankAccount> = {}): MockBankAccount {
  return {
    id: "account-1",
    organizationId: "org-1",
    status: "active",
    ...overrides,
  };
}

function createDatabase(state: Partial<MockState> = {}): RunLifecycleDatabase & { state: MockState } {
  const fullState: MockState = {
    run: run(),
    bankAccount: bankAccount(),
    overlappingRun: null,
    confirmedMatchCount: 1,
    runUpdates: [],
    runCreates: [],
    auditLogs: [],
    aggregateSums: {},
    counts: {},
    confirmedMatches: [],
    matchedAggregateSum: null,
    ...state,
  };

  return {
    state: fullState,
    async $transaction(callback) {
      return callback({
        bankAccount: {
          async findUnique() {
            return fullState.bankAccount ?? null;
          },
        },
        reconciliationRun: {
          async findFirst() {
            return fullState.overlappingRun ?? null;
          },
          async findUnique() {
            return fullState.run ?? null;
          },
          async create(args) {
            fullState.runCreates.push(args);
            return { id: "new-run-1", status: ReconciliationRunStatus.DRAFT };
          },
          async update(args) {
            fullState.runUpdates.push(args);
            return {};
          },
          async updateMany(args) {
            fullState.runUpdates.push(args);
            return { count: fullState.transitionCount ?? 1 };
          },
        },
        reconciliationMatch: {
          async count() {
            return fullState.confirmedMatchCount;
          },
          async findMany() {
            return fullState.confirmedMatches ?? [];
          },
        },
        transaction: {
          async aggregate(args) {
            const where = (args as { where: Record<string, unknown> }).where;

            if (where.id) {
              return { _sum: { amount: fullState.matchedAggregateSum ?? null } };
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

            return { _sum: { amount: fullState.aggregateSums?.[key] ?? null } };
          },
          async count(args) {
            const where = (args as { where: Record<string, unknown> }).where;
            const isBank = where.sourceType === SourceType.BANK;
            const status = where.status as TransactionStatus | undefined;
            const key = `${status === TransactionStatus.EXCEPTION ? "exception" : "unmatched"}${isBank ? "Bank" : "Ledger"}`;
            return fullState.counts?.[key] ?? 0;
          },
        },
        auditLog: {
          async create(args) {
            fullState.auditLogs.push(args);
            return {};
          },
        },
      });
    },
  };
}

const createInput: CreateRunInput = {
  bankAccountId: "account-1",
  periodStart: new Date("2026-06-01T00:00:00.000Z"),
  periodEnd: new Date("2026-06-30T23:59:59.999Z"),
  name: "June 2026 operating account",
};
const submitInput: SubmitRunInput = { reconciliationRunId: "run-1" };
const approveInput: ApproveRunInput = { reconciliationRunId: "run-1" };
const reopenInput: ReopenRunInput = { reconciliationRunId: "run-1", reason: "Discrepancy found after approval" };

test("createReconciliationRun creates a draft run scoped to the bank account and period, and audits it", async () => {
  const db = createDatabase();

  const result = await createReconciliationRun(createInput, context, db);

  assert.deepEqual(result, { reconciliationRunId: "new-run-1", status: ReconciliationRunStatus.DRAFT });
  assert.equal(db.state.runCreates.length, 1);
  const create = db.state.runCreates[0] as { data: Record<string, unknown> };
  assert.equal(create.data.organizationId, "org-1");
  assert.equal(create.data.bankAccountId, "account-1");
  assert.equal(create.data.name, "June 2026 operating account");
  assert.equal(create.data.status, ReconciliationRunStatus.DRAFT);
  assert.equal(create.data.createdBy, "user-1");

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: { action: string; resourceId: string; metadata: Record<string, string> };
  };
  assert.equal(auditLog.data.action, "RECONCILIATION_RUN_CREATED");
  assert.equal(auditLog.data.resourceId, "new-run-1");
  assert.equal(auditLog.data.metadata.bankAccountId, "account-1");
});

test("createReconciliationRun rejects a missing bankAccountId, name, or invalid period", async () => {
  const db = createDatabase();

  await assert.rejects(
    createReconciliationRun({ ...createInput, bankAccountId: "" }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  await assert.rejects(
    createReconciliationRun({ ...createInput, name: "  " }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  await assert.rejects(
    createReconciliationRun({ ...createInput, periodStart: new Date("not-a-date") }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  await assert.rejects(
    createReconciliationRun(
      { ...createInput, periodStart: new Date("2026-06-30"), periodEnd: new Date("2026-06-01") },
      context,
      db,
    ),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  assert.equal(db.state.runCreates.length, 0);
});

test("createReconciliationRun rejects an unknown bank account", async () => {
  const db = createDatabase({ bankAccount: null });

  await assert.rejects(
    createReconciliationRun(createInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("createReconciliationRun rejects a bank account from another organization", async () => {
  const db = createDatabase({ bankAccount: bankAccount({ organizationId: "org-2" }) });

  await assert.rejects(
    createReconciliationRun(createInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "FORBIDDEN",
  );
});

test("createReconciliationRun rejects an inactive bank account", async () => {
  const db = createDatabase({ bankAccount: bankAccount({ status: "inactive" }) });

  await assert.rejects(
    createReconciliationRun(createInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("createReconciliationRun rejects an overlapping open run for the same bank account", async () => {
  const db = createDatabase({ overlappingRun: { id: "existing-run" } });

  await assert.rejects(
    createReconciliationRun(createInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runCreates.length, 0);
});

test("submitReconciliationRunForReview transitions an in-progress run to ready for review and audits it", async () => {
  const db = createDatabase();

  const result = await submitReconciliationRunForReview(submitInput, context, db);

  assert.deepEqual(result, { reconciliationRunId: "run-1", status: ReconciliationRunStatus.READY_FOR_REVIEW });
  assert.equal(db.state.runUpdates.length, 1);
  const update = db.state.runUpdates[0] as {
    where: { id: string; organizationId: string; status: { in: ReconciliationRunStatus[] } };
    data: { status: string };
  };
  assert.equal(update.where.id, "run-1");
  assert.equal(update.where.organizationId, "org-1");
  assert.ok(update.where.status.in.includes(ReconciliationRunStatus.IN_PROGRESS));
  assert.equal(update.data.status, "READY_FOR_REVIEW");

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: { organizationId: string; actorUserId: string; action: string; resourceId: string; metadata: Record<string, string> };
  };
  assert.equal(auditLog.data.organizationId, "org-1");
  assert.equal(auditLog.data.actorUserId, "user-1");
  assert.equal(auditLog.data.action, "RECONCILIATION_RUN_SUBMITTED");
  assert.equal(auditLog.data.resourceId, "run-1");
  assert.equal(auditLog.data.metadata.reconciliationRunId, "run-1");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("submitReconciliationRunForReview accepts draft and reopened runs", async () => {
  const draftDb = createDatabase({ run: run({ status: ReconciliationRunStatus.DRAFT }) });
  await submitReconciliationRunForReview(submitInput, context, draftDb);
  assert.equal(draftDb.state.runUpdates.length, 1);

  const reopenedDb = createDatabase({ run: run({ status: ReconciliationRunStatus.REOPENED }) });
  await submitReconciliationRunForReview(submitInput, context, reopenedDb);
  assert.equal(reopenedDb.state.runUpdates.length, 1);
});

test("submitReconciliationRunForReview rejects a run with no confirmed matches", async () => {
  const db = createDatabase({ confirmedMatchCount: 0 });

  await assert.rejects(
    submitReconciliationRunForReview(submitInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("submitReconciliationRunForReview rejects a missing run", async () => {
  const db = createDatabase({ run: null });

  await assert.rejects(
    submitReconciliationRunForReview(submitInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("submitReconciliationRunForReview rejects a run from another organization", async () => {
  const db = createDatabase({ run: run({ organizationId: "org-2" }) });

  await assert.rejects(
    submitReconciliationRunForReview(submitInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "FORBIDDEN",
  );
});

test("submitReconciliationRunForReview rejects a run that is already ready for review", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }) });

  await assert.rejects(
    submitReconciliationRunForReview(submitInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("submitReconciliationRunForReview rejects an already approved run", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.APPROVED }) });

  await assert.rejects(
    submitReconciliationRunForReview(submitInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
});

test("submitReconciliationRunForReview rejects when a concurrent submission already won the transition", async () => {
  // Simulates two concurrent submissions both passing assertSubmittable before
  // either commits; only one can win the status-scoped CAS update.
  const db = createDatabase({ transitionCount: 0 });

  await assert.rejects(
    submitReconciliationRunForReview(submitInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 1);
  assert.equal(db.state.auditLogs.length, 0);
});

test("submitReconciliationRunForReview rejects a missing reconciliationRunId", async () => {
  const db = createDatabase();

  await assert.rejects(
    submitReconciliationRunForReview({ reconciliationRunId: "" }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("approveReconciliationRun transitions a ready-for-review run to approved and audits it", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }) });

  const result = await approveReconciliationRun(approveInput, context, db);

  assert.deepEqual(result, { reconciliationRunId: "run-1", status: ReconciliationRunStatus.APPROVED });
  assert.equal(db.state.runUpdates.length, 1);
  const update = db.state.runUpdates[0] as {
    where: { id: string; organizationId: string; status: string };
    data: { status: string; approvedBy: string; approvedAt: Date; completedAt: Date };
  };
  assert.equal(update.where.id, "run-1");
  assert.equal(update.where.organizationId, "org-1");
  assert.equal(update.where.status, "READY_FOR_REVIEW");
  assert.equal(update.data.status, "APPROVED");
  assert.equal(update.data.approvedBy, "user-1");
  assert.ok(update.data.approvedAt instanceof Date);
  assert.equal(update.data.approvedAt, update.data.completedAt);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: { organizationId: string; actorUserId: string; action: string; resourceId: string; metadata: Record<string, string> };
  };
  assert.equal(auditLog.data.action, "RECONCILIATION_RUN_APPROVED");
  assert.equal(auditLog.data.resourceId, "run-1");
  assert.equal(auditLog.data.metadata.reconciliationRunId, "run-1");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("approveReconciliationRun rejects when a concurrent approval already won the transition", async () => {
  // Simulates two concurrent approvals both passing assertApprovable before
  // either commits; only one can win the status-scoped CAS update.
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }), transitionCount: 0 });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 1);
  assert.equal(db.state.auditLogs.length, 0);
});

test("approveReconciliationRun rejects a run that is not ready for review", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.IN_PROGRESS }) });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("approveReconciliationRun rejects an already approved run", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.APPROVED }) });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
});

test("approveReconciliationRun rejects a missing run", async () => {
  const db = createDatabase({ run: null });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("approveReconciliationRun rejects a run from another organization", async () => {
  const db = createDatabase({ run: run({ organizationId: "org-2", status: ReconciliationRunStatus.READY_FOR_REVIEW }) });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "FORBIDDEN",
  );
});

test("approveReconciliationRun rejects a missing reconciliationRunId", async () => {
  const db = createDatabase();

  await assert.rejects(
    approveReconciliationRun({ reconciliationRunId: "" }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

// ---- Phase 7C: approval readiness (variance, unmatched items, exceptions) ----

test("approveReconciliationRun approves without a reason when the run is entirely clean", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }) });

  const result = await approveReconciliationRun(approveInput, context, db);

  assert.equal(result.status, ReconciliationRunStatus.APPROVED);
  const auditLog = db.state.auditLogs[0] as { data: { metadata: Record<string, unknown> } };
  assert.equal(auditLog.data.metadata.approvalReason, null);
  assert.equal(auditLog.data.metadata.overrodeOutstandingItems, false);
});

test("approveReconciliationRun rejects approval of a run with financial variance and no reason", async () => {
  const db = createDatabase({
    run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }),
    aggregateSums: { bankTotal: "1000.00", ledgerTotal: "950.00" },
  });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  assert.equal(db.state.runUpdates.length, 0);
  assert.equal(db.state.auditLogs.length, 0);
});

test("approveReconciliationRun rejects approval of a run with unmatched bank transactions and no reason", async () => {
  const db = createDatabase({
    run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }),
    counts: { unmatchedBank: 2 },
  });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("approveReconciliationRun rejects approval of a run with unmatched ledger transactions and no reason", async () => {
  const db = createDatabase({
    run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }),
    counts: { unmatchedLedger: 1 },
  });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("approveReconciliationRun rejects approval of a run with open exceptions and no reason", async () => {
  const db = createDatabase({
    run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }),
    counts: { exceptionBank: 1 },
  });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("approveReconciliationRun rejects a blank (whitespace-only) reason as if no reason was given", async () => {
  const db = createDatabase({
    run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }),
    counts: { unmatchedBank: 1 },
  });

  await assert.rejects(
    approveReconciliationRun({ ...approveInput, approvalReason: "   " }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("approveReconciliationRun flags outstanding items by count even when unmatched amounts net to zero", async () => {
  // Two unmatched bank transactions of +100 and -100 sum to a zero amount,
  // which would look "clean" by amount alone; the count check must still
  // catch them.
  const db = createDatabase({
    run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }),
    aggregateSums: { unmatchedBank: "0.00" },
    counts: { unmatchedBank: 2 },
  });

  await assert.rejects(
    approveReconciliationRun(approveInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
});

test("approveReconciliationRun approves a run with outstanding items when an explicit reason is provided (override)", async () => {
  const db = createDatabase({
    run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }),
    aggregateSums: { bankTotal: "1000.00", ledgerTotal: "950.00", unmatchedBank: "25.00" },
    counts: { unmatchedBank: 1, exceptionLedger: 2 },
  });

  const result = await approveReconciliationRun(
    { ...approveInput, approvalReason: "Approved by controller pending next-cycle cleanup" },
    context,
    db,
  );

  assert.equal(result.status, ReconciliationRunStatus.APPROVED);
  assert.equal(db.state.runUpdates.length, 1);
  assert.equal(db.state.auditLogs.length, 1);

  const auditLog = db.state.auditLogs[0] as {
    data: {
      actorUserId: string;
      metadata: {
        approvalReason: string;
        overrodeOutstandingItems: boolean;
        approvalSnapshot: {
          currency: string;
          variance: string;
          unmatchedBankCount: number;
          unmatchedBankAmount: string;
          unmatchedLedgerCount: number;
          exceptionCount: number;
          evaluatedAt: string;
        };
      };
    };
  };
  assert.equal(auditLog.data.actorUserId, "user-1");
  assert.equal(auditLog.data.metadata.approvalReason, "Approved by controller pending next-cycle cleanup");
  assert.equal(auditLog.data.metadata.overrodeOutstandingItems, true);
  assert.equal(auditLog.data.metadata.approvalSnapshot.currency, "MNT");
  assert.equal(auditLog.data.metadata.approvalSnapshot.variance, "50");
  assert.equal(auditLog.data.metadata.approvalSnapshot.unmatchedBankCount, 1);
  assert.equal(auditLog.data.metadata.approvalSnapshot.unmatchedBankAmount, "25");
  assert.equal(auditLog.data.metadata.approvalSnapshot.unmatchedLedgerCount, 0);
  assert.equal(auditLog.data.metadata.approvalSnapshot.exceptionCount, 2);
  assert.match(auditLog.data.metadata.approvalSnapshot.evaluatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("approveReconciliationRun still evaluates readiness and records a snapshot even when a reason is given for a clean run", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }) });

  await approveReconciliationRun({ ...approveInput, approvalReason: "Reviewed and confirmed clean" }, context, db);

  const auditLog = db.state.auditLogs[0] as { data: { metadata: Record<string, unknown> } };
  assert.equal(auditLog.data.metadata.approvalReason, "Reviewed and confirmed clean");
  assert.equal(auditLog.data.metadata.overrodeOutstandingItems, false);
});

test("approveReconciliationRun rejects when a concurrent request already resolved the outstanding items and won the transition first", async () => {
  // Even though this request's readiness snapshot still shows outstanding
  // items requiring a reason, the CAS on run status is the final word: if a
  // concurrent approval already committed, this request must still fail
  // with CONFLICT rather than silently succeeding a second time.
  const db = createDatabase({
    run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }),
    counts: { unmatchedBank: 1 },
    transitionCount: 0,
  });

  await assert.rejects(
    approveReconciliationRun({ ...approveInput, approvalReason: "Approved despite unmatched item" }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.auditLogs.length, 0);
});

test("reopenReconciliationRun transitions an approved run to reopened and audits it", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.APPROVED }) });

  const result = await reopenReconciliationRun(reopenInput, context, db);

  assert.deepEqual(result, { reconciliationRunId: "run-1", status: ReconciliationRunStatus.REOPENED });
  assert.equal(db.state.runUpdates.length, 1);
  const update = db.state.runUpdates[0] as {
    where: { id: string; organizationId: string; status: string };
    data: Record<string, unknown>;
  };
  assert.equal(update.where.id, "run-1");
  assert.equal(update.where.organizationId, "org-1");
  assert.equal(update.where.status, "APPROVED");
  assert.equal(update.data.status, "REOPENED");
  assert.equal(update.data.reopenedBy, "user-1");
  assert.ok(update.data.reopenedAt instanceof Date);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: { organizationId: string; actorUserId: string; action: string; resourceId: string; metadata: Record<string, string> };
  };
  assert.equal(auditLog.data.organizationId, "org-1");
  assert.equal(auditLog.data.actorUserId, "user-1");
  assert.equal(auditLog.data.action, "RECONCILIATION_RUN_REOPENED");
  assert.equal(auditLog.data.resourceId, "run-1");
  assert.equal(auditLog.data.metadata.reconciliationRunId, "run-1");
  assert.equal(auditLog.data.metadata.reason, "Discrepancy found after approval");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("reopenReconciliationRun preserves approvedBy, approvedAt, and completedAt", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.APPROVED }) });

  await reopenReconciliationRun(reopenInput, context, db);

  const update = db.state.runUpdates[0] as { data: Record<string, unknown> };
  assert.equal("approvedBy" in update.data, false);
  assert.equal("approvedAt" in update.data, false);
  assert.equal("completedAt" in update.data, false);
});

test("reopenReconciliationRun rejects a draft run", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.DRAFT }) });

  await assert.rejects(
    reopenReconciliationRun(reopenInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("reopenReconciliationRun rejects an in-progress run", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.IN_PROGRESS }) });

  await assert.rejects(
    reopenReconciliationRun(reopenInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("reopenReconciliationRun rejects a run that is ready for review", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.READY_FOR_REVIEW }) });

  await assert.rejects(
    reopenReconciliationRun(reopenInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("reopenReconciliationRun rejects a run that is already reopened", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.REOPENED }) });

  await assert.rejects(
    reopenReconciliationRun(reopenInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("reopenReconciliationRun rejects a missing reason", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.APPROVED }) });

  await assert.rejects(
    reopenReconciliationRun({ reconciliationRunId: "run-1", reason: "" }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  await assert.rejects(
    reopenReconciliationRun({ reconciliationRunId: "run-1", reason: "   " }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("reopenReconciliationRun rejects a missing reconciliationRunId", async () => {
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.APPROVED }) });

  await assert.rejects(
    reopenReconciliationRun({ reconciliationRunId: "", reason: "Valid reason" }, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "VALIDATION",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("reopenReconciliationRun rejects a run from another organization", async () => {
  const db = createDatabase({ run: run({ organizationId: "org-2", status: ReconciliationRunStatus.APPROVED }) });

  await assert.rejects(
    reopenReconciliationRun(reopenInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "FORBIDDEN",
  );
  assert.equal(db.state.runUpdates.length, 0);
});

test("reopenReconciliationRun rejects when a concurrent reopen or approval already won the transition", async () => {
  // Simulates a concurrent reopen (or a new approval cycle) winning the race
  // for the same run row before this request's status-scoped CAS runs.
  const db = createDatabase({ run: run({ status: ReconciliationRunStatus.APPROVED }), transitionCount: 0 });

  await assert.rejects(
    reopenReconciliationRun(reopenInput, context, db),
    (error) => error instanceof RunLifecycleError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runUpdates.length, 1);
  assert.equal(db.state.auditLogs.length, 0);
});
