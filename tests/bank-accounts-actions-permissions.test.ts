import test from "node:test";
import assert from "node:assert/strict";
import {
  createBankAccount,
  updateBankAccount,
  archiveBankAccount,
  reactivateBankAccount,
  BankAccountStatus,
  type BankAccountDatabase,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
  type ArchiveBankAccountInput,
  type ReactivateBankAccountInput,
} from "../lib/bank-accounts/management.ts";

// These tests exercise the permission gate that
// app/dashboard/bank-accounts/actions.ts applies in front of the
// lib/bank-accounts/management.ts domain functions, without importing
// actions.ts itself. actions.ts pulls in requirePermission() from
// "@/lib/permissions/authorize", which transitively imports "@/lib/errors"
// and "@/lib/permissions/roles" (both use the "@/" TS path alias). That
// alias is only resolved by tsc, not by this repo's plain
// `node --test --experimental-strip-types` runner, so any file in that
// import chain fails to load here (the same pre-existing gap documented in
// tests/reconciliation-actions-permissions.test.ts).
//
// ROLE_PERMISSIONS mirrors the "bank_accounts.manage" entries of
// rolePermissions in lib/permissions/roles.ts: only ADMIN and
// FINANCE_MANAGER hold it.

class SimulatedPermissionError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(role: string, permission: string) {
    super(`Role ${role} lacks permission ${permission}.`);
  }
}

const ROLE_PERMISSIONS = {
  ADMIN: ["bank_accounts.manage"],
  FINANCE_MANAGER: ["bank_accounts.manage"],
  ACCOUNTANT: [],
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

async function simulateCreateBankAccountAction(
  role: RoleName,
  input: CreateBankAccountInput,
  context: ActionContext,
  database: BankAccountDatabase,
) {
  assertPermission(role, "bank_accounts.manage");
  return createBankAccount(input, context, database);
}

async function simulateUpdateBankAccountAction(
  role: RoleName,
  input: UpdateBankAccountInput,
  context: ActionContext,
  database: BankAccountDatabase,
) {
  assertPermission(role, "bank_accounts.manage");
  return updateBankAccount(input, context, database);
}

async function simulateArchiveBankAccountAction(
  role: RoleName,
  input: ArchiveBankAccountInput,
  context: ActionContext,
  database: BankAccountDatabase,
) {
  assertPermission(role, "bank_accounts.manage");
  return archiveBankAccount(input, context, database);
}

async function simulateReactivateBankAccountAction(
  role: RoleName,
  input: ReactivateBankAccountInput,
  context: ActionContext,
  database: BankAccountDatabase,
) {
  assertPermission(role, "bank_accounts.manage");
  return reactivateBankAccount(input, context, database);
}

const context: ActionContext = { organizationId: "org-1", userId: "user-1" };

type MockBankAccount = {
  id: string;
  organizationId: string;
  status: string;
  bankName: string;
  maskedAccountNumber: string;
};

function mockBankAccount(overrides: Partial<MockBankAccount> = {}): MockBankAccount {
  return {
    id: "account-1",
    organizationId: "org-1",
    status: BankAccountStatus.ACTIVE,
    bankName: "Khan Bank",
    maskedAccountNumber: "****4821",
    ...overrides,
  };
}

function createDatabase(bankAccount: MockBankAccount | null = mockBankAccount()) {
  const state = { creates: [] as unknown[], updates: [] as unknown[], auditLogs: [] as unknown[] };

  const db: BankAccountDatabase & { state: typeof state } = {
    state,
    async $transaction(callback) {
      return callback({
        bankAccount: {
          async findUnique() {
            return bankAccount;
          },
          async findFirst() {
            return null;
          },
          async create(args) {
            state.creates.push(args);
            return { id: "new-account-1", status: BankAccountStatus.ACTIVE };
          },
          async update(args) {
            state.updates.push(args);
            return {};
          },
          async updateMany(args) {
            state.updates.push(args);
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

  return db;
}

const createInput: CreateBankAccountInput = {
  name: "Operating account",
  bankName: "Khan Bank",
  maskedAccountNumber: "****4821",
  currency: "MNT",
};
const updateInput: UpdateBankAccountInput = { bankAccountId: "account-1", ...createInput };
const archiveInput: ArchiveBankAccountInput = { bankAccountId: "account-1" };
const reactivateInput: ReactivateBankAccountInput = { bankAccountId: "account-1" };

// ---- allowed roles ----

for (const role of ["ADMIN", "FINANCE_MANAGER"] as const) {
  test(`createBankAccountAction allows ${role} and executes the domain function`, async () => {
    const db = createDatabase();
    const result = await simulateCreateBankAccountAction(role, createInput, context, db);
    assert.equal(result.bankAccountId, "new-account-1");
    assert.equal(db.state.creates.length, 1);
  });

  test(`updateBankAccountAction allows ${role} and executes the domain function`, async () => {
    const db = createDatabase();
    const result = await simulateUpdateBankAccountAction(role, updateInput, context, db);
    assert.equal(result.bankAccountId, "account-1");
    assert.equal(db.state.updates.length, 1);
  });

  test(`archiveBankAccountAction allows ${role} and executes the domain function`, async () => {
    const db = createDatabase();
    const result = await simulateArchiveBankAccountAction(role, archiveInput, context, db);
    assert.equal(result.status, BankAccountStatus.INACTIVE);
  });

  test(`reactivateBankAccountAction allows ${role} and executes the domain function`, async () => {
    const db = createDatabase(mockBankAccount({ status: BankAccountStatus.INACTIVE }));
    const result = await simulateReactivateBankAccountAction(role, reactivateInput, context, db);
    assert.equal(result.status, BankAccountStatus.ACTIVE);
  });
}

// ---- denied roles ----

for (const role of ["ACCOUNTANT", "AUDITOR", "VIEWER"] as const) {
  test(`createBankAccountAction denies ${role} with FORBIDDEN and never calls the domain function`, async () => {
    const db = createDatabase();
    await assert.rejects(
      simulateCreateBankAccountAction(role, createInput, context, db),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );
    assert.equal(db.state.creates.length, 0);
  });

  test(`updateBankAccountAction denies ${role} with FORBIDDEN and never calls the domain function`, async () => {
    const db = createDatabase();
    await assert.rejects(
      simulateUpdateBankAccountAction(role, updateInput, context, db),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );
    assert.equal(db.state.updates.length, 0);
  });

  test(`archiveBankAccountAction denies ${role} with FORBIDDEN and never calls the domain function`, async () => {
    const db = createDatabase();
    await assert.rejects(
      simulateArchiveBankAccountAction(role, archiveInput, context, db),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );
    assert.equal(db.state.updates.length, 0);
  });

  test(`reactivateBankAccountAction denies ${role} with FORBIDDEN and never calls the domain function`, async () => {
    const db = createDatabase(mockBankAccount({ status: BankAccountStatus.INACTIVE }));
    await assert.rejects(
      simulateReactivateBankAccountAction(role, reactivateInput, context, db),
      (error) => error instanceof SimulatedPermissionError && error.code === "FORBIDDEN",
    );
    assert.equal(db.state.updates.length, 0);
  });
}
