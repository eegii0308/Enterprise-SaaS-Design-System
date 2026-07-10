import test from "node:test";
import assert from "node:assert/strict";
import { SourceType, TransactionStatus } from "@prisma/client";
import {
  markTransactionException,
  clearTransactionException,
  type ExceptionMarkingDatabase,
  type MarkExceptionInput,
  type ClearExceptionInput,
  ExceptionMarkingError,
} from "../lib/reconciliation/exception-marking.ts";
import { manuallyMatchTransactions, type ManualMatchDatabase, ManualMatchError } from "../lib/reconciliation/manual-match.ts";

type MockTransactionRecord = {
  id: string;
  organizationId: string;
  status: TransactionStatus;
};

type MockState = {
  transactionRecord?: MockTransactionRecord | null;
  updates: unknown[];
  auditLogs: unknown[];
  claimCount?: number;
};

const context = {
  organizationId: "org-1",
  userId: "user-1",
};

function unmatchedTransaction(overrides: Partial<MockTransactionRecord> = {}): MockTransactionRecord {
  return {
    id: "txn-1",
    organizationId: "org-1",
    status: TransactionStatus.UNMATCHED,
    ...overrides,
  };
}

function exceptionTransaction(overrides: Partial<MockTransactionRecord> = {}): MockTransactionRecord {
  return {
    id: "txn-1",
    organizationId: "org-1",
    status: TransactionStatus.EXCEPTION,
    ...overrides,
  };
}

function createDatabase(state: Partial<MockState> = {}): ExceptionMarkingDatabase & { state: MockState } {
  const fullState: MockState = {
    transactionRecord: unmatchedTransaction(),
    updates: [],
    auditLogs: [],
    ...state,
  };

  return {
    state: fullState,
    async $transaction(callback) {
      return callback({
        transaction: {
          async findUnique() {
            return fullState.transactionRecord ?? null;
          },
          async updateMany(args) {
            fullState.updates.push(args);
            return { count: fullState.claimCount ?? 1 };
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

const markInput: MarkExceptionInput = { transactionId: "txn-1", reason: "Bank fee, no ledger counterpart" };
const clearInput: ClearExceptionInput = { transactionId: "txn-1" };

// ---- Happy path: mark ----

test("markTransactionException transitions an unmatched transaction to EXCEPTION", async () => {
  const db = createDatabase();

  const result = await markTransactionException(markInput, context, db);

  assert.deepEqual(result, { transactionId: "txn-1", status: TransactionStatus.EXCEPTION });

  assert.equal(db.state.updates.length, 1);
  const update = db.state.updates[0] as {
    where: { id: string; organizationId: string; status: string };
    data: { status: string; exceptionReason: string; exceptionMarkedBy: string; exceptionMarkedAt: Date };
  };
  assert.equal(update.where.id, "txn-1");
  assert.equal(update.where.organizationId, "org-1");
  assert.equal(update.where.status, "UNMATCHED");
  assert.equal(update.data.status, "EXCEPTION");
  assert.equal(update.data.exceptionReason, "Bank fee, no ledger counterpart");
  assert.equal(update.data.exceptionMarkedBy, "user-1");
  assert.ok(update.data.exceptionMarkedAt instanceof Date);
});

test("markTransactionException records required audit log metadata", async () => {
  const db = createDatabase();

  await markTransactionException(markInput, context, db);

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
  assert.equal(auditLog.data.action, "TRANSACTION_EXCEPTION_MARKED");
  assert.equal(auditLog.data.resourceType, "transaction");
  assert.equal(auditLog.data.resourceId, "txn-1");
  assert.equal(auditLog.data.metadata.transactionId, "txn-1");
  assert.equal(auditLog.data.metadata.reason, "Bank fee, no ledger counterpart");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

// ---- Happy path: clear ----

test("clearTransactionException transitions an exception transaction back to UNMATCHED and preserves history", async () => {
  const db = createDatabase({ transactionRecord: exceptionTransaction() });

  const result = await clearTransactionException(clearInput, context, db);

  assert.deepEqual(result, { transactionId: "txn-1", status: TransactionStatus.UNMATCHED });

  assert.equal(db.state.updates.length, 1);
  const update = db.state.updates[0] as {
    where: { id: string; organizationId: string; status: string };
    data: Record<string, unknown>;
  };
  assert.equal(update.where.status, "EXCEPTION");
  assert.deepEqual(Object.keys(update.data).sort(), ["exceptionClearedAt", "exceptionClearedBy", "status"]);
  assert.equal(update.data.status, "UNMATCHED");
  assert.equal(update.data.exceptionClearedBy, "user-1");
  assert.ok(update.data.exceptionClearedAt instanceof Date);
});

test("clearTransactionException records required audit log metadata", async () => {
  const db = createDatabase({ transactionRecord: exceptionTransaction() });

  await clearTransactionException(clearInput, context, db);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: { action: string; resourceType: string; resourceId: string; metadata: Record<string, string> };
  };
  assert.equal(auditLog.data.action, "TRANSACTION_EXCEPTION_CLEARED");
  assert.equal(auditLog.data.resourceType, "transaction");
  assert.equal(auditLog.data.resourceId, "txn-1");
  assert.equal(auditLog.data.metadata.transactionId, "txn-1");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

// ---- Validation ----

test("markTransactionException rejects a missing transactionId", async () => {
  const db = createDatabase();

  await assert.rejects(
    markTransactionException({ transactionId: "", reason: "Some reason" }, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "VALIDATION",
  );
  assert.equal(db.state.updates.length, 0);
});

test("markTransactionException rejects a missing reason", async () => {
  const db = createDatabase();

  await assert.rejects(
    markTransactionException({ transactionId: "txn-1", reason: "" }, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "VALIDATION",
  );
  assert.equal(db.state.updates.length, 0);
});

test("markTransactionException rejects a whitespace-only reason", async () => {
  const db = createDatabase();

  await assert.rejects(
    markTransactionException({ transactionId: "txn-1", reason: "   " }, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "VALIDATION",
  );
  assert.equal(db.state.updates.length, 0);
});

test("clearTransactionException rejects a missing transactionId", async () => {
  const db = createDatabase();

  await assert.rejects(
    clearTransactionException({ transactionId: "" }, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "VALIDATION",
  );
  assert.equal(db.state.updates.length, 0);
});

test("markTransactionException rejects a transaction that does not exist", async () => {
  const db = createDatabase({ transactionRecord: null });

  await assert.rejects(
    markTransactionException(markInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "VALIDATION",
  );
});

// ---- Authorization ----

test("markTransactionException rejects a transaction from another organization", async () => {
  const db = createDatabase({ transactionRecord: unmatchedTransaction({ organizationId: "org-2" }) });

  await assert.rejects(
    markTransactionException(markInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "FORBIDDEN",
  );
  assert.equal(db.state.updates.length, 0);
});

test("clearTransactionException rejects a transaction from another organization", async () => {
  const db = createDatabase({ transactionRecord: exceptionTransaction({ organizationId: "org-2" }) });

  await assert.rejects(
    clearTransactionException(clearInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "FORBIDDEN",
  );
  assert.equal(db.state.updates.length, 0);
});

// ---- State ----

test("markTransactionException rejects a transaction that is already MATCHED", async () => {
  const db = createDatabase({ transactionRecord: unmatchedTransaction({ status: TransactionStatus.MATCHED }) });

  await assert.rejects(
    markTransactionException(markInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});

test("markTransactionException rejects a transaction that is already an EXCEPTION", async () => {
  const db = createDatabase({ transactionRecord: exceptionTransaction() });

  await assert.rejects(
    markTransactionException(markInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});

test("markTransactionException rejects a transaction that is PENDING_REVIEW", async () => {
  const db = createDatabase({ transactionRecord: unmatchedTransaction({ status: TransactionStatus.PENDING_REVIEW }) });

  await assert.rejects(
    markTransactionException(markInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});

test("clearTransactionException rejects a transaction that is still UNMATCHED", async () => {
  const db = createDatabase({ transactionRecord: unmatchedTransaction() });

  await assert.rejects(
    clearTransactionException(clearInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});

test("clearTransactionException rejects a transaction that is MATCHED", async () => {
  const db = createDatabase({ transactionRecord: unmatchedTransaction({ status: TransactionStatus.MATCHED }) });

  await assert.rejects(
    clearTransactionException(clearInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});

// ---- Concurrency / CAS regression tests ----

test("markTransactionException fails when a concurrent manual match wins the claim race", async () => {
  // The transaction still reads as UNMATCHED, but a concurrent
  // manuallyMatchTransactions wins the atomic UNMATCHED -> MATCHED claim
  // first, so this request's CAS updateMany matches zero rows.
  const db = createDatabase({ claimCount: 0 });

  await assert.rejects(
    markTransactionException(markInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 1);
  assert.equal(db.state.auditLogs.length, 0);
});

test("clearTransactionException fails when a concurrent clear wins the CAS race", async () => {
  // The transaction still reads as EXCEPTION, but a concurrent
  // clearTransactionException already won the atomic EXCEPTION -> UNMATCHED
  // transition, so this request's CAS updateMany matches zero rows.
  const db = createDatabase({ transactionRecord: exceptionTransaction(), claimCount: 0 });

  await assert.rejects(
    clearTransactionException(clearInput, context, db),
    (error) => error instanceof ExceptionMarkingError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 1);
  assert.equal(db.state.auditLogs.length, 0);
});

// ---- Cross-domain guard ----

function createManualMatchDatabase(
  transactions: { id: string; organizationId: string; sourceType: SourceType; status: TransactionStatus; transactionDate: Date }[],
): ManualMatchDatabase {
  return {
    async $transaction(callback) {
      return callback({
        transaction: {
          async findMany() {
            return transactions;
          },
          async update() {
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
            return null;
          },
          async create() {
            return { id: "match-new" };
          },
          async update() {
            return {};
          },
          async updateMany() {
            return { count: 0 };
          },
        },
        reconciliationRun: {
          async findFirst() {
            return null;
          },
          async findUnique() {
            return null;
          },
          async create() {
            return { id: "run-created" };
          },
          async updateMany() {
            return { count: 0 };
          },
        },
        auditLog: {
          async create() {
            return {};
          },
        },
      });
    },
  };
}

test("an EXCEPTION-status transaction cannot be manually matched", async () => {
  const now = new Date();
  const db = createManualMatchDatabase([
    { id: "bank-1", organizationId: "org-1", sourceType: SourceType.BANK, status: TransactionStatus.EXCEPTION, transactionDate: now },
    { id: "ledger-1", organizationId: "org-1", sourceType: SourceType.LEDGER, status: TransactionStatus.UNMATCHED, transactionDate: now },
  ]);

  await assert.rejects(
    manuallyMatchTransactions({ bankTransactionId: "bank-1", ledgerTransactionId: "ledger-1" }, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
});
