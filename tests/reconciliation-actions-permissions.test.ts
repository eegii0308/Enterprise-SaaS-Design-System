import test from "node:test";
import assert from "node:assert/strict";
import { ReconciliationMatchStatus, ReconciliationRunStatus, SourceType, TransactionStatus } from "@prisma/client";
import {
  correctManualMatch,
  type CorrectMatchInput,
  type ManualMatchDatabase,
} from "../lib/reconciliation/manual-match.ts";
import {
  reopenReconciliationRun,
  type ReopenRunInput,
  type RunLifecycleDatabase,
} from "../lib/reconciliation/run-lifecycle.ts";

// These tests exercise the permission gate that
// app/dashboard/reconciliation/actions.ts applies in front of
// correctManualMatch()/reopenReconciliationRun(), without importing
// actions.ts itself. actions.ts pulls in requirePermission() from
// "@/lib/permissions/authorize", which transitively imports "@/lib/errors"
// and "@/lib/permissions/roles" (both use the "@/" TS path alias). That
// alias is only resolved by tsc, not by this repo's plain
// `node --test --experimental-strip-types` runner, so any file in that
// import chain fails to load here (the same pre-existing gap that already
// makes tests/auth-core.test.ts and tests/authorize-core.test.ts fail).
//
// ROLE_PERMISSIONS mirrors the "reconciliation.run"/"reconciliation.approve"
// entries of rolePermissions in lib/permissions/roles.ts, and
// simulateCorrectManualMatchAction/simulateReopenReconciliationRunAction
// mirror the permission-check-then-domain-call shape of the real actions,
// so these tests verify the same access rules against the real domain
// functions and a real (mocked) transaction client.

class SimulatedPermissionError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(role: string, permission: string) {
    super(`Role ${role} lacks permission ${permission}.`);
  }
}

const ROLE_PERMISSIONS = {
  ADMIN: ["reconciliation.run", "reconciliation.approve"],
  FINANCE_MANAGER: ["reconciliation.run", "reconciliation.approve"],
  ACCOUNTANT: ["reconciliation.run"],
  AUDITOR: [],
  VIEWER: [],
} as const;

type RoleName = keyof typeof ROLE_PERMISSIONS;

function assertPermission(role: RoleName, permission: string) {
  if (!(ROLE_PERMISSIONS[role] as readonly string[]).includes(permission)) {
    throw new SimulatedPermissionError(role, permission);
  }
}

type ActionContext = { organizationId: string; userId: string };

async function simulateCorrectManualMatchAction(
  role: RoleName,
  input: CorrectMatchInput,
  context: ActionContext,
  database: ManualMatchDatabase,
) {
  assertPermission(role, "reconciliation.run");
  return correctManualMatch(input, context, database);
}

async function simulateReopenReconciliationRunAction(
  role: RoleName,
  input: ReopenRunInput,
  context: ActionContext,
  database: RunLifecycleDatabase,
) {
  assertPermission(role, "reconciliation.approve");
  return reopenReconciliationRun(input, context, database);
}

const context: ActionContext = { organizationId: "org-1", userId: "user-1" };

// ---- correctManualMatchAction mock database ----

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

type MatchCorrectionState = {
  transactions: MockTransaction[];
  matchRecord?: MockMatchRecord | null;
  matchParentRun?: { id: string; status: ReconciliationRunStatus } | null;
  createdMatches: unknown[];
  releaseUpdates: unknown[];
  matchRemovalCalls: unknown[];
  replacementClaimCalls: unknown[];
  auditLogs: unknown[];
};

function createMatchCorrectionDatabase(): ManualMatchDatabase & { state: MatchCorrectionState } {
  const state: MatchCorrectionState = {
    transactions: [
      {
        id: "bank-2",
        organizationId: "org-1",
        sourceType: SourceType.BANK,
        status: TransactionStatus.UNMATCHED,
        transactionDate: new Date("2026-02-01T00:00:00.000Z"),
      },
    ],
    matchRecord: {
      id: "match-1",
      organizationId: "org-1",
      status: ReconciliationMatchStatus.CONFIRMED,
      bankTransactionId: "bank-1",
      ledgerTransactionId: "ledger-1",
      reconciliationRunId: "run-1",
    },
    matchParentRun: { id: "run-1", status: ReconciliationRunStatus.IN_PROGRESS },
    createdMatches: [],
    releaseUpdates: [],
    matchRemovalCalls: [],
    replacementClaimCalls: [],
    auditLogs: [],
  };

  return {
    state,
    async $transaction(callback) {
      return callback({
        transaction: {
          async findMany() {
            return state.transactions;
          },
          async update(args) {
            state.releaseUpdates.push(args);
            return {};
          },
          async updateMany(args) {
            state.replacementClaimCalls.push(args);
            return { count: 1 };
          },
        },
        reconciliationMatch: {
          async findFirst() {
            return null;
          },
          async findUnique() {
            return state.matchRecord ?? null;
          },
          async create(args) {
            state.createdMatches.push(args);
            return { id: "match-new" };
          },
          async update() {
            return {};
          },
          async updateMany(args) {
            state.matchRemovalCalls.push(args);
            return { count: 1 };
          },
        },
        reconciliationRun: {
          async findFirst() {
            return null;
          },
          async findUnique() {
            return state.matchParentRun ?? null;
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
            state.auditLogs.push(args);
            return {};
          },
        },
      });
    },
  };
}

const correctInput: CorrectMatchInput = {
  reconciliationMatchId: "match-1",
  replacementBankTransactionId: "bank-2",
  reason: "Bank transaction was mismatched",
};

// ---- reopenReconciliationRunAction mock database ----

type ReopenRunState = {
  run?: { id: string; organizationId: string; status: ReconciliationRunStatus } | null;
  runUpdates: unknown[];
  auditLogs: unknown[];
};

function createReopenRunDatabase(): RunLifecycleDatabase & { state: ReopenRunState } {
  const state: ReopenRunState = {
    run: { id: "run-1", organizationId: "org-1", status: ReconciliationRunStatus.APPROVED },
    runUpdates: [],
    auditLogs: [],
  };

  return {
    state,
    async $transaction(callback) {
      return callback({
        reconciliationRun: {
          async findUnique() {
            return state.run ?? null;
          },
          async update(args) {
            state.runUpdates.push(args);
            return {};
          },
          async updateMany(args) {
            state.runUpdates.push(args);
            return { count: 1 };
          },
        },
        reconciliationMatch: {
          async count() {
            return 1;
          },
        },
        auditLog: {
          async create(args) {
            state.auditLogs.push(args);
            return {};
          },
        },
      });
    },
  };
}

const reopenInput: ReopenRunInput = { reconciliationRunId: "run-1", reason: "Discrepancy found after approval" };

// ---- correctManualMatchAction: allowed roles ----

for (const role of ["ACCOUNTANT", "FINANCE_MANAGER", "ADMIN"] as const) {
  test(`correctManualMatchAction allows ${role} and executes the domain function`, async () => {
    const db = createMatchCorrectionDatabase();

    const result = await simulateCorrectManualMatchAction(role, correctInput, context, db);

    assert.equal(result.correctedFromMatchId, "match-1");
    assert.equal(db.state.matchRemovalCalls.length, 1);
    assert.equal(db.state.createdMatches.length, 1);
    assert.equal(db.state.auditLogs.length, 1);
  });
}

// ---- correctManualMatchAction: denied roles ----

for (const role of ["AUDITOR", "VIEWER"] as const) {
  test(`correctManualMatchAction denies ${role} with FORBIDDEN and never calls the domain function`, async () => {
    const db = createMatchCorrectionDatabase();

    await assert.rejects(
      simulateCorrectManualMatchAction(role, correctInput, context, db),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );

    assert.equal(db.state.matchRemovalCalls.length, 0);
    assert.equal(db.state.replacementClaimCalls.length, 0);
    assert.equal(db.state.releaseUpdates.length, 0);
    assert.equal(db.state.createdMatches.length, 0);
    assert.equal(db.state.auditLogs.length, 0);
  });
}

// ---- reopenReconciliationRunAction: allowed roles ----

for (const role of ["FINANCE_MANAGER", "ADMIN"] as const) {
  test(`reopenReconciliationRunAction allows ${role} and executes the domain function`, async () => {
    const db = createReopenRunDatabase();

    const result = await simulateReopenReconciliationRunAction(role, reopenInput, context, db);

    assert.equal(result.status, ReconciliationRunStatus.REOPENED);
    assert.equal(db.state.runUpdates.length, 1);
    assert.equal(db.state.auditLogs.length, 1);
  });
}

// ---- reopenReconciliationRunAction: denied roles ----

for (const role of ["ACCOUNTANT", "AUDITOR", "VIEWER"] as const) {
  test(`reopenReconciliationRunAction denies ${role} with FORBIDDEN and never calls the domain function`, async () => {
    const db = createReopenRunDatabase();

    await assert.rejects(
      simulateReopenReconciliationRunAction(role, reopenInput, context, db),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );

    assert.equal(db.state.runUpdates.length, 0);
    assert.equal(db.state.auditLogs.length, 0);
  });
}
