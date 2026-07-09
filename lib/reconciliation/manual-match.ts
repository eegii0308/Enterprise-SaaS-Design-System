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
type RunStatusRecord = Pick<ReconciliationRun, "id" | "status">;
type MatchRecord = Pick<
  ReconciliationMatch,
  "id" | "organizationId" | "status" | "bankTransactionId" | "ledgerTransactionId" | "reconciliationRunId"
>;

type UpdateManyResult = { count: number };

type ManualMatchTransactionClient = {
  transaction: {
    findMany(args: unknown): Promise<TransactionRecord[]>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<UpdateManyResult>;
  };
  reconciliationMatch: {
    findFirst(args: unknown): Promise<ExistingMatchRecord | null>;
    findUnique(args: unknown): Promise<MatchRecord | null>;
    create(args: unknown): Promise<Pick<ReconciliationMatch, "id">>;
    update(args: unknown): Promise<unknown>;
  };
  reconciliationRun: {
    findFirst(args: unknown): Promise<RunStatusRecord | null>;
    findUnique(args: unknown): Promise<RunStatusRecord | null>;
    create(args: unknown): Promise<RunRecord>;
    updateMany(args: unknown): Promise<UpdateManyResult>;
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

export type RemoveMatchInput = {
  reconciliationMatchId: string;
};

export type RemoveMatchResult = {
  reconciliationMatchId: string;
  bankTransactionId: string;
  ledgerTransactionId: string;
};

function validateRemoveInput(input: RemoveMatchInput) {
  if (!input.reconciliationMatchId) {
    throw new ManualMatchError("reconciliationMatchId is required.", "VALIDATION");
  }
}

function assertMatchAccess(
  match: MatchRecord | null,
  reconciliationMatchId: string,
  organizationId: string,
): asserts match is MatchRecord {
  if (!match) {
    throw new ManualMatchError(`Reconciliation match ${reconciliationMatchId} was not found.`, "VALIDATION");
  }

  if (match.organizationId !== organizationId) {
    throw new ManualMatchError("Reconciliation match does not belong to the current organization.", "FORBIDDEN");
  }
}

function assertRemovable(match: MatchRecord) {
  if (match.status !== ReconciliationMatchStatus.CONFIRMED) {
    throw new ManualMatchError("Only confirmed matches can be removed.", "CONFLICT");
  }
}

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

const lockedRunStatuses: ReconciliationRunStatus[] = [ReconciliationRunStatus.READY_FOR_REVIEW, ReconciliationRunStatus.APPROVED];

async function assertNoRunPendingReview(tx: ManualMatchTransactionClient, context: MatchContext) {
  const pendingRun = await tx.reconciliationRun.findFirst({
    where: {
      organizationId: context.organizationId,
      name: manualRunName,
      status: ReconciliationRunStatus.READY_FOR_REVIEW,
    },
    select: { id: true },
  });

  if (pendingRun) {
    throw new ManualMatchError(
      "A reconciliation run is awaiting approval. New matches cannot be created until it is approved.",
      "CONFLICT",
    );
  }
}

function assertRunNotLocked(run: RunStatusRecord | null) {
  if (run && lockedRunStatuses.includes(run.status)) {
    throw new ManualMatchError(
      "Matches cannot be changed once their reconciliation run is submitted for review or approved.",
      "CONFLICT",
    );
  }
}

const openRunStatuses: ReconciliationRunStatus[] = [
  ReconciliationRunStatus.DRAFT,
  ReconciliationRunStatus.IN_PROGRESS,
  ReconciliationRunStatus.REOPENED,
];

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
      status: { in: openRunStatuses },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });

  if (existingRun) {
    // Status-preserving CAS: locks the run row and re-checks it is still open,
    // so a concurrent submitReconciliationRunForReview cannot slip a match in
    // after (or lose to) the run's transition to READY_FOR_REVIEW.
    const lockResult = await tx.reconciliationRun.updateMany({
      where: {
        id: existingRun.id,
        organizationId: context.organizationId,
        status: existingRun.status,
      },
      data: { status: existingRun.status },
    });

    if (lockResult.count === 0) {
      throw new ManualMatchError(
        "The open reconciliation run changed before this match could be saved. Please retry.",
        "CONFLICT",
      );
    }

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

    await assertNoRunPendingReview(tx, context);

    const reconciliationRun = await findOrCreateManualRun(tx, context, bankTransaction, ledgerTransaction);

    // Atomic CAS: only flips both transactions to MATCHED if they are still
    // UNMATCHED at write time. This is the authoritative guard against two
    // concurrent requests both passing the assertUnmatched/existingMatch
    // checks above and creating duplicate confirmed matches for the same pair.
    const claimResult = await tx.transaction.updateMany({
      where: {
        id: { in: [input.bankTransactionId, input.ledgerTransactionId] },
        organizationId: context.organizationId,
        status: TransactionStatus.UNMATCHED,
      },
      data: { status: TransactionStatus.MATCHED },
    });

    if (claimResult.count !== 2) {
      throw new ManualMatchError("One or both transactions were matched by another request.", "CONFLICT");
    }

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

export async function removeManualMatch(
  input: RemoveMatchInput,
  context: MatchContext,
  database: ManualMatchDatabase = prisma as ManualMatchDatabase,
): Promise<RemoveMatchResult> {
  validateRemoveInput(input);

  return database.$transaction(async (tx) => {
    const match = await tx.reconciliationMatch.findUnique({
      where: { id: input.reconciliationMatchId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        bankTransactionId: true,
        ledgerTransactionId: true,
        reconciliationRunId: true,
      },
    });

    assertMatchAccess(match, input.reconciliationMatchId, context.organizationId);
    assertRemovable(match);

    const run = await tx.reconciliationRun.findUnique({
      where: { id: match.reconciliationRunId },
      select: { id: true, status: true },
    });
    assertRunNotLocked(run);

    const removedAt = new Date();
    await tx.reconciliationMatch.update({
      where: { id: match.id },
      data: {
        status: ReconciliationMatchStatus.REMOVED,
        removedBy: context.userId,
        removedAt,
      },
    });

    await tx.transaction.update({
      where: { id: match.bankTransactionId },
      data: { status: TransactionStatus.UNMATCHED },
    });
    await tx.transaction.update({
      where: { id: match.ledgerTransactionId },
      data: { status: TransactionStatus.UNMATCHED },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "RECONCILIATION_MATCH_REMOVED",
        resourceType: "reconciliationMatch",
        resourceId: match.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          reconciliationMatchId: match.id,
          bankTransactionId: match.bankTransactionId,
          ledgerTransactionId: match.ledgerTransactionId,
          timestamp: removedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      reconciliationMatchId: match.id,
      bankTransactionId: match.bankTransactionId,
      ledgerTransactionId: match.ledgerTransactionId,
    };
  });
}
