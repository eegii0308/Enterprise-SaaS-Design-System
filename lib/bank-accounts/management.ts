import { Prisma, type BankAccount } from "@prisma/client";
import { prisma } from "../db/client.ts";

export type BankAccountErrorCode = "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "SERVER";

export class BankAccountError extends Error {
  readonly code: BankAccountErrorCode;

  constructor(message: string, code: BankAccountErrorCode) {
    super(message);
    this.name = "BankAccountError";
    this.code = code;
  }
}

type BankAccountContext = {
  organizationId: string;
  userId: string;
};

// Kept as plain string constants (not a Prisma enum) because BankAccount.status
// is a plain String column, matching the existing convention elsewhere in this
// schema (e.g. Organization/Membership use enums, but this field predates that).
export const BankAccountStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type CreateBankAccountInput = {
  name: string;
  bankName: string;
  maskedAccountNumber: string;
  currency: string;
};

export type UpdateBankAccountInput = {
  bankAccountId: string;
  name: string;
  bankName: string;
  maskedAccountNumber: string;
  currency: string;
};

export type ArchiveBankAccountInput = {
  bankAccountId: string;
};

export type ReactivateBankAccountInput = {
  bankAccountId: string;
};

type BankAccountRecord = Pick<BankAccount, "id" | "organizationId" | "status" | "bankName" | "maskedAccountNumber">;

type DuplicateAccountRecord = Pick<BankAccount, "id">;

type UpdateManyResult = { count: number };

type BankAccountTransactionClient = {
  bankAccount: {
    findUnique(args: unknown): Promise<BankAccountRecord | null>;
    findFirst(args: unknown): Promise<DuplicateAccountRecord | null>;
    create(args: unknown): Promise<Pick<BankAccount, "id" | "status">>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<UpdateManyResult>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type BankAccountDatabase = {
  $transaction<T>(callback: (tx: BankAccountTransactionClient) => Promise<T>): Promise<T>;
};

export type BankAccountResult = {
  bankAccountId: string;
  status: string;
};

function normalizeCurrency(currency: string) {
  return (currency ?? "").trim().toUpperCase();
}

function validateFields(input: { name: string; bankName: string; maskedAccountNumber: string; currency: string }) {
  if (!input.name || input.name.trim().length === 0) {
    throw new BankAccountError("A bank account name is required.", "VALIDATION");
  }

  if (!input.bankName || input.bankName.trim().length === 0) {
    throw new BankAccountError("A bank name is required.", "VALIDATION");
  }

  if (!input.maskedAccountNumber || input.maskedAccountNumber.trim().length === 0) {
    throw new BankAccountError("A masked account number is required.", "VALIDATION");
  }

  const currency = normalizeCurrency(input.currency);
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BankAccountError("Currency must be a 3-letter currency code (e.g. MNT, USD).", "VALIDATION");
  }
}

function assertBankAccountAccess(
  bankAccount: BankAccountRecord | null,
  bankAccountId: string,
  organizationId: string,
): asserts bankAccount is BankAccountRecord {
  if (!bankAccount) {
    throw new BankAccountError(`Bank account ${bankAccountId} was not found.`, "VALIDATION");
  }

  if (bankAccount.organizationId !== organizationId) {
    throw new BankAccountError("Bank account does not belong to the current organization.", "FORBIDDEN");
  }
}

function assertArchivable(bankAccount: BankAccountRecord) {
  if (bankAccount.status !== BankAccountStatus.ACTIVE) {
    throw new BankAccountError("Only active bank accounts can be archived.", "CONFLICT");
  }
}

function assertReactivatable(bankAccount: BankAccountRecord) {
  if (bankAccount.status !== BankAccountStatus.INACTIVE) {
    throw new BankAccountError("Only archived bank accounts can be reactivated.", "CONFLICT");
  }
}

async function assertNoActiveDuplicate(
  tx: BankAccountTransactionClient,
  organizationId: string,
  bankName: string,
  maskedAccountNumber: string,
  excludeBankAccountId?: string,
) {
  // Two active bank accounts sharing the same bank and account number would
  // make it ambiguous which one a reconciliation run or imported transaction
  // is scoped to, so only one may be active at a time. Archived accounts are
  // excluded so a re-added account never collides with its own history. This
  // mirrors the DB-level partial unique index added in the Phase 7D
  // migration; the check here exists to surface a clean CONFLICT error
  // instead of a raw constraint violation.
  const duplicate = await tx.bankAccount.findFirst({
    where: {
      organizationId,
      bankName,
      maskedAccountNumber,
      status: BankAccountStatus.ACTIVE,
      ...(excludeBankAccountId ? { id: { not: excludeBankAccountId } } : {}),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new BankAccountError("An active bank account with this bank name and account number already exists.", "CONFLICT");
  }
}

export async function createBankAccount(
  input: CreateBankAccountInput,
  context: BankAccountContext,
  database: BankAccountDatabase = prisma as BankAccountDatabase,
): Promise<BankAccountResult> {
  validateFields(input);

  const name = input.name.trim();
  const bankName = input.bankName.trim();
  const maskedAccountNumber = input.maskedAccountNumber.trim();
  const currency = normalizeCurrency(input.currency);

  return database.$transaction(async (tx) => {
    await assertNoActiveDuplicate(tx, context.organizationId, bankName, maskedAccountNumber);

    const bankAccount = await tx.bankAccount.create({
      data: {
        organizationId: context.organizationId,
        name,
        bankName,
        maskedAccountNumber,
        currency,
        status: BankAccountStatus.ACTIVE,
      },
      select: { id: true, status: true },
    });

    const createdAt = new Date();
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "BANK_ACCOUNT_CREATED",
        resourceType: "bankAccount",
        resourceId: bankAccount.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          bankAccountId: bankAccount.id,
          bankName,
          maskedAccountNumber,
          currency,
          timestamp: createdAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { bankAccountId: bankAccount.id, status: bankAccount.status };
  });
}

export async function updateBankAccount(
  input: UpdateBankAccountInput,
  context: BankAccountContext,
  database: BankAccountDatabase = prisma as BankAccountDatabase,
): Promise<BankAccountResult> {
  if (!input.bankAccountId) {
    throw new BankAccountError("bankAccountId is required.", "VALIDATION");
  }
  validateFields(input);

  const name = input.name.trim();
  const bankName = input.bankName.trim();
  const maskedAccountNumber = input.maskedAccountNumber.trim();
  const currency = normalizeCurrency(input.currency);

  return database.$transaction(async (tx) => {
    const bankAccount = await tx.bankAccount.findUnique({
      where: { id: input.bankAccountId },
      select: { id: true, organizationId: true, status: true, bankName: true, maskedAccountNumber: true },
    });

    assertBankAccountAccess(bankAccount, input.bankAccountId, context.organizationId);

    if (bankAccount.status === BankAccountStatus.ACTIVE) {
      await assertNoActiveDuplicate(tx, context.organizationId, bankName, maskedAccountNumber, bankAccount.id);
    }

    await tx.bankAccount.update({
      where: { id: bankAccount.id },
      data: { name, bankName, maskedAccountNumber, currency },
    });

    const updatedAt = new Date();
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "BANK_ACCOUNT_UPDATED",
        resourceType: "bankAccount",
        resourceId: bankAccount.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          bankAccountId: bankAccount.id,
          bankName,
          maskedAccountNumber,
          currency,
          timestamp: updatedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { bankAccountId: bankAccount.id, status: bankAccount.status };
  });
}

export async function archiveBankAccount(
  input: ArchiveBankAccountInput,
  context: BankAccountContext,
  database: BankAccountDatabase = prisma as BankAccountDatabase,
): Promise<BankAccountResult> {
  if (!input.bankAccountId) {
    throw new BankAccountError("bankAccountId is required.", "VALIDATION");
  }

  return database.$transaction(async (tx) => {
    const bankAccount = await tx.bankAccount.findUnique({
      where: { id: input.bankAccountId },
      select: { id: true, organizationId: true, status: true, bankName: true, maskedAccountNumber: true },
    });

    assertBankAccountAccess(bankAccount, input.bankAccountId, context.organizationId);
    assertArchivable(bankAccount);

    // CAS: only archives if the account is still active at write time, so a
    // concurrent archive request cannot double-apply.
    const archiveResult = await tx.bankAccount.updateMany({
      where: { id: bankAccount.id, organizationId: context.organizationId, status: BankAccountStatus.ACTIVE },
      data: { status: BankAccountStatus.INACTIVE },
    });

    if (archiveResult.count === 0) {
      throw new BankAccountError("Bank account changed before it could be archived. Please retry.", "CONFLICT");
    }

    const archivedAt = new Date();
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "BANK_ACCOUNT_ARCHIVED",
        resourceType: "bankAccount",
        resourceId: bankAccount.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          bankAccountId: bankAccount.id,
          timestamp: archivedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { bankAccountId: bankAccount.id, status: BankAccountStatus.INACTIVE };
  });
}

export async function reactivateBankAccount(
  input: ReactivateBankAccountInput,
  context: BankAccountContext,
  database: BankAccountDatabase = prisma as BankAccountDatabase,
): Promise<BankAccountResult> {
  if (!input.bankAccountId) {
    throw new BankAccountError("bankAccountId is required.", "VALIDATION");
  }

  return database.$transaction(async (tx) => {
    const bankAccount = await tx.bankAccount.findUnique({
      where: { id: input.bankAccountId },
      select: { id: true, organizationId: true, status: true, bankName: true, maskedAccountNumber: true },
    });

    assertBankAccountAccess(bankAccount, input.bankAccountId, context.organizationId);
    assertReactivatable(bankAccount);
    await assertNoActiveDuplicate(tx, context.organizationId, bankAccount.bankName, bankAccount.maskedAccountNumber, bankAccount.id);

    // CAS: only reactivates if the account is still archived at write time,
    // so a concurrent reactivation cannot double-apply.
    const reactivateResult = await tx.bankAccount.updateMany({
      where: { id: bankAccount.id, organizationId: context.organizationId, status: BankAccountStatus.INACTIVE },
      data: { status: BankAccountStatus.ACTIVE },
    });

    if (reactivateResult.count === 0) {
      throw new BankAccountError("Bank account changed before it could be reactivated. Please retry.", "CONFLICT");
    }

    const reactivatedAt = new Date();
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "BANK_ACCOUNT_REACTIVATED",
        resourceType: "bankAccount",
        resourceId: bankAccount.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          bankAccountId: bankAccount.id,
          timestamp: reactivatedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return { bankAccountId: bankAccount.id, status: BankAccountStatus.ACTIVE };
  });
}
