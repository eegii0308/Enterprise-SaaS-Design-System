import test from "node:test";
import assert from "node:assert/strict";
import {
  createBankAccount,
  updateBankAccount,
  archiveBankAccount,
  reactivateBankAccount,
  BankAccountError,
  BankAccountStatus,
  type BankAccountDatabase,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
  type ArchiveBankAccountInput,
  type ReactivateBankAccountInput,
} from "../lib/bank-accounts/management.ts";

type MockBankAccount = {
  id: string;
  organizationId: string;
  status: string;
  bankName: string;
  maskedAccountNumber: string;
};

type MockState = {
  bankAccount?: MockBankAccount | null;
  duplicate?: { id: string } | null;
  updates: unknown[];
  creates: unknown[];
  auditLogs: unknown[];
  updateCount?: number;
};

const context = { organizationId: "org-1", userId: "user-1" };

function bankAccount(overrides: Partial<MockBankAccount> = {}): MockBankAccount {
  return {
    id: "account-1",
    organizationId: "org-1",
    status: BankAccountStatus.ACTIVE,
    bankName: "Khan Bank",
    maskedAccountNumber: "****4821",
    ...overrides,
  };
}

function createDatabase(state: Partial<MockState> = {}): BankAccountDatabase & { state: MockState } {
  const fullState: MockState = {
    bankAccount: bankAccount(),
    duplicate: null,
    updates: [],
    creates: [],
    auditLogs: [],
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
          async findFirst() {
            return fullState.duplicate ?? null;
          },
          async create(args) {
            fullState.creates.push(args);
            return { id: "new-account-1", status: BankAccountStatus.ACTIVE };
          },
          async update(args) {
            fullState.updates.push(args);
            return {};
          },
          async updateMany(args) {
            fullState.updates.push(args);
            return { count: fullState.updateCount ?? 1 };
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

const createInput: CreateBankAccountInput = {
  name: "Operating account",
  bankName: "Khan Bank",
  maskedAccountNumber: "****4821",
  currency: "mnt",
};

const updateInput: UpdateBankAccountInput = {
  bankAccountId: "account-1",
  name: "Operating account (renamed)",
  bankName: "Khan Bank",
  maskedAccountNumber: "****4821",
  currency: "MNT",
};

const archiveInput: ArchiveBankAccountInput = { bankAccountId: "account-1" };
const reactivateInput: ReactivateBankAccountInput = { bankAccountId: "account-1" };

test("createBankAccount creates an active account with normalized fields and audits it", async () => {
  const db = createDatabase();

  const result = await createBankAccount(createInput, context, db);

  assert.deepEqual(result, { bankAccountId: "new-account-1", status: BankAccountStatus.ACTIVE });
  assert.equal(db.state.creates.length, 1);
  const create = db.state.creates[0] as { data: Record<string, unknown> };
  assert.equal(create.data.organizationId, "org-1");
  assert.equal(create.data.name, "Operating account");
  assert.equal(create.data.bankName, "Khan Bank");
  assert.equal(create.data.maskedAccountNumber, "****4821");
  assert.equal(create.data.currency, "MNT");
  assert.equal(create.data.status, BankAccountStatus.ACTIVE);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as { data: { action: string; resourceId: string } };
  assert.equal(auditLog.data.action, "BANK_ACCOUNT_CREATED");
  assert.equal(auditLog.data.resourceId, "new-account-1");
});

test("createBankAccount rejects missing fields and an invalid currency code", async () => {
  const db = createDatabase();

  await assert.rejects(
    createBankAccount({ ...createInput, name: "  " }, context, db),
    (error) => error instanceof BankAccountError && error.code === "VALIDATION",
  );
  await assert.rejects(
    createBankAccount({ ...createInput, bankName: "" }, context, db),
    (error) => error instanceof BankAccountError && error.code === "VALIDATION",
  );
  await assert.rejects(
    createBankAccount({ ...createInput, maskedAccountNumber: "" }, context, db),
    (error) => error instanceof BankAccountError && error.code === "VALIDATION",
  );
  await assert.rejects(
    createBankAccount({ ...createInput, currency: "MongolianTugrik" }, context, db),
    (error) => error instanceof BankAccountError && error.code === "VALIDATION",
  );
  assert.equal(db.state.creates.length, 0);
});

test("createBankAccount rejects a duplicate active account for the same bank and account number", async () => {
  const db = createDatabase({ duplicate: { id: "existing-account" } });

  await assert.rejects(
    createBankAccount(createInput, context, db),
    (error) => error instanceof BankAccountError && error.code === "CONFLICT",
  );
  assert.equal(db.state.creates.length, 0);
});

test("updateBankAccount updates fields and audits it", async () => {
  const db = createDatabase();

  const result = await updateBankAccount(updateInput, context, db);

  assert.deepEqual(result, { bankAccountId: "account-1", status: BankAccountStatus.ACTIVE });
  assert.equal(db.state.updates.length, 1);
  const update = db.state.updates[0] as { data: Record<string, unknown> };
  assert.equal(update.data.name, "Operating account (renamed)");

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as { data: { action: string } };
  assert.equal(auditLog.data.action, "BANK_ACCOUNT_UPDATED");
});

test("updateBankAccount rejects a missing bankAccountId", async () => {
  const db = createDatabase();

  await assert.rejects(
    updateBankAccount({ ...updateInput, bankAccountId: "" }, context, db),
    (error) => error instanceof BankAccountError && error.code === "VALIDATION",
  );
});

test("updateBankAccount rejects an unknown or foreign-organization account", async () => {
  const missingDb = createDatabase({ bankAccount: null });
  await assert.rejects(
    updateBankAccount(updateInput, context, missingDb),
    (error) => error instanceof BankAccountError && error.code === "VALIDATION",
  );

  const foreignDb = createDatabase({ bankAccount: bankAccount({ organizationId: "org-2" }) });
  await assert.rejects(
    updateBankAccount(updateInput, context, foreignDb),
    (error) => error instanceof BankAccountError && error.code === "FORBIDDEN",
  );
});

test("updateBankAccount rejects a rename that collides with another active account", async () => {
  const db = createDatabase({ duplicate: { id: "other-account" } });

  await assert.rejects(
    updateBankAccount(updateInput, context, db),
    (error) => error instanceof BankAccountError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});

test("updateBankAccount does not duplicate-check an archived account", async () => {
  const db = createDatabase({ bankAccount: bankAccount({ status: BankAccountStatus.INACTIVE }), duplicate: { id: "other-account" } });

  const result = await updateBankAccount(updateInput, context, db);

  assert.equal(result.status, BankAccountStatus.INACTIVE);
  assert.equal(db.state.updates.length, 1);
});

test("archiveBankAccount transitions an active account to inactive and audits it", async () => {
  const db = createDatabase();

  const result = await archiveBankAccount(archiveInput, context, db);

  assert.deepEqual(result, { bankAccountId: "account-1", status: BankAccountStatus.INACTIVE });
  assert.equal(db.state.updates.length, 1);
  const update = db.state.updates[0] as {
    where: { status: string };
    data: { status: string };
  };
  assert.equal(update.where.status, BankAccountStatus.ACTIVE);
  assert.equal(update.data.status, BankAccountStatus.INACTIVE);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as { data: { action: string } };
  assert.equal(auditLog.data.action, "BANK_ACCOUNT_ARCHIVED");
});

test("archiveBankAccount rejects an already-archived account", async () => {
  const db = createDatabase({ bankAccount: bankAccount({ status: BankAccountStatus.INACTIVE }) });

  await assert.rejects(
    archiveBankAccount(archiveInput, context, db),
    (error) => error instanceof BankAccountError && error.code === "CONFLICT",
  );
});

test("archiveBankAccount surfaces a CONFLICT if a concurrent request already changed the status", async () => {
  const db = createDatabase({ updateCount: 0 });

  await assert.rejects(
    archiveBankAccount(archiveInput, context, db),
    (error) => error instanceof BankAccountError && error.code === "CONFLICT",
  );
});

test("archiveBankAccount rejects an unknown or foreign-organization account", async () => {
  const missingDb = createDatabase({ bankAccount: null });
  await assert.rejects(
    archiveBankAccount(archiveInput, context, missingDb),
    (error) => error instanceof BankAccountError && error.code === "VALIDATION",
  );

  const foreignDb = createDatabase({ bankAccount: bankAccount({ organizationId: "org-2" }) });
  await assert.rejects(
    archiveBankAccount(archiveInput, context, foreignDb),
    (error) => error instanceof BankAccountError && error.code === "FORBIDDEN",
  );
});

test("reactivateBankAccount transitions an inactive account back to active and audits it", async () => {
  const db = createDatabase({ bankAccount: bankAccount({ status: BankAccountStatus.INACTIVE }) });

  const result = await reactivateBankAccount(reactivateInput, context, db);

  assert.deepEqual(result, { bankAccountId: "account-1", status: BankAccountStatus.ACTIVE });
  assert.equal(db.state.updates.length, 1);
  const update = db.state.updates[0] as {
    where: { status: string };
    data: { status: string };
  };
  assert.equal(update.where.status, BankAccountStatus.INACTIVE);
  assert.equal(update.data.status, BankAccountStatus.ACTIVE);

  assert.equal(db.state.auditLogs.length, 1);
  const auditLog = db.state.auditLogs[0] as { data: { action: string } };
  assert.equal(auditLog.data.action, "BANK_ACCOUNT_REACTIVATED");
});

test("reactivateBankAccount rejects an already-active account", async () => {
  const db = createDatabase();

  await assert.rejects(
    reactivateBankAccount(reactivateInput, context, db),
    (error) => error instanceof BankAccountError && error.code === "CONFLICT",
  );
});

test("reactivateBankAccount rejects reactivation that would collide with another active account", async () => {
  const db = createDatabase({
    bankAccount: bankAccount({ status: BankAccountStatus.INACTIVE }),
    duplicate: { id: "other-account" },
  });

  await assert.rejects(
    reactivateBankAccount(reactivateInput, context, db),
    (error) => error instanceof BankAccountError && error.code === "CONFLICT",
  );
  assert.equal(db.state.updates.length, 0);
});
