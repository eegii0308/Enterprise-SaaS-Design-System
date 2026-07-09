import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationMatchStatus, ReconciliationRunStatus, SourceType, TransactionStatus } from "@prisma/client";
import {
  correctManualMatch,
  type CorrectMatchInput,
  type ManualMatchDatabase,
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
  reconciliationRunId: string;
};

type MockRunRecord = { id: string; status: ReconciliationRunStatus };

type MockState = {
  transactions: MockTransaction[];
  matchRecord?: MockMatchRecord | null;
  matchParentRun?: MockRunRecord | null;
  createdMatches: unknown[];
  releaseUpdates: unknown[];
  matchRemovalCalls: unknown[];
  replacementClaimCalls: unknown[];
  auditLogs: unknown[];
  claimCount?: number;
  matchClaimCount?: number;
  newMatchId?: string;
};

const context = {
  organizationId: "org-1",
  userId: "user-1",
};

function replacementBank(overrides: Partial<MockTransaction> = {}): MockTransaction {
  return {
    id: "bank-2",
    organizationId: "org-1",
    sourceType: SourceType.BANK,
    status: TransactionStatus.UNMATCHED,
    transactionDate: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

function replacementLedger(overrides: Partial<MockTransaction> = {}): MockTransaction {
  return {
    id: "ledger-2",
    organizationId: "org-1",
    sourceType: SourceType.LEDGER,
    status: TransactionStatus.UNMATCHED,
    transactionDate: new Date("2026-02-02T00:00:00.000Z"),
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
    reconciliationRunId: "run-1",
    ...overrides,
  };
}

function createDatabase(state: Partial<MockState> = {}): ManualMatchDatabase & { state: MockState } {
  const fullState: MockState = {
    transactions: [replacementBank(), replacementLedger()],
    matchRecord: confirmedMatch(),
    matchParentRun: { id: "run-1", status: ReconciliationRunStatus.IN_PROGRESS },
    createdMatches: [],
    releaseUpdates: [],
    matchRemovalCalls: [],
    replacementClaimCalls: [],
    auditLogs: [],
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
            fullState.releaseUpdates.push(args);
            return {};
          },
          async updateMany(args) {
            fullState.replacementClaimCalls.push(args);
            return { count: fullState.claimCount ?? 1 };
          },
        },
        reconciliationMatch: {
          async findFirst() {
            return null;
          },
          async findUnique() {
            return fullState.matchRecord ?? null;
          },
          async create(args) {
            fullState.createdMatches.push(args);
            return { id: fullState.newMatchId ?? "match-new" };
          },
          async update() {
            return {};
          },
          async updateMany(args) {
            fullState.matchRemovalCalls.push(args);
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
          async updateMany() {
            return { count: 1 };
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

const bankCorrectionInput: CorrectMatchInput = {
  reconciliationMatchId: "match-1",
  replacementBankTransactionId: "bank-2",
  reason: "Bank transaction was mismatched",
};

const ledgerCorrectionInput: CorrectMatchInput = {
  reconciliationMatchId: "match-1",
  replacementLedgerTransactionId: "ledger-2",
  reason: "Ledger transaction was mismatched",
};

// 1. Correct bank side
test("correctManualMatch corrects the bank side, removes the old match, and creates a new confirmed match", async () => {
  const db = createDatabase();

  const result = await correctManualMatch(bankCorrectionInput, context, db);

  assert.deepEqual(result, {
    reconciliationMatchId: "match-new",
    correctedFromMatchId: "match-1",
    bankTransactionId: "bank-2",
    ledgerTransactionId: "ledger-1",
  });

  assert.equal(db.state.matchRemovalCalls.length, 1);
  const removal = db.state.matchRemovalCalls[0] as {
    where: { id: string; organizationId: string; status: string };
    data: { status: string; removedBy: string; removedAt: Date; correctionReason: string };
  };
  assert.equal(removal.where.id, "match-1");
  assert.equal(removal.where.status, "CONFIRMED");
  assert.equal(removal.data.status, "REMOVED");
  assert.equal(removal.data.removedBy, "user-1");
  assert.ok(removal.data.removedAt instanceof Date);
  assert.equal(removal.data.correctionReason, "Bank transaction was mismatched");

  assert.equal(db.state.releaseUpdates.length, 1);
  assert.deepEqual(db.state.releaseUpdates[0], { where: { id: "bank-1" }, data: { status: "UNMATCHED" } });

  assert.equal(db.state.replacementClaimCalls.length, 1);
  const claim = db.state.replacementClaimCalls[0] as {
    where: { id: string; organizationId: string; status: string };
    data: { status: string };
  };
  assert.equal(claim.where.id, "bank-2");
  assert.equal(claim.where.status, "UNMATCHED");
  assert.equal(claim.data.status, "MATCHED");

  assert.equal(db.state.createdMatches.length, 1);
  const created = db.state.createdMatches[0] as {
    data: {
      bankTransactionId: string;
      ledgerTransactionId: string;
      matchType: string;
      status: string;
      correctedFromMatchId: string;
    };
  };
  assert.equal(created.data.bankTransactionId, "bank-2");
  assert.equal(created.data.ledgerTransactionId, "ledger-1");
  assert.equal(created.data.matchType, "MANUAL");
  assert.equal(created.data.status, "CONFIRMED");
  assert.equal(created.data.correctedFromMatchId, "match-1");

  assert.equal(db.state.auditLogs.length, 1);
  assert.equal((db.state.auditLogs[0] as { data: { action: string } }).data.action, "RECONCILIATION_MATCH_CORRECTED");
});

// 2. Correct ledger side
test("correctManualMatch corrects the ledger side, removes the old match, and creates a new confirmed match", async () => {
  const db = createDatabase();

  const result = await correctManualMatch(ledgerCorrectionInput, context, db);

  assert.deepEqual(result, {
    reconciliationMatchId: "match-new",
    correctedFromMatchId: "match-1",
    bankTransactionId: "bank-1",
    ledgerTransactionId: "ledger-2",
  });

  assert.equal(db.state.matchRemovalCalls.length, 1);
  const removal = db.state.matchRemovalCalls[0] as {
    data: { status: string; correctionReason: string };
  };
  assert.equal(removal.data.status, "REMOVED");
  assert.equal(removal.data.correctionReason, "Ledger transaction was mismatched");

  assert.equal(db.state.releaseUpdates.length, 1);
  assert.deepEqual(db.state.releaseUpdates[0], { where: { id: "ledger-1" }, data: { status: "UNMATCHED" } });

  assert.equal(db.state.replacementClaimCalls.length, 1);
  const claim = db.state.replacementClaimCalls[0] as { where: { id: string } };
  assert.equal(claim.where.id, "ledger-2");

  assert.equal(db.state.createdMatches.length, 1);
  const created = db.state.createdMatches[0] as {
    data: { bankTransactionId: string; ledgerTransactionId: string; correctedFromMatchId: string };
  };
  assert.equal(created.data.bankTransactionId, "bank-1");
  assert.equal(created.data.ledgerTransactionId, "ledger-2");
  assert.equal(created.data.correctedFromMatchId, "match-1");

  assert.equal(db.state.auditLogs.length, 1);
});

// 3. Missing replacement
test("correctManualMatch rejects when no replacement transaction is provided", async () => {
  const db = createDatabase();

  await assert.rejects(
    correctManualMatch({ reconciliationMatchId: "match-1", reason: "Needs correction" }, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
  assert.equal(db.state.matchRemovalCalls.length, 0);
});

// 4. Same transaction replacement
test("correctManualMatch rejects replacing a side with the transaction already matched to it", async () => {
  const db = createDatabase({
    transactions: [
      {
        id: "bank-1",
        organizationId: "org-1",
        sourceType: SourceType.BANK,
        status: TransactionStatus.MATCHED,
        transactionDate: new Date("2026-01-02T00:00:00.000Z"),
      },
      replacementLedger(),
    ],
  });

  await assert.rejects(
    correctManualMatch({ reconciliationMatchId: "match-1", replacementBankTransactionId: "bank-1", reason: "Retry with same transaction" }, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchRemovalCalls.length, 0);
});

// 5. Empty reason
test("correctManualMatch rejects an empty correction reason", async () => {
  const db = createDatabase();

  await assert.rejects(
    correctManualMatch({ ...bankCorrectionInput, reason: "   " }, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
  assert.equal(db.state.matchRemovalCalls.length, 0);
});

// 6. Missing match
test("correctManualMatch rejects a match that does not exist", async () => {
  const db = createDatabase({ matchRecord: null });

  await assert.rejects(
    correctManualMatch(bankCorrectionInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
});

// 7. Wrong organization
test("correctManualMatch rejects a match from another organization", async () => {
  const db = createDatabase({ matchRecord: confirmedMatch({ organizationId: "org-2" }) });

  await assert.rejects(
    correctManualMatch(bankCorrectionInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "FORBIDDEN",
  );
  assert.equal(db.state.matchRemovalCalls.length, 0);
});

// 8. Match not CONFIRMED
test("correctManualMatch rejects a match that is not confirmed", async () => {
  const db = createDatabase({ matchRecord: confirmedMatch({ status: ReconciliationMatchStatus.REMOVED }) });

  await assert.rejects(
    correctManualMatch(bankCorrectionInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchRemovalCalls.length, 0);
});

// 9. Locked run READY_FOR_REVIEW
test("correctManualMatch rejects correction when the parent run is ready for review", async () => {
  const db = createDatabase({ matchParentRun: { id: "run-1", status: ReconciliationRunStatus.READY_FOR_REVIEW } });

  await assert.rejects(
    correctManualMatch(bankCorrectionInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchRemovalCalls.length, 0);
});

// 10. Locked run APPROVED
test("correctManualMatch rejects correction when the parent run is approved", async () => {
  const db = createDatabase({ matchParentRun: { id: "run-1", status: ReconciliationRunStatus.APPROVED } });

  await assert.rejects(
    correctManualMatch(bankCorrectionInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchRemovalCalls.length, 0);
});

// 11. Replacement transaction invalid
test("correctManualMatch rejects a replacement transaction with the wrong source type", async () => {
  const db = createDatabase({
    transactions: [replacementBank({ sourceType: SourceType.LEDGER }), replacementLedger()],
  });

  await assert.rejects(
    correctManualMatch(bankCorrectionInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "VALIDATION",
  );
  assert.equal(db.state.matchRemovalCalls.length, 0);
});

// 12. Replacement CAS conflict
test("correctManualMatch rejects when a concurrent request already claimed the replacement transaction", async () => {
  const db = createDatabase({ claimCount: 0 });

  await assert.rejects(
    correctManualMatch(bankCorrectionInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.matchRemovalCalls.length, 1);
  assert.equal(db.state.createdMatches.length, 0);
});

// 13. Match CAS conflict
test("correctManualMatch rejects when the match changed before the removal CAS could apply", async () => {
  const db = createDatabase({ matchClaimCount: 0 });

  await assert.rejects(
    correctManualMatch(bankCorrectionInput, context, db),
    (error) => error instanceof ManualMatchError && error.code === "CONFLICT",
  );
  assert.equal(db.state.releaseUpdates.length, 0);
  assert.equal(db.state.replacementClaimCalls.length, 0);
  assert.equal(db.state.createdMatches.length, 0);
});
