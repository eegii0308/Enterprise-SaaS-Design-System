import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { adjustTransaction, type AdjustTransactionInput, type TransactionAdjustmentDatabase } from "../lib/transactions/adjustment.ts";

// Mirrors tests/reconciliation-actions-permissions.test.ts: exercises the
// permission gate app/dashboard/transactions/actions.ts applies in front of
// adjustTransaction() without importing actions.ts itself, since actions.ts
// pulls in requirePermission() from "@/lib/permissions/authorize", which is
// only resolvable by tsc (not this repo's plain node --test runner).
// ROLE_PERMISSIONS mirrors the "transactions.edit" entries of
// rolePermissions in lib/permissions/roles.ts.

class SimulatedPermissionError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(role: string, permission: string) {
    super(`Role ${role} lacks permission ${permission}.`);
  }
}

const ROLE_PERMISSIONS = {
  ADMIN: ["transactions.edit"],
  FINANCE_MANAGER: ["transactions.edit"],
  ACCOUNTANT: ["transactions.edit"],
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

async function simulateAdjustTransactionAction(
  role: RoleName,
  input: AdjustTransactionInput,
  context: ActionContext,
  database: TransactionAdjustmentDatabase,
) {
  assertPermission(role, "transactions.edit");
  return adjustTransaction(input, context, database);
}

type MockState = {
  updates: unknown[];
  adjustments: unknown[];
  auditLogs: unknown[];
};

function createDatabase(): TransactionAdjustmentDatabase & { state: MockState } {
  const state: MockState = { updates: [], adjustments: [], auditLogs: [] };

  return {
    state,
    async $transaction(callback) {
      return callback({
        transaction: {
          async findUnique() {
            return {
              id: "txn-1",
              organizationId: "org-1",
              description: "Customer payment",
              vendor: "Acme Co",
              reference: "INV-1",
              currency: "MNT",
              amount: new Prisma.Decimal("1000.00"),
              transactionDate: new Date("2026-06-15T00:00:00.000Z"),
            };
          },
          async updateMany(args) {
            state.updates.push(args);
            return { count: 1 };
          },
        },
        reconciliationMatch: {
          async findFirst() {
            return null;
          },
        },
        reconciliationRun: {
          async findUnique() {
            return null;
          },
        },
        transactionAdjustment: {
          async create(args) {
            state.adjustments.push(args);
            return { id: "adjustment-1" };
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

const context: ActionContext = { organizationId: "org-1", userId: "user-1" };
const adjustInput: AdjustTransactionInput = {
  transactionId: "txn-1",
  fieldName: "description",
  newValue: "Customer payment - corrected",
  reason: "Typo in original description",
};

for (const role of ["ACCOUNTANT", "FINANCE_MANAGER", "ADMIN"] as const) {
  test(`adjustTransactionAction allows ${role} and executes the domain function`, async () => {
    const db = createDatabase();

    const result = await simulateAdjustTransactionAction(role, adjustInput, context, db);

    assert.equal(result.newValue, "Customer payment - corrected");
    assert.equal(db.state.updates.length, 1);
    assert.equal(db.state.adjustments.length, 1);
    assert.equal(db.state.auditLogs.length, 1);
  });
}

for (const role of ["AUDITOR", "VIEWER"] as const) {
  test(`adjustTransactionAction denies ${role} with FORBIDDEN and never calls the domain function`, async () => {
    const db = createDatabase();

    await assert.rejects(
      simulateAdjustTransactionAction(role, adjustInput, context, db),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );

    assert.equal(db.state.updates.length, 0);
    assert.equal(db.state.adjustments.length, 0);
    assert.equal(db.state.auditLogs.length, 0);
  });
}
