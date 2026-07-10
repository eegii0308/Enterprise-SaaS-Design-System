import test from "node:test";
import assert from "node:assert/strict";
import { Prisma, ReconciliationRunStatus } from "@prisma/client";
import {
  adjustTransaction,
  ADJUSTABLE_FIELDS,
  TransactionAdjustmentError,
  type TransactionAdjustmentDatabase,
  type AdjustTransactionInput,
} from "../lib/transactions/adjustment.ts";

type MockTransactionRecord = {
  id: string;
  organizationId: string;
  description: string;
  vendor: string | null;
  reference: string | null;
  currency: string;
  amount: Prisma.Decimal;
  transactionDate: Date;
};

type MockState = {
  transactionRecord?: MockTransactionRecord | null;
  match?: { id: string; reconciliationRunId: string } | null;
  run?: { id: string; status: ReconciliationRunStatus } | null;
  updateManyCount?: number;
  updates: unknown[];
  adjustments: unknown[];
  auditLogs: unknown[];
};

const context = { organizationId: "org-1", userId: "user-1" };

function transactionRecord(overrides: Partial<MockTransactionRecord> = {}): MockTransactionRecord {
  return {
    id: "txn-1",
    organizationId: "org-1",
    description: "Customer payment",
    vendor: "Acme Co",
    reference: "INV-1",
    currency: "MNT",
    amount: new Prisma.Decimal("1000.00"),
    transactionDate: new Date("2026-06-15T00:00:00.000Z"),
    ...overrides,
  };
}

function createDatabase(state: Partial<MockState> = {}): TransactionAdjustmentDatabase & { state: MockState } {
  const fullState: MockState = {
    transactionRecord: transactionRecord(),
    match: null,
    run: null,
    updates: [],
    adjustments: [],
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
            return { count: fullState.updateManyCount ?? 1 };
          },
        },
        reconciliationMatch: {
          async findFirst() {
            return fullState.match ?? null;
          },
        },
        reconciliationRun: {
          async findUnique() {
            return fullState.run ?? null;
          },
        },
        transactionAdjustment: {
          async create(args) {
            fullState.adjustments.push(args);
            return { id: "adjustment-1" };
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

// ---- Happy path ----

test("adjustTransaction updates the description and preserves the old value", async () => {
  const db = createDatabase();

  const result = await adjustTransaction(
    { transactionId: "txn-1", fieldName: "description", newValue: "Customer payment - corrected", reason: "Typo in original description" },
    context,
    db,
  );

  assert.equal(result.oldValue, "Customer payment");
  assert.equal(result.newValue, "Customer payment - corrected");
  assert.equal(result.fieldName, "description");

  assert.equal(db.state.updates.length, 1);
  const update = db.state.updates[0] as { where: { id: string; organizationId: string; description: string }; data: { description: string } };
  assert.equal(update.where.id, "txn-1");
  assert.equal(update.where.organizationId, "org-1");
  assert.equal(update.where.description, "Customer payment");
  assert.equal(update.data.description, "Customer payment - corrected");
});

test("adjustTransaction records an audit log with old value, new value, reason, actor, and timestamp", async () => {
  const db = createDatabase();

  await adjustTransaction(
    { transactionId: "txn-1", fieldName: "vendor", newValue: "Acme Corp", reason: "Vendor name was misspelled" },
    context,
    db,
  );

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: { organizationId: string; actorUserId: string; action: string; resourceType: string; resourceId: string; metadata: Record<string, string> };
  };
  assert.equal(auditLog.data.organizationId, "org-1");
  assert.equal(auditLog.data.actorUserId, "user-1");
  assert.equal(auditLog.data.action, "TRANSACTION_ADJUSTED");
  assert.equal(auditLog.data.resourceType, "transaction");
  assert.equal(auditLog.data.resourceId, "txn-1");
  assert.equal(auditLog.data.metadata.fieldName, "vendor");
  assert.equal(auditLog.data.metadata.oldValue, "Acme Co");
  assert.equal(auditLog.data.metadata.newValue, "Acme Corp");
  assert.equal(auditLog.data.metadata.reason, "Vendor name was misspelled");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("adjustTransaction also writes a TransactionAdjustment row preserving the original value", async () => {
  const db = createDatabase();

  await adjustTransaction(
    { transactionId: "txn-1", fieldName: "reference", newValue: "INV-2", reason: "Wrong invoice number linked" },
    context,
    db,
  );

  assert.equal(db.state.adjustments.length, 1);
  const adjustment = db.state.adjustments[0] as {
    data: { organizationId: string; transactionId: string; fieldName: string; oldValue: string; newValue: string; reason: string; createdBy: string };
  };
  assert.equal(adjustment.data.organizationId, "org-1");
  assert.equal(adjustment.data.transactionId, "txn-1");
  assert.equal(adjustment.data.fieldName, "reference");
  assert.equal(adjustment.data.oldValue, "INV-1");
  assert.equal(adjustment.data.newValue, "INV-2");
  assert.equal(adjustment.data.reason, "Wrong invoice number linked");
  assert.equal(adjustment.data.createdBy, "user-1");
});

test("adjustTransaction recomputes debit/credit when the amount is corrected to a negative value", async () => {
  const db = createDatabase();

  await adjustTransaction({ transactionId: "txn-1", fieldName: "amount", newValue: "-250.75", reason: "Amount was posted as a credit by mistake" }, context, db);

  const update = db.state.updates[0] as { data: { amount: Prisma.Decimal; debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal } };
  assert.equal(update.data.amount.toString(), "-250.75");
  assert.equal(update.data.debitAmount.toString(), "250.75");
  assert.equal(update.data.creditAmount.toString(), "0");
});

test("adjustTransaction accepts a valid transactionDate correction", async () => {
  const db = createDatabase();

  const result = await adjustTransaction(
    { transactionId: "txn-1", fieldName: "transactionDate", newValue: "2026-06-16", reason: "Bank posted on the wrong date" },
    context,
    db,
  );

  assert.equal(result.oldValue, "2026-06-15");
  assert.equal(result.newValue, "2026-06-16");
  const update = db.state.updates[0] as { data: { transactionDate: Date } };
  assert.equal(update.data.transactionDate.toISOString(), "2026-06-16T00:00:00.000Z");
});

test("every ADJUSTABLE_FIELDS entry can be round-tripped through the service", async () => {
  assert.deepEqual([...ADJUSTABLE_FIELDS].sort(), ["amount", "currency", "description", "reference", "transactionDate", "vendor"]);
});

// ---- Validation failures ----

test("adjustTransaction rejects a missing transactionId", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "", fieldName: "description", newValue: "x", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
});

test("adjustTransaction rejects an unrecognized fieldName", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "status", newValue: "MATCHED", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
  assert.equal(db.state.updates.length, 0);
});

test("adjustTransaction rejects a missing reason", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "description", newValue: "New description", reason: "" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
  assert.equal(db.state.updates.length, 0);
});

test("adjustTransaction rejects a whitespace-only reason", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "description", newValue: "New description", reason: "   " }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
});

test("adjustTransaction rejects a blank description", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "description", newValue: "   ", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
});

test("adjustTransaction rejects a non-numeric amount", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "amount", newValue: "not-a-number", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
});

test("adjustTransaction rejects an amount with more than 2 decimal places", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "amount", newValue: "10.999", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
});

test("adjustTransaction rejects an invalid transactionDate", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "transactionDate", newValue: "not-a-date", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
});

test("adjustTransaction rejects a new value identical to the current value", async () => {
  const db = createDatabase();

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "description", newValue: "Customer payment", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
  assert.equal(db.state.updates.length, 0);
});

test("adjustTransaction rejects a transaction that does not exist", async () => {
  const db = createDatabase({ transactionRecord: null });

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "description", newValue: "New description", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "VALIDATION",
  );
});

// ---- Organization isolation ----

test("adjustTransaction rejects a transaction from another organization", async () => {
  const db = createDatabase({ transactionRecord: transactionRecord({ organizationId: "org-2" }) });

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "description", newValue: "New description", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "FORBIDDEN",
  );
  assert.equal(db.state.updates.length, 0);
});

// ---- Reconciliation lock guard ----

test("adjustTransaction rejects an edit while the transaction's confirmed match belongs to a READY_FOR_REVIEW run", async () => {
  const db = createDatabase({
    match: { id: "match-1", reconciliationRunId: "run-1" },
    run: { id: "run-1", status: ReconciliationRunStatus.READY_FOR_REVIEW },
  });

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "amount", newValue: "999.00", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});

test("adjustTransaction rejects an edit while the transaction's confirmed match belongs to an APPROVED run", async () => {
  const db = createDatabase({
    match: { id: "match-1", reconciliationRunId: "run-1" },
    run: { id: "run-1", status: ReconciliationRunStatus.APPROVED },
  });

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "description", newValue: "Something else", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "CONFLICT",
  );
});

test("adjustTransaction allows an edit while the transaction's confirmed match belongs to an IN_PROGRESS run", async () => {
  const db = createDatabase({
    match: { id: "match-1", reconciliationRunId: "run-1" },
    run: { id: "run-1", status: ReconciliationRunStatus.IN_PROGRESS },
  });

  const result = await adjustTransaction(
    { transactionId: "txn-1", fieldName: "description", newValue: "Something else", reason: "reason" },
    context,
    db,
  );

  assert.equal(result.newValue, "Something else");
});

// ---- Concurrency ----

test("adjustTransaction fails when a concurrent adjustment already changed the same field (CAS miss)", async () => {
  const db = createDatabase({ updateManyCount: 0 });

  await assert.rejects(
    adjustTransaction({ transactionId: "txn-1", fieldName: "description", newValue: "New description", reason: "reason" }, context, db),
    (error) => error instanceof TransactionAdjustmentError && error.code === "CONFLICT",
  );

  assert.equal(db.state.updates.length, 1);
  assert.equal(db.state.adjustments.length, 0);
  assert.equal(db.state.auditLogs.length, 0);
});
