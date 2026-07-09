import {
  ReconciliationMatchStatus,
  ReconciliationMatchType,
  ReconciliationRunStatus,
  SourceType,
  TransactionStatus,
  type Prisma,
  type ReconciliationMatch,
  type ReconciliationRun,
  type Transaction,
} from "@prisma/client";
import { prisma } from "../db/client.ts";

const manualRunName = "Manual reconciliation";

export type ManualMatchErrorCode = "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "SERVER";

export class ManualMatchError extends Error {
  readonly code: ManualMatchErrorCode;

  constructor(message: string, code: ManualMatchErrorCode) {
    super(message);
    this.name = "ManualMatchError";
    this.code = code;
  }
}
type MatchContext = {
  organizationId: string;
  userId: string;
};

export type ManualMatchInput = {
  bankTransactionId: string;
  ledgerTransactionId: string;
};

type TransactionRecord = Pick<
  Transaction,
  "id" | "organizationId" | "sourceType" | "status" | "transactionDate"
>;

type ExistingMatchRecord = Pick<ReconciliationMatch, "id">;
type RunRecord = Pick<ReconciliationRun, "id">;

type ManualMatchTransactionClient = {
  transaction: {
    findMany(args: unknown): Promise<TransactionRecord[]>;
    update(args: unknown): Promise<unknown>;
  };
  reconciliationMatch: {
    findFirst(args: unknown): Promise<ExistingMatchRecord | null>;
    create(args: unknown): Promise<Pick<ReconciliationMatch, "id">>;
  };
  reconciliationRun: {
    findFirst(args: unknown): Promise<RunRecord | null>;
    create(args: unknown): Promise<RunRecord>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type ManualMatchDatabase = {
  $transaction<T>(callback: (tx: ManualMatchTransactionClient) => Promise<T>): Promise<T>;
};

export type ManualMatchResult = {
  reconciliationMatchId: string;
  bankTransactionId: string;
  ledgerTransactionId: string;
};

function validateInput(input: ManualMatchInput) {
  if (!input.bankTransactionId || !input.ledgerTransactionId) {
    throw new ManualMatchError("Both bankTransactionId and ledgerTransactionId are required.", "VALIDATION");
  }

  if (input.bankTransactionId === input.ledgerTransactionId) {
    throw new ManualMatchError("Bank and ledger transactions must be different records.", "VALIDATION");
  }
}

function transactionById(transactions: TransactionRecord[], transactionId: string) {
  return transactions.find((transaction) => transaction.id === transactionId) ?? null;
}

function assertTransactionAccess(
  transaction: TransactionRecord | null,
  transactionId: string,
  organizationId: string,
): asserts transaction is TransactionRecord {
  if (!transaction) {
    throw new ManualMatchError(`Transaction ${transactionId} was not found.`, "VALIDATION");
  }

  if (transaction.organizationId !== organizationId) {
    throw new ManualMatchError("Transaction does not belong to the current organization.", "FORBIDDEN");
  }
}

function assertSourceTypes(bankTransaction: TransactionRecord, ledgerTransaction: TransactionRecord) {
  if (bankTransaction.sourceType !== SourceType.BANK || ledgerTransaction.sourceType !== SourceType.LEDGER) {
    throw new ManualMatchError("Manual matching requires one BANK transaction and one LEDGER transaction.", "VALIDATION");
  }
}

function assertUnmatched(bankTransaction: TransactionRecord, ledgerTransaction: TransactionRecord) {
  if (bankTransaction.status !== TransactionStatus.UNMATCHED || ledgerTransaction.status !== TransactionStatus.UNMATCHED) {
    throw new ManualMatchError("Both transactions must be unmatched before creating a manual match.", "CONFLICT");
  }
}

async function findOrCreateManualRun(
  tx: ManualMatchTransactionClient,
  context: MatchContext,
  bankTransaction: TransactionRecord,
  ledgerTransaction: TransactionRecord,
) {
  const existingRun = await tx.reconciliationRun.findFirst({
    where: {
      organizationId: context.organizationId,
      name: manualRunName,
      status: { in: [ReconciliationRunStatus.DRAFT, ReconciliationRunStatus.IN_PROGRESS, ReconciliationRunStatus.REOPENED] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existingRun) {
    return existingRun;
  }

  const periodStart =
    bankTransaction.transactionDate < ledgerTransaction.transactionDate
      ? bankTransaction.transactionDate
      : ledgerTransaction.transactionDate;
  const periodEnd =
    bankTransaction.transactionDate > ledgerTransaction.transactionDate
      ? bankTransaction.transactionDate
      : ledgerTransaction.transactionDate;

  return tx.reconciliationRun.create({
    data: {
      organizationId: context.organizationId,
      name: manualRunName,
      periodStart,
      periodEnd,
      status: ReconciliationRunStatus.IN_PROGRESS,
      createdBy: context.userId,
    },
    select: { id: true },
  });
}

export async function manuallyMatchTransactions(
  input: ManualMatchInput,
  context: MatchContext,
  database: ManualMatchDatabase = prisma as ManualMatchDatabase,
): Promise<ManualMatchResult> {
  validateInput(input);

  return database.$transaction(async (tx) => {
    const transactions = await tx.transaction.findMany({
      where: {
        id: { in: [input.bankTransactionId, input.ledgerTransactionId] },
      },
      select: {
        id: true,
        organizationId: true,
        sourceType: true,
        status: true,
        transactionDate: true,
      },
    });

    const bankTransaction = transactionById(transactions, input.bankTransactionId);
    const ledgerTransaction = transactionById(transactions, input.ledgerTransactionId);

    assertTransactionAccess(bankTransaction, input.bankTransactionId, context.organizationId);
    assertTransactionAccess(ledgerTransaction, input.ledgerTransactionId, context.organizationId);
    assertSourceTypes(bankTransaction, ledgerTransaction);
    assertUnmatched(bankTransaction, ledgerTransaction);

    const existingMatch = await tx.reconciliationMatch.findFirst({
      where: {
        organizationId: context.organizationId,
        status: { not: ReconciliationMatchStatus.REMOVED },
        OR: [
          { bankTransactionId: { in: [input.bankTransactionId, input.ledgerTransactionId] } },
          { ledgerTransactionId: { in: [input.bankTransactionId, input.ledgerTransactionId] } },
        ],
      },
      select: { id: true },
    });

    if (existingMatch) {
      throw new ManualMatchError("One or both transactions are already matched.", "CONFLICT");
    }

    const reconciliationRun = await findOrCreateManualRun(tx, context, bankTransaction, ledgerTransaction);
    const createdAt = new Date();
    const match = await tx.reconciliationMatch.create({
      data: {
        organizationId: context.organizationId,
        reconciliationRunId: reconciliationRun.id,
        bankTransactionId: input.bankTransactionId,
        ledgerTransactionId: input.ledgerTransactionId,
        matchType: ReconciliationMatchType.MANUAL,
        status: ReconciliationMatchStatus.CONFIRMED,
        createdBy: context.userId,
        createdAt,
      },
      select: { id: true },
    });

    await tx.transaction.update({
      where: { id: input.bankTransactionId },
      data: { status: TransactionStatus.MATCHED },
    });
    await tx.transaction.update({
      where: { id: input.ledgerTransactionId },
      data: { status: TransactionStatus.MATCHED },
    });
    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "RECONCILIATION_MATCH_CREATED",
        resourceType: "reconciliationMatch",
        resourceId: match.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          reconciliationMatchId: match.id,
          bankTransactionId: input.bankTransactionId,
          ledgerTransactionId: input.ledgerTransactionId,
          timestamp: createdAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      reconciliationMatchId: match.id,
      bankTransactionId: input.bankTransactionId,
      ledgerTransactionId: input.ledgerTransactionId,
    };
  });
}
