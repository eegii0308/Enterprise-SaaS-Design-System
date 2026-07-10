import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationMatchStatus, ReconciliationRunStatus } from "@prisma/client";
import {
  rejectManualMatch,
  type ManualMatchDatabase,
  type RejectMatchInput,
  ManualMatchError,
} from "../lib/reconciliation/manual-match.ts";

type MockMatchRecord = {
  id: string;
  organizationId: string;
  status: ReconciliationMatchStatus;
  bankTransactionId: string;
  ledgerTransactionId: string;
  reconciliationRunId: string;
};

type MockRunRecord = { id: string; status: ReconciliationRunStatus };

type MockState = {
  matchRecord?: MockMatchRecord | null;
  matchParentRun?: MockRunRecord | null;
  updates: unknown[];
  matchUpdates: unknown[];
  auditLogs: unknown[];
  runLockCalls: unknown[];
  matchClaimCount?: number;
  runLockCount?: number;
};

const context = {
  organizationId: "org-1",
  userId: "user-1",
};

function confirmedMatch(overrides: Partial<MockMatchRecord> = {}): MockMatchRecord {
  return {
    id: "match-1",
    organizationId: "org-1",
    status: ReconciliationMatchStatus.CONFIRMED,
    bankTransactionId: "bank-1",
    ledgerTransactionId: "ledger-1",
    reconciliationRunId: "run-1",
    ...overrides,
  };
}

function createDatabase(state: Partial<MockState> = {}): ManualMatchDatabase & { state: MockState } {
  const fullState: MockState = {
    matchRecord: confirmedMatch(),
    matchParentRun: { id: "run-1", status: ReconciliationRunStatus.IN_PROGRESS },
    updates: [],
    matchUpdates: [],
    auditLogs: [],
    runLockCalls: [],
    ...state,
  };

  return {
    state: fullState,
    async $transaction(callback) {
      return callback({
        transaction: {
          async findMany() {
            return [];
          },
          async update(args) {
            fullState.updates.push(args);
            return {};
          },
          async updateMany() {
            return { count: 0 };
          },
        },
        reconciliationMatch: {
          async findFirst() {
            return null;
          },
          async findUnique() {
            return fullState.matchRecord ?? null;
          },
          async create() {
            return { id: "match-new" };
          },
          async update() {
            return {};
          },
          async updateMany(args) {
            fullState.matchUpdates.push(args);
            return { count: fullState.matchClaimCount ?? 1 };
          },
        },
        reconciliationRun: {
          async findFirst() {
            return null;
          },
          async findUnique() {
            return fullState.matchParentRun ?? null;
          },
          async create() {
            return { id: "run-created" };
          },
          async updateMany(args) {
            fullState.runLockCalls.push(args);
            return { count: fullState.runLockCount ?? 1 };
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

const rejectInput: RejectMatchInput = { reconciliationMatchId: "match-1", reason: "Bank fee incorrectly matched" };

// ---- Happy path ----

test("rejectManualMatch transitions a confirmed match to rejected and reverts both transactions", async () => {
  const db = createDatabase();

  const result = await rejectManualMatch(rejectInput, context, db);

  assert.deepEqual(result, {
    reconciliationMatchId: "match-1",
    bankTransactionId: "bank-1",
    ledgerTransactionId: "ledger-1",
  });

  assert.equal(db.state.matchUpdates.length, 1);
  const matchUpdate = db.state.matchUpdates[0] as {
    where: { id: string; status: string };
    data: { status: string; rejectedBy: string; rejectedAt: Date; rejectionReason: string };
  };
  assert.equal(matchUpdate.where.id, "match-1");
  assert.equal(matchUpdate.where.status, "CONFIRMED");
  assert.equal(matchUpdate.data.status, "REJECTED");
  assert.equal(matchUpdate.data.rejectedBy, "user-1");
  assert.ok(matchUpdate.data.rejectedAt instanceof Date);
  assert.equal(matchUpdate.data.rejectionReason, "Bank fee incorrectly matched");

  assert.equal(db.state.updates.length, 2);
  const [bankUpdate, ledgerUpdate] = db.state.updates as { where: { id: string }; data: { status: string } }[];
  assert.deepEqual(bankUpdate, { where: { id: "bank-1" }, data: { status: "UNMATCHED" } });
  assert.deepEqual(ledgerUpdate, { where: { id: "ledger-1" }, data: { status: "UNMATCHED" } });
});

test("rejectManualMatch records required audit log metadata", async () => {
  const db = createDatabase();

  await rejectManualMatch(rejectInput, context, db);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: {
      organizationId: string;
      actorUserId: string;
      action: string;
      resourceType: string;
      resourceId: string;
      metadata: Record<string, string>;
    };
  };

  assert.equal(auditLog.data.organizationId, "org-1");
  assert.equal(auditLog.data.actorUserId, "user-1");
  assert.equal(auditLog.data.action, "RECONCILIATION_MATCH_REJECTED");
  assert.equal(auditLog.data.resourceType, "reconciliationMatch");
  assert.equal(auditLog.data.resourceId, "match-1");
  assert.equal(auditLog.data.metadata.reconciliationMatchId, "match-1");
  assert.equal(auditLog.data.metadata.bankTransactionId, "bank-1");
  assert.equal(auditLog.data.metadata.ledgerTransactionId, "ledger-1");
  assert.equal(auditLog.data.metadata.rejectionReason, "Bank fee incorrectly matched");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

// ---- Validation ----

test("rejectManualMatch rejects a missing reconciliationMatchId", async () => {
  const db = createDatabase();

  await assert.rejects(
    rejectManualMatch({ reconciliationMatchId: "", reason: "Some reason" }, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
  assert.equal(db.state.matchUpdates.length, 0);
});

test("rejectManualMatch rejects a missing reason", async () => {
  const db = createDatabase();

  await assert.rejects(
    rejectManualMatch({ reconciliationMatchId: "match-1", reason: "" }, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
  assert.equal(db.state.matchUpdates.length, 0);
});

test("rejectManualMatch rejects a whitespace-only reason", async () => {
  const db = createDatabase();

  await assert.rejects(
    rejectManualMatch({ reconciliationMatchId: "match-1", reason: "   " }, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
  assert.equal(db.state.matchUpdates.length, 0);
});

// ---- Authorization ----

test("rejectManualMatch rejects a match from another organization", async () => {
  const db = createDatabase({ matchRecord: confirmedMatch({ organizationId: "org-2" }) });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "FORBIDDEN",
  );
  assert.equal(db.state.matchUpdates.length, 0);
});

test("rejectManualMatch rejects a match that does not exist", async () => {
  const db = createDatabase({ matchRecord: null });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
});

// ---- State ----

test("rejectManualMatch rejects a match that is not confirmed (PROPOSED)", async () => {
  const db = createDatabase({ matchRecord: confirmedMatch({ status: ReconciliationMatchStatus.PROPOSED }) });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchUpdates.length, 0);
  assert.equal(db.state.updates.length, 0);
});

test("rejectManualMatch rejects an already-removed match", async () => {
  const db = createDatabase({ matchRecord: confirmedMatch({ status: ReconciliationMatchStatus.REMOVED }) });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchUpdates.length, 0);
  assert.equal(db.state.updates.length, 0);
});

test("rejectManualMatch rejects a match that was already corrected away", async () => {
  // correctManualMatch transitions the old match straight to REMOVED (with a
  // correctionReason set) rather than a distinct "corrected" status, so a
  // corrected-away match is read back with status REMOVED -- same guard as
  // the plain removal case above, exercised with correction-shaped data.
  const db = createDatabase({
    matchRecord: confirmedMatch({ status: ReconciliationMatchStatus.REMOVED }),
  });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchUpdates.length, 0);
});

test("rejectManualMatch rejects an already-rejected match", async () => {
  const db = createDatabase({ matchRecord: confirmedMatch({ status: ReconciliationMatchStatus.REJECTED }) });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchUpdates.length, 0);
  assert.equal(db.state.updates.length, 0);
});

// ---- Run locking ----

test("rejectManualMatch rejects rejection when the parent run is ready for review", async () => {
  const db = createDatabase({ matchParentRun: { id: "run-1", status: ReconciliationRunStatus.READY_FOR_REVIEW } });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchUpdates.length, 0);
  assert.equal(db.state.updates.length, 0);
});

test("rejectManualMatch rejects rejection when the parent run is approved", async () => {
  const db = createDatabase({ matchParentRun: { id: "run-1", status: ReconciliationRunStatus.APPROVED } });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchUpdates.length, 0);
  assert.equal(db.state.updates.length, 0);
});

// ---- Concurrency / CAS regression tests ----

test("rejectManualMatch fails when a concurrent submit-for-review wins the run-lock race", async () => {
  // The parent run still reads as IN_PROGRESS (not locked), but a concurrent
  // submitReconciliationRunForReview wins the row lock first and transitions
  // it to READY_FOR_REVIEW before this request's status-preserving CAS runs,
  // so the CAS's updateMany matches zero rows.
  const db = createDatabase({ runLockCount: 0 });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runLockCalls.length, 1);
  assert.equal(db.state.matchUpdates.length, 0);
  assert.equal(db.state.updates.length, 0);
});

test("rejectManualMatch fails when a concurrent removeManualMatch wins the match CAS race", async () => {
  // Simulates removeManualMatch winning the atomic CONFIRMED -> REMOVED
  // transition for the same match first. This request still reads the match
  // as CONFIRMED and the parent run as editable, but its own rejection CAS
  // finds the match already REMOVED (count 0) and must fail before reverting
  // transaction statuses, so the concurrent removal's effects are not
  // clobbered or double-applied.
  const db = createDatabase({ matchClaimCount: 0 });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.runLockCalls.length, 1);
  assert.equal(db.state.matchUpdates.length, 1);
  const rejectionAttempt = db.state.matchUpdates[0] as {
    where: { id: string; status: string };
    data: { status: string };
  };
  assert.equal(rejectionAttempt.where.id, "match-1");
  assert.equal(rejectionAttempt.where.status, "CONFIRMED");
  assert.equal(rejectionAttempt.data.status, "REJECTED");
  assert.equal(db.state.updates.length, 0);
});

test("rejectManualMatch fails when a concurrent correctManualMatch wins the match CAS race", async () => {
  // Simulates correctManualMatch winning the atomic CONFIRMED -> REMOVED
  // transition for the same match first (replacing one side and creating a
  // new confirmed replacement match). This request's rejection CAS finds the
  // match already REMOVED (count 0) and must fail, so it cannot incorrectly
  // unmatch a transaction now referenced by the winning correction's new
  // confirmed match.
  const db = createDatabase({ matchClaimCount: 0 });

  await assert.rejects(
    rejectManualMatch(rejectInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});
