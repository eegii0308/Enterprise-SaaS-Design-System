import { TransactionStatus, type Prisma, type Transaction } from "@prisma/client";
import { prisma } from "../db/client.ts";

export type ExceptionMarkingErrorCode = "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "SERVER";

export class ExceptionMarkingError extends Error {
  readonly code: ExceptionMarkingErrorCode;

  constructor(message: string, code: ExceptionMarkingErrorCode) {
    super(message);
    this.name = "ExceptionMarkingError";
    this.code = code;
  }
}

type ExceptionMarkingContext = {
  organizationId: string;
  userId: string;
};

export type MarkExceptionInput = {
  transactionId: string;
  reason: string;
};

export type ClearExceptionInput = {
  transactionId: string;
};

type TransactionRecord = Pick<Transaction, "id" | "organizationId" | "status">;

type UpdateManyResult = { count: number };

type ExceptionMarkingTransactionClient = {
  transaction: {
    findUnique(args: unknown): Promise<TransactionRecord | null>;
    updateMany(args: unknown): Promise<UpdateManyResult>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type ExceptionMarkingDatabase = {
  $transaction<T>(callback: (tx: ExceptionMarkingTransactionClient) => Promise<T>): Promise<T>;
};

export type MarkExceptionResult = {
  transactionId: string;
  status: TransactionStatus;
};

export type ClearExceptionResult = {
  transactionId: string;
  status: TransactionStatus;
};

function validateMarkInput(input: MarkExceptionInput) {
  if (!input.transactionId) {
    throw new ExceptionMarkingError("transactionId is required.", "VALIDATION");
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new ExceptionMarkingError("An exception reason is required.", "VALIDATION");
  }
}

function validateClearInput(input: ClearExceptionInput) {
  if (!input.transactionId) {
    throw new ExceptionMarkingError("transactionId is required.", "VALIDATION");
  }
}

function assertTransactionAccess(
  transaction: TransactionRecord | null,
  transactionId: string,
  organizationId: string,
): asserts transaction is TransactionRecord {
  if (!transaction) {
    throw new ExceptionMarkingError(`Transaction ${transactionId} was not found.`, "VALIDATION");
  }

  if (transaction.organizationId !== organizationId) {
    throw new ExceptionMarkingError("Transaction does not belong to the current organization.", "FORBIDDEN");
  }
}

function assertMarkable(transaction: TransactionRecord) {
  if (transaction.status !== TransactionStatus.UNMATCHED) {
    throw new ExceptionMarkingError("Only unmatched transactions can be marked as an exception.", "CONFLICT");
  }
}

function assertClearable(transaction: TransactionRecord) {
  if (transaction.status !== TransactionStatus.EXCEPTION) {
    throw new ExceptionMarkingError("Only transactions marked as an exception can be cleared.", "CONFLICT");
  }
}

export async function markTransactionException(
  input: MarkExceptionInput,
  context: ExceptionMarkingContext,
  database: ExceptionMarkingDatabase = prisma as ExceptionMarkingDatabase,
): Promise<MarkExceptionResult> {
  validateMarkInput(input);

  return database.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: input.transactionId },
      select: { id: true, organizationId: true, status: true },
    });

    assertTransactionAccess(transaction, input.transactionId, context.organizationId);
    assertMarkable(transaction);

    const markedAt = new Date();

    // Atomic CAS: only transitions the transaction to EXCEPTION if it is
    // still UNMATCHED at write time, the same guard manuallyMatchTransactions
    // uses when claiming a transaction, so a concurrent manual match cannot
    // race this request onto the same transaction.
    const markResult = await tx.transaction.updateMany({
      where: {
        id: input.transactionId,
        organizationId: context.organizationId,
        status: TransactionStatus.UNMATCHED,
      },
      data: {
        status: TransactionStatus.EXCEPTION,
        exceptionReason: input.reason,
        exceptionMarkedBy: context.userId,
        exceptionMarkedAt: markedAt,
      },
    });

    if (markResult.count !== 1) {
      throw new ExceptionMarkingError(
        "Transaction changed before it could be marked as an exception. Please retry.",
        "CONFLICT",
      );
    }

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "TRANSACTION_EXCEPTION_MARKED",
        resourceType: "transaction",
        resourceId: input.transactionId,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          transactionId: input.transactionId,
          reason: input.reason,
          timestamp: markedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      transactionId: input.transactionId,
      status: TransactionStatus.EXCEPTION,
    };
  });
}

export async function clearTransactionException(
  input: ClearExceptionInput,
  context: ExceptionMarkingContext,
  database: ExceptionMarkingDatabase = prisma as ExceptionMarkingDatabase,
): Promise<ClearExceptionResult> {
  validateClearInput(input);

  return database.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUnique({
      where: { id: input.transactionId },
      select: { id: true, organizationId: true, status: true },
    });

    assertTransactionAccess(transaction, input.transactionId, context.organizationId);
    assertClearable(transaction);

    const clearedAt = new Date();

    // Atomic CAS: only transitions the transaction back to UNMATCHED if it is
    // still EXCEPTION at write time, mirroring the mark CAS above so a
    // concurrent clear of the same transaction cannot double-apply.
    // exceptionReason/exceptionMarkedBy/exceptionMarkedAt are intentionally
    // left out of `data` so they are preserved as history of the original
    // marking, the same pattern reopenReconciliationRun uses for approval history.
    const clearResult = await tx.transaction.updateMany({
      where: {
        id: input.transactionId,
        organizationId: context.organizationId,
        status: TransactionStatus.EXCEPTION,
      },
      data: {
        status: TransactionStatus.UNMATCHED,
        exceptionClearedBy: context.userId,
        exceptionClearedAt: clearedAt,
      },
    });

    if (clearResult.count !== 1) {
      throw new ExceptionMarkingError(
        "Transaction changed before its exception could be cleared. Please retry.",
        "CONFLICT",
      );
    }

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "TRANSACTION_EXCEPTION_CLEARED",
        resourceType: "transaction",
        resourceId: input.transactionId,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          transactionId: input.transactionId,
          timestamp: clearedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      transactionId: input.transactionId,
      status: TransactionStatus.UNMATCHED,
    };
  });
}
