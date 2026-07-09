import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationRunStatus } from "@prisma/client";
import {
  submitReconciliationRunForReview,
  approveReconciliationRun,
  selectCurrentRun,
  type RunLifecycleDatabase,
  type SubmitRunInput,
  type ApproveRunInput,
  RunLifecycleError,
} from "../lib/reconciliation/run-lifecycle.ts";

type MockRun = {
  id: string;
  organizationId: string;
  status: ReconciliationRunStatus;
};

type MockState = {
  run?: MockRun | null;
  confirmedMatchCount: number;
  runUpdates: unknown[];
  auditLogs: unknown[];
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
    ...overrides,
  };
}

function createDatabase(state: Partial<MockState> = {}): RunLifecycleDatabase & { state: MockState } {
  const fullState: MockState = {
    run: run(),
    confirmedMatchCount: 1,
    runUpdates: [],
    auditLogs: [],
    ...state,
  };

  return {
    state: fullState,
    async $transaction(callback) {
      return callback({
        reconciliationRun: {
          async findUnique() {
            return fullState.run ?? null;
          },
          async update(args) {
            fullState.runUpdates.push(args);
            return {};
          },
        },
        reconciliationMatch: {
          async count() {
            return fullState.confirmedMatchCount;
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

const submitInput: SubmitRunInput = { reconciliationRunId: "run-1" };
const approveInput: ApproveRunInput = { reconciliationRunId: "run-1" };

test("submitReconciliationRunForReview transitions an in-progress run to ready for review and audits it", async () => {
  const db = createDatabase();

  const result = await submitReconciliationRunForReview(submitInput, context, db);

  assert.deepEqual(result, { reconciliationRunId: "run-1", status: ReconciliationRunStatus.READY_FOR_REVIEW });
  assert.equal(db.state.runUpdates.length, 1);
  const update = db.state.runUpdates[0] as { where: { id: string }; data: { status: string } };
  assert.deepEqual(update, { where: { id: "run-1" }, data: { status: "READY_FOR_REVIEW" } });

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
    where: { id: string };
    data: { status: string; approvedBy: string; approvedAt: Date; completedAt: Date };
  };
  assert.equal(update.where.id, "run-1");
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

test("selectCurrentRun prioritizes ready-for-review over in-progress, draft, reopened, and approved", () => {
  const runs = [
    { id: "draft", status: ReconciliationRunStatus.DRAFT, createdAt: new Date("2026-01-01") },
    { id: "approved", status: ReconciliationRunStatus.APPROVED, createdAt: new Date("2026-01-04") },
    { id: "ready", status: ReconciliationRunStatus.READY_FOR_REVIEW, createdAt: new Date("2026-01-02") },
    { id: "in-progress", status: ReconciliationRunStatus.IN_PROGRESS, createdAt: new Date("2026-01-03") },
  ];

  assert.equal(selectCurrentRun(runs)?.id, "ready");
});

test("selectCurrentRun falls back through the priority order when higher-priority statuses are absent", () => {
  assert.equal(
    selectCurrentRun([
      { id: "approved", status: ReconciliationRunStatus.APPROVED, createdAt: new Date("2026-01-01") },
      { id: "reopened", status: ReconciliationRunStatus.REOPENED, createdAt: new Date("2026-01-02") },
    ])?.id,
    "reopened",
  );

  assert.equal(
    selectCurrentRun([{ id: "approved-only", status: ReconciliationRunStatus.APPROVED, createdAt: new Date("2026-01-01") }])?.id,
    "approved-only",
  );
});

test("selectCurrentRun breaks ties within the same status by most recent createdAt", () => {
  const result = selectCurrentRun([
    { id: "older", status: ReconciliationRunStatus.APPROVED, createdAt: new Date("2026-01-01") },
    { id: "newer", status: ReconciliationRunStatus.APPROVED, createdAt: new Date("2026-01-05") },
  ]);

  assert.equal(result?.id, "newer");
});

test("selectCurrentRun returns null for an empty list", () => {
  assert.equal(selectCurrentRun([]), null);
});
