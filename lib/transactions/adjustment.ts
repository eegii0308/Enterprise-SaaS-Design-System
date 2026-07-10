import {
  Prisma,
  ReconciliationMatchStatus,
  ReconciliationRunStatus,
  type ReconciliationMatch,
  type ReconciliationRun,
  type Transaction,
} from "@prisma/client";
import { prisma } from "../db/client.ts";

export type TransactionAdjustmentErrorCode = "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "SERVER";

export class TransactionAdjustmentError extends Error {
  readonly code: TransactionAdjustmentErrorCode;

  constructor(message: string, code: TransactionAdjustmentErrorCode) {
    super(message);
    this.name = "TransactionAdjustmentError";
    this.code = code;
  }
}

// The set of Transaction columns a correction workflow is allowed to touch.
// Deliberately excludes identity/lineage fields (externalFingerprint,
// sourceType, bankAccountId, importBatchId) and status/exception fields,
// which are owned by the import and reconciliation services respectively.
export const ADJUSTABLE_FIELDS = ["description", "vendor", "reference", "currency", "amount", "transactionDate"] as const;

export type AdjustableTransactionField = (typeof ADJUSTABLE_FIELDS)[number];

function isAdjustableField(value: string): value is AdjustableTransactionField {
  return (ADJUSTABLE_FIELDS as readonly string[]).includes(value);
}

type TransactionAdjustmentContext = {
  organizationId: string;
  userId: string;
};

export type AdjustTransactionInput = {
  transactionId: string;
  fieldName: string;
  newValue: string;
  reason: string;
};

type TransactionRecord = Pick<
  Transaction,
  "id" | "organizationId" | "description" | "vendor" | "reference" | "currency" | "amount" | "transactionDate"
>;

type MatchRecord = Pick<ReconciliationMatch, "id" | "reconciliationRunId">;
type RunRecord = Pick<ReconciliationRun, "id" | "status">;

type UpdateManyResult = { count: number };

type TransactionAdjustmentTransactionClient = {
  transaction: {
    findUnique(args: unknown): Promise<TransactionRecord | null>;
    updateMany(args: unknown): Promise<UpdateManyResult>;
  };
  reconciliationMatch: {
    findFirst(args: unknown): Promise<MatchRecord | null>;
  };
  reconciliationRun: {
    findUnique(args: unknown): Promise<RunRecord | null>;
  };
  transactionAdjustment: {
    create(args: unknown): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type TransactionAdjustmentDatabase = {
  $transaction<T>(callback: (tx: TransactionAdjustmentTransactionClient) => Promise<T>): Promise<T>;
};

export type AdjustTransactionResult = {
  transactionAdjustmentId: string;
  transactionId: string;
  fieldName: AdjustableTransactionField;
  oldValue: string;
  newValue: string;
};

const lockedRunStatuses: ReconciliationRunStatus[] = [ReconciliationRunStatus.READY_FOR_REVIEW, ReconciliationRunStatus.APPROVED];

function validateInput(input: AdjustTransactionInput) {
  if (!input.transactionId) {
    throw new TransactionAdjustmentError("transactionId is required.", "VALIDATION");
  }

  if (!isAdjustableField(input.fieldName)) {
    throw new TransactionAdjustmentError(`Field "${input.fieldName}" cannot be adjusted.`, "VALIDATION");
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new TransactionAdjustmentError("An adjustment reason is required.", "VALIDATION");
  }
}

function assertTransactionAccess(
  transaction: TransactionRecord | null,
  transactionId: string,
  organizationId: string,
): asserts transaction is TransactionRecord {
  if (!transaction) {
    throw new TransactionAdjustmentError(`Transaction ${transactionId} was not found.`, "VALIDATION");
  }

  if (transaction.organizationId !== organizationId) {
    throw new TransactionAdjustmentError("Transaction does not belong to the current organization.", "FORBIDDEN");
  }
}

// Mirrors manuallyMatchTransactions/removeManualMatch's run-lock guard: once a
// confirmed match's reconciliation run has been submitted for review or
// approved, the amounts and descriptions behind that run's tie-out must stay
// frozen, otherwise an approved snapshot (see evaluateApprovalReadiness)
// would silently drift out of sync with the underlying transactions.
async function assertNotLockedByReconciliation(tx: TransactionAdjustmentTransactionClient, transactionId: string) {
  const match = await tx.reconciliationMatch.findFirst({
    where: {
      status: ReconciliationMatchStatus.CONFIRMED,
      OR: [{ bankTransactionId: transactionId }, { ledgerTransactionId: transactionId }],
    },
    select: { id: true, reconciliationRunId: true },
  });

  if (!match) {
    return;
  }

  const run = await tx.reconciliationRun.findUnique({
    where: { id: match.reconciliationRunId },
    select: { id: true, status: true },
  });

  if (run && lockedRunStatuses.includes(run.status)) {
    throw new TransactionAdjustmentError(
      "This transaction cannot be adjusted while its reconciliation run is submitted for review or approved.",
      "CONFLICT",
    );
  }
}

function getCurrentValue(transaction: TransactionRecord, fieldName: AdjustableTransactionField): string {
  switch (fieldName) {
    case "description":
      return transaction.description;
    case "vendor":
      return transaction.vendor ?? "";
    case "reference":
      return transaction.reference ?? "";
    case "currency":
      return transaction.currency;
    case "amount":
      return transaction.amount.toFixed(2);
    case "transactionDate":
      return transaction.transactionDate.toISOString().slice(0, 10);
  }
}

type ParsedAdjustment = {
  storedValue: string;
  data: Prisma.TransactionUpdateManyMutationInput;
};

function parseNewValue(fieldName: AdjustableTransactionField, rawValue: string): ParsedAdjustment {
  const trimmed = (rawValue ?? "").trim();

  switch (fieldName) {
    case "description": {
      if (!trimmed) {
        throw new TransactionAdjustmentError("Description is required.", "VALIDATION");
      }
      return { storedValue: trimmed, data: { description: trimmed } };
    }
    case "vendor": {
      return { storedValue: trimmed, data: { vendor: trimmed || null } };
    }
    case "reference": {
      return { storedValue: trimmed, data: { reference: trimmed || null } };
    }
    case "currency": {
      if (!trimmed) {
        throw new TransactionAdjustmentError("Currency is required.", "VALIDATION");
      }
      const currency = trimmed.toUpperCase();
      return { storedValue: currency, data: { currency } };
    }
    case "amount": {
      if (!trimmed || !/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
        throw new TransactionAdjustmentError("Amount must be a number with up to 2 decimal places.", "VALIDATION");
      }
      const amount = new Prisma.Decimal(trimmed);
      const debitAmount = amount.isNegative() ? amount.abs() : new Prisma.Decimal(0);
      const creditAmount = amount.isNegative() ? new Prisma.Decimal(0) : amount;
      return { storedValue: amount.toFixed(2), data: { amount, debitAmount, creditAmount } };
    }
    case "transactionDate": {
      const date = trimmed ? new Date(`${trimmed}T00:00:00.000Z`) : null;
      if (!date || Number.isNaN(date.getTime())) {
        throw new TransactionAdjustmentError("Transaction date must be a valid date.", "VALIDATION");
      }
      return { storedValue: trimmed, data: { transactionDate: date } };
    }
  }
}

function buildCasWhere(
  transaction: TransactionRecord,
  fieldName: AdjustableTransactionField,
  organizationId: string,
): Prisma.TransactionWhereInput {
  const base = { id: transaction.id, organizationId };

  switch (fieldName) {
    case "description":
      return { ...base, description: transaction.description };
    case "vendor":
      return { ...base, vendor: transaction.vendor };
    case "reference":
      return { ...base, reference: transaction.reference };
    case "currency":
      return { ...base, currency: transaction.currency };
    case "amount":
      return { ...base, amount: transaction.amount };
    case "transactionDate":
      return { ...base, transactionDate: transaction.transactionDate };
  }
}

export async function adjustTransaction(
  input: AdjustTransactionInput,
  context: TransactionAdjustmentContext,
  database: TransactionAdjustmentDatabase = prisma as unknown as TransactionAdjustmentDatabase,
): Promise<AdjustTransactionResult> {
  validateInput(input);
  const fieldName = input.fieldName as AdjustableTransactionField;
  const parsed = parseNewValue(fieldName, input.newValue);

  return database.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: input.transactionId },
      select: {
        id: true,
        organizationId: true,
        description: true,
        vendor: true,
        reference: true,
        currency: true,
        amount: true,
        transactionDate: true,
      },
    });

    assertTransactionAccess(transaction, input.transactionId, context.organizationId);
    await assertNotLockedByReconciliation(tx, transaction.id);

    const oldValue = getCurrentValue(transaction, fieldName);

    if (oldValue === parsed.storedValue) {
      throw new TransactionAdjustmentError("New value must be different from the current value.", "VALIDATION");
    }

    const adjustedAt = new Date();

    // Atomic CAS: only applies the update if the field still holds the value
    // this request read, mirroring the updateMany CAS pattern used throughout
    // lib/reconciliation (e.g. markTransactionException, manuallyMatchTransactions)
    // so a concurrent adjustment to the same field cannot silently overwrite
    // this one's preserved oldValue with a stale snapshot.
    const updateResult = await tx.transaction.updateMany({
      where: buildCasWhere(transaction, fieldName, context.organizationId),
      data: parsed.data,
    });

    if (updateResult.count !== 1) {
      throw new TransactionAdjustmentError(
        "Transaction changed before the adjustment could be applied. Please retry.",
        "CONFLICT",
      );
    }

    const adjustment = await tx.transactionAdjustment.create({
      data: {
        organizationId: context.organizationId,
        transactionId: transaction.id,
        fieldName,
        oldValue,
        newValue: parsed.storedValue,
        reason: input.reason.trim(),
        createdBy: context.userId,
        createdAt: adjustedAt,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "TRANSACTION_ADJUSTED",
        resourceType: "transaction",
        resourceId: transaction.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          transactionId: transaction.id,
          transactionAdjustmentId: adjustment.id,
          fieldName,
          oldValue,
          newValue: parsed.storedValue,
          reason: input.reason.trim(),
          timestamp: adjustedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      transactionAdjustmentId: adjustment.id,
      transactionId: transaction.id,
      fieldName,
      oldValue,
      newValue: parsed.storedValue,
    };
  });
}
