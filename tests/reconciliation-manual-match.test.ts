import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationMatchStatus, SourceType, TransactionStatus } from "@prisma/client";
import {
  manuallyMatchTransactions,
  removeManualMatch,
  type ManualMatchDatabase,
  type ManualMatchInput,
  type RemoveMatchInput,
  ManualMatchError,
} from "../lib/reconciliation/manual-match.ts";

type MockTransaction = {
  id: string;
  organizationId: string;
  sourceType: SourceType;
  status: TransactionStatus;
  transactionDate: Date;
};

type MockMatchRecord = {
  id: string;
  organizationId: string;
  status: ReconciliationMatchStatus;
  bankTransactionId: string;
  ledgerTransactionId: string;
};

type MockState = {
  transactions: MockTransaction[];
  existingMatch?: { id: string } | null;
  run?: { id: string } | null;
  matchRecord?: MockMatchRecord | null;
  createdMatches: unknown[];
  updates: unknown[];
  matchUpdates: unknown[];
  auditLogs: unknown[];
  createdRuns: unknown[];
};

const baseInput: ManualMatchInput = {
  bankTransactionId: "bank-1",
  ledgerTransactionId: "ledger-1",
};

const context = {
  organizationId: "org-1",
  userId: "user-1",
};

function bank(overrides: Partial<MockTransaction> = {}): MockTransaction {
  return {
    id: "bank-1",
    organizationId: "org-1",
    sourceType: SourceType.BANK,
    status: TransactionStatus.UNMATCHED,
    transactionDate: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function ledger(overrides: Partial<MockTransaction> = {}): MockTransaction {
  return {
    id: "ledger-1",
    organizationId: "org-1",
    sourceType: SourceType.LEDGER,
    status: TransactionStatus.UNMATCHED,
    transactionDate: new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  };
}

function confirmedMatch(overrides: Partial<MockMatchRecord> = {}): MockMatchRecord {
  return {
    id: "match-1",
    organizationId: "org-1",
    status: ReconciliationMatchStatus.CONFIRMED,
    bankTransactionId: "bank-1",
    ledgerTransactionId: "ledger-1",
    ...overrides,
  };
}

function createDatabase(state: Partial<MockState> = {}): ManualMatchDatabase & { state: MockState } {
  const fullState: MockState = {
    transactions: [bank(), ledger()],
    existingMatch: null,
    run: { id: "run-1" },
    matchRecord: confirmedMatch(),
    createdMatches: [],
    updates: [],
    matchUpdates: [],
    auditLogs: [],
    createdRuns: [],
    ...state,
  };

  return {
    state: fullState,
    async $transaction(callback) {
      return callback({
        transaction: {
          async findMany() {
            return fullState.transactions;
          },
          async update(args) {
            fullState.updates.push(args);
            return {};
          },
        },
        reconciliationMatch: {
          async findFirst() {
            return fullState.existingMatch ?? null;
          },
          async findUnique() {
            return fullState.matchRecord ?? null;
          },
          async create(args) {
            fullState.createdMatches.push(args);
            return { id: "match-1" };
          },
          async update(args) {
            fullState.matchUpdates.push(args);
            return {};
          },
        },
        reconciliationRun: {
          async findFirst() {
            return fullState.run ?? null;
          },
          async create(args) {
            fullState.createdRuns.push(args);
            return { id: "run-created" };
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

test("manuallyMatchTransactions creates match, updates both transactions, and audits success", async () => {
  const db = createDatabase();

  const result = await manuallyMatchTransactions(baseInput, context, db);

  assert.deepEqual(result, {
    reconciliationMatchId: "match-1",
    bankTransactionId: "bank-1",
    ledgerTransactionId: "ledger-1",
  });
  assert.equal(db.state.createdMatches.length, 1);
  assert.equal(db.state.updates.length, 2);
  assert.equal(db.state.auditLogs.length, 1);
  const createdMatch = db.state.createdMatches[0] as {
    data: {
      organizationId: string;
      reconciliationRunId: string;
      bankTransactionId: string;
      ledgerTransactionId: string;
      matchType: string;
      status: string;
      createdBy: string;
      createdAt: Date;
    };
    select: { id: true };
  };
  assert.deepEqual(
    { ...createdMatch, data: { ...createdMatch.data, createdAt: "date" } },
    {
      data: {
        organizationId: "org-1",
        reconciliationRunId: "run-1",
        bankTransactionId: "bank-1",
        ledgerTransactionId: "ledger-1",
        matchType: "MANUAL",
        status: "CONFIRMED",
        createdBy: "user-1",
        createdAt: "date",
      },
      select: { id: true },
    },
  );
  assert.ok(createdMatch.data.createdAt instanceof Date);
});

test("manuallyMatchTransactions rejects duplicate match attempts", async () => {
  const db = createDatabase({ existingMatch: { id: "match-existing" } });

  await assert.rejects(
    manuallyMatchTransactions(baseInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
});

test("manuallyMatchTransactions rejects cross-organization transactions", async () => {
  const db = createDatabase({ transactions: [bank(), ledger({ organizationId: "org-2" })] });

  await assert.rejects(
    manuallyMatchTransactions(baseInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "FORBIDDEN",
  );
});

test("manuallyMatchTransactions rejects invalid transaction source types", async () => {
  const db = createDatabase({ transactions: [bank({ sourceType: SourceType.LEDGER }), ledger()] });

  await assert.rejects(
    manuallyMatchTransactions(baseInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
});

test("manuallyMatchTransactions records required audit log metadata", async () => {
  const db = createDatabase();

  await manuallyMatchTransactions(baseInput, context, db);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: {
      organizationId: string;
      actorUserId: string;
      action: string;
      resourceId: string;
      metadata: Record<string, string>;
    };
  };

  assert.equal(auditLog.data.organizationId, "org-1");
  assert.equal(auditLog.data.actorUserId, "user-1");
  assert.equal(auditLog.data.action, "RECONCILIATION_MATCH_CREATED");
  assert.equal(auditLog.data.resourceId, "match-1");
  assert.equal(auditLog.data.metadata.organizationId, "org-1");
  assert.equal(auditLog.data.metadata.userId, "user-1");
  assert.equal(auditLog.data.metadata.reconciliationMatchId, "match-1");
  assert.equal(auditLog.data.metadata.bankTransactionId, "bank-1");
  assert.equal(auditLog.data.metadata.ledgerTransactionId, "ledger-1");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("manuallyMatchTransactions rejects missing transactions", async () => {
  const db = createDatabase({ transactions: [bank()] });

  await assert.rejects(
    manuallyMatchTransactions(baseInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
});

test("manuallyMatchTransactions rejects already matched transaction statuses", async () => {
  const db = createDatabase({ transactions: [bank({ status: TransactionStatus.MATCHED }), ledger()] });

  await assert.rejects(
    manuallyMatchTransactions(baseInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
});

test("manuallyMatchTransactions creates a manual run when no open run exists", async () => {
  const db = createDatabase({ run: null });

  await manuallyMatchTransactions(baseInput, context, db);

  assert.equal(db.state.createdRuns.length, 1);
  assert.equal(db.state.createdMatches.length, 1);
});

const removeInput: RemoveMatchInput = { reconciliationMatchId: "match-1" };

test("removeManualMatch transitions a confirmed match to removed and reverts both transactions", async () => {
  const db = createDatabase();

  const result = await removeManualMatch(removeInput, context, db);

  assert.deepEqual(result, {
    reconciliationMatchId: "match-1",
    bankTransactionId: "bank-1",
    ledgerTransactionId: "ledger-1",
  });
  assert.equal(db.state.matchUpdates.length, 1);
  const matchUpdate = db.state.matchUpdates[0] as {
    where: { id: string };
    data: { status: string; removedBy: string; removedAt: Date };
  };
  assert.equal(matchUpdate.where.id, "match-1");
  assert.equal(matchUpdate.data.status, "REMOVED");
  assert.equal(matchUpdate.data.removedBy, "user-1");
  assert.ok(matchUpdate.data.removedAt instanceof Date);

  assert.equal(db.state.updates.length, 2);
  const [bankUpdate, ledgerUpdate] = db.state.updates as { where: { id: string }; data: { status: string } }[];
  assert.deepEqual(bankUpdate, { where: { id: "bank-1" }, data: { status: "UNMATCHED" } });
  assert.deepEqual(ledgerUpdate, { where: { id: "ledger-1" }, data: { status: "UNMATCHED" } });
});

test("removeManualMatch records required audit log metadata", async () => {
  const db = createDatabase();

  await removeManualMatch(removeInput, context, db);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as {
    data: {
      organizationId: string;
      actorUserId: string;
      action: string;
      resourceId: string;
      metadata: Record<string, string>;
    };
  };

  assert.equal(auditLog.data.organizationId, "org-1");
  assert.equal(auditLog.data.actorUserId, "user-1");
  assert.equal(auditLog.data.action, "RECONCILIATION_MATCH_REMOVED");
  assert.equal(auditLog.data.resourceId, "match-1");
  assert.equal(auditLog.data.metadata.reconciliationMatchId, "match-1");
  assert.equal(auditLog.data.metadata.bankTransactionId, "bank-1");
  assert.equal(auditLog.data.metadata.ledgerTransactionId, "ledger-1");
  assert.match(auditLog.data.metadata.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("removeManualMatch rejects a missing reconciliationMatchId", async () => {
  const db = createDatabase();

  await assert.rejects(
    removeManualMatch({ reconciliationMatchId: "" }, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
  assert.equal(db.state.matchUpdates.length, 0);
});

test("removeManualMatch rejects a match that does not exist", async () => {
  const db = createDatabase({ matchRecord: null });

  await assert.rejects(
    removeManualMatch(removeInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
});

test("removeManualMatch rejects a match from another organization", async () => {
  const db = createDatabase({ matchRecord: confirmedMatch({ organizationId: "org-2" }) });

  await assert.rejects(
    removeManualMatch(removeInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "FORBIDDEN",
  );
});

test("removeManualMatch rejects a match that is not confirmed", async () => {
  const db = createDatabase({ matchRecord: confirmedMatch({ status: ReconciliationMatchStatus.REMOVED }) });

  await assert.rejects(
    removeManualMatch(removeInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchUpdates.length, 0);
  assert.equal(db.state.updates.length, 0);
});
