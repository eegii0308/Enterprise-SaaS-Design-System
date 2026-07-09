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
    updateMany(args: unknown): Promise<UpdateManyResult>;
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

export type CorrectMatchInput = {
  reconciliationMatchId: string;
  replacementBankTransactionId?: string;
  replacementLedgerTransactionId?: string;
  reason: string;
};

export type CorrectMatchResult = {
  reconciliationMatchId: string;
  correctedFromMatchId: string;
  bankTransactionId: string;
  ledgerTransactionId: string;
};

function validateRemoveInput(input: RemoveMatchInput) {
  if (!input.reconciliationMatchId) {
    throw new ManualMatchError("reconciliationMatchId is required.", "VALIDATION");
  }
}

function validateCorrectInput(input: CorrectMatchInput) {
  if (!input.reconciliationMatchId) {
    throw new ManualMatchError("reconciliationMatchId is required.", "VALIDATION");
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new ManualMatchError("A correction reason is required.", "VALIDATION");
  }

  const hasBankReplacement = Boolean(input.replacementBankTransactionId);
  const hasLedgerReplacement = Boolean(input.replacementLedgerTransactionId);

  if (hasBankReplacement === hasLedgerReplacement) {
    throw new ManualMatchError(
      "Exactly one of replacementBankTransactionId or replacementLedgerTransactionId must be provided.",
      "VALIDATION",
    );
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

function assertCorrectable(match: MatchRecord) {
  if (match.status !== ReconciliationMatchStatus.CONFIRMED) {
    throw new ManualMatchError("Only confirmed matches can be corrected.", "CONFLICT");
  }
}

function assertReplacementTransaction(
  transaction: TransactionRecord | null,
  transactionId: string,
  organizationId: string,
  expectedSourceType: SourceType,
): asserts transaction is TransactionRecord {
  assertTransactionAccess(transaction, transactionId, organizationId);

  if (transaction.sourceType !== expectedSourceType) {
    throw new ManualMatchError(`Replacement transaction must be a ${expectedSourceType} transaction.`, "VALIDATION");
  }

  if (transaction.status !== TransactionStatus.UNMATCHED) {
    throw new ManualMatchError("Replacement transaction must be unmatched.", "CONFLICT");
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

async function assertRunEditable(tx: ManualMatchTransactionClient, run: RunStatusRecord | null, organizationId: string) {
  assertRunNotLocked(run);

  if (!run) {
    return;
  }

  // Status-preserving CAS: locks the run row and re-verifies its status is
  // unchanged, so a concurrent submitReconciliationRunForReview/approval that
  // transitions the run to READY_FOR_REVIEW or APPROVED between the read
  // above and this point cannot let a match removal/correction slip through.
  const lockResult = await tx.reconciliationRun.updateMany({
    where: {
      id: run.id,
      organizationId,
      status: run.status,
    },
    data: { status: run.status },
  });

  if (lockResult.count === 0) {
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
    await assertRunEditable(tx, run, context.organizationId);

    const removedAt = new Date();

    // Atomic CAS: only transitions the match to REMOVED if it is still
    // CONFIRMED at write time, mirroring correctManualMatch's removal CAS so
    // a concurrent correction or removal of the same match cannot both
    // succeed (and so this request cannot revert transaction statuses based
    // on a match that a concurrent correction already replaced).
    const removalResult = await tx.reconciliationMatch.updateMany({
      where: {
        id: match.id,
        status: ReconciliationMatchStatus.CONFIRMED,
      },
      data: {
        status: ReconciliationMatchStatus.REMOVED,
        removedBy: context.userId,
        removedAt,
      },
    });

    if (removalResult.count === 0) {
      throw new ManualMatchError(
        "Reconciliation match changed before it could be removed. Please retry.",
        "CONFLICT",
      );
    }

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

export async function correctManualMatch(
  input: CorrectMatchInput,
  context: MatchContext,
  database: ManualMatchDatabase = prisma as ManualMatchDatabase,
): Promise<CorrectMatchResult> {
  validateCorrectInput(input);

  const replacingBank = Boolean(input.replacementBankTransactionId);
  const replacementTransactionId = (
    replacingBank ? input.replacementBankTransactionId : input.replacementLedgerTransactionId
  ) as string;

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
    assertCorrectable(match);

    const run = await tx.reconciliationRun.findUnique({
      where: { id: match.reconciliationRunId },
      select: { id: true, status: true },
    });
    await assertRunEditable(tx, run, context.organizationId);

    const replacementTransactions = await tx.transaction.findMany({
      where: { id: { in: [replacementTransactionId] } },
      select: {
        id: true,
        organizationId: true,
        sourceType: true,
        status: true,
        transactionDate: true,
      },
    });
    const replacementTransaction = transactionById(replacementTransactions, replacementTransactionId);
    assertReplacementTransaction(
      replacementTransaction,
      replacementTransactionId,
      context.organizationId,
      replacingBank ? SourceType.BANK : SourceType.LEDGER,
    );

    const correctionAt = new Date();

    // CAS: only transitions the match to REMOVED if it is still CONFIRMED at
    // write time, mirroring the run-transition CAS pattern from Phase 6C so a
    // concurrent correction or removal of the same match cannot both succeed.
    const removalResult = await tx.reconciliationMatch.updateMany({
      where: {
        id: match.id,
        organizationId: context.organizationId,
        status: ReconciliationMatchStatus.CONFIRMED,
      },
      data: {
        status: ReconciliationMatchStatus.REMOVED,
        removedBy: context.userId,
        removedAt: correctionAt,
        correctionReason: input.reason,
      },
    });

    if (removalResult.count === 0) {
      throw new ManualMatchError(
        "Reconciliation match changed before the correction could be applied. Please retry.",
        "CONFLICT",
      );
    }

    const replacedTransactionId = replacingBank ? match.bankTransactionId : match.ledgerTransactionId;
    await tx.transaction.update({
      where: { id: replacedTransactionId },
      data: { status: TransactionStatus.UNMATCHED },
    });

    // Atomic CAS: only claims the replacement transaction if it is still
    // UNMATCHED at write time, the same guard used for initial manual matches.
    const claimResult = await tx.transaction.updateMany({
      where: {
        id: replacementTransactionId,
        organizationId: context.organizationId,
        status: TransactionStatus.UNMATCHED,
      },
      data: { status: TransactionStatus.MATCHED },
    });

    if (claimResult.count !== 1) {
      throw new ManualMatchError("Replacement transaction was matched by another request.", "CONFLICT");
    }

    const bankTransactionId = replacingBank ? replacementTransactionId : match.bankTransactionId;
    const ledgerTransactionId = replacingBank ? match.ledgerTransactionId : replacementTransactionId;

    const newMatch = await tx.reconciliationMatch.create({
      data: {
        organizationId: context.organizationId,
        reconciliationRunId: match.reconciliationRunId,
        bankTransactionId,
        ledgerTransactionId,
        matchType: ReconciliationMatchType.MANUAL,
        status: ReconciliationMatchStatus.CONFIRMED,
        createdBy: context.userId,
        createdAt: correctionAt,
        correctedFromMatchId: match.id,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "RECONCILIATION_MATCH_CORRECTED",
        resourceType: "reconciliationMatch",
        resourceId: newMatch.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          correctedFromMatchId: match.id,
          reconciliationMatchId: newMatch.id,
          bankTransactionId,
          ledgerTransactionId,
          reason: input.reason,
          timestamp: correctionAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      reconciliationMatchId: newMatch.id,
      correctedFromMatchId: match.id,
      bankTransactionId,
      ledgerTransactionId,
    };
  });
}
