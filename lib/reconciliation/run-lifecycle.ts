import {
  ReconciliationMatchStatus,
  ReconciliationRunStatus,
  type Prisma,
  type BankAccount,
  type ReconciliationRun,
} from "@prisma/client";
import { prisma } from "../db/client.ts";

export type RunLifecycleErrorCode = "VALIDATION" | "FORBIDDEN" | "CONFLICT" | "SERVER";

export class RunLifecycleError extends Error {
  readonly code: RunLifecycleErrorCode;

  constructor(message: string, code: RunLifecycleErrorCode) {
    super(message);
    this.name = "RunLifecycleError";
    this.code = code;
  }
}

type LifecycleContext = {
  organizationId: string;
  userId: string;
};

export type CreateRunInput = {
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
  name: string;
};

export type SubmitRunInput = {
  reconciliationRunId: string;
};

export type ApproveRunInput = {
  reconciliationRunId: string;
};

export type ReopenRunInput = {
  reconciliationRunId: string;
  reason: string;
};

type RunRecord = Pick<ReconciliationRun, "id" | "organizationId" | "status">;

type BankAccountRecord = Pick<BankAccount, "id" | "organizationId" | "status">;

type OverlappingRunRecord = Pick<ReconciliationRun, "id">;

type UpdateManyResult = { count: number };

type RunLifecycleTransactionClient = {
  bankAccount: {
    findUnique(args: unknown): Promise<BankAccountRecord | null>;
  };
  reconciliationRun: {
    findFirst(args: unknown): Promise<OverlappingRunRecord | null>;
    findUnique(args: unknown): Promise<RunRecord | null>;
    create(args: unknown): Promise<Pick<ReconciliationRun, "id" | "status">>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<UpdateManyResult>;
  };
  reconciliationMatch: {
    count(args: unknown): Promise<number>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

export type RunLifecycleDatabase = {
  $transaction<T>(callback: (tx: RunLifecycleTransactionClient) => Promise<T>): Promise<T>;
};

export type CreateRunResult = {
  reconciliationRunId: string;
  status: ReconciliationRunStatus;
};

export type SubmitRunResult = {
  reconciliationRunId: string;
  status: ReconciliationRunStatus;
};

export type ApproveRunResult = {
  reconciliationRunId: string;
  status: ReconciliationRunStatus;
};

export type ReopenRunResult = {
  reconciliationRunId: string;
  status: ReconciliationRunStatus;
};

// A reconciliation run is "open" for the duration between explicit creation
// and submission for review; only one open run may exist per bank account
// per overlapping period, so the workspace never has to guess which run a
// newly imported transaction belongs to.
export const openRunStatuses: ReconciliationRunStatus[] = [
  ReconciliationRunStatus.DRAFT,
  ReconciliationRunStatus.IN_PROGRESS,
  ReconciliationRunStatus.REOPENED,
];

function validateCreateInput(input: CreateRunInput) {
  if (!input.bankAccountId) {
    throw new RunLifecycleError("bankAccountId is required.", "VALIDATION");
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new RunLifecycleError("A reconciliation run name is required.", "VALIDATION");
  }

  if (Number.isNaN(input.periodStart.getTime()) || Number.isNaN(input.periodEnd.getTime())) {
    throw new RunLifecycleError("A valid period start and end date are required.", "VALIDATION");
  }

  if (input.periodStart.getTime() > input.periodEnd.getTime()) {
    throw new RunLifecycleError("The period start date must not be after the period end date.", "VALIDATION");
  }
}

function assertBankAccountAccess(
  bankAccount: BankAccountRecord | null,
  bankAccountId: string,
  organizationId: string,
): asserts bankAccount is BankAccountRecord {
  if (!bankAccount) {
    throw new RunLifecycleError(`Bank account ${bankAccountId} was not found.`, "VALIDATION");
  }

  if (bankAccount.organizationId !== organizationId) {
    throw new RunLifecycleError("Bank account does not belong to the current organization.", "FORBIDDEN");
  }

  if (bankAccount.status !== "active") {
    throw new RunLifecycleError("Bank account is not active.", "VALIDATION");
  }
}

export async function createReconciliationRun(
  input: CreateRunInput,
  context: LifecycleContext,
  database: RunLifecycleDatabase = prisma as RunLifecycleDatabase,
): Promise<CreateRunResult> {
  validateCreateInput(input);

  return database.$transaction(async (tx) => {
    const bankAccount = await tx.bankAccount.findUnique({
      where: { id: input.bankAccountId },
      select: { id: true, organizationId: true, status: true },
    });

    assertBankAccountAccess(bankAccount, input.bankAccountId, context.organizationId);

    // A bank account should not have two open (unsubmitted) runs covering
    // overlapping periods at once; that would make it ambiguous which run a
    // given bank transaction belongs to while both are in progress.
    const overlappingRun = await tx.reconciliationRun.findFirst({
      where: {
        organizationId: context.organizationId,
        bankAccountId: input.bankAccountId,
        status: { in: openRunStatuses },
        periodStart: { lte: input.periodEnd },
        periodEnd: { gte: input.periodStart },
      },
      select: { id: true },
    });

    if (overlappingRun) {
      throw new RunLifecycleError(
        "An open reconciliation run already exists for this bank account with an overlapping period.",
        "CONFLICT",
      );
    }

    const createdAt = new Date();
    const run = await tx.reconciliationRun.create({
      data: {
        organizationId: context.organizationId,
        bankAccountId: input.bankAccountId,
        name: input.name,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: ReconciliationRunStatus.DRAFT,
        createdBy: context.userId,
        createdAt,
      },
      select: { id: true, status: true },
    });

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "RECONCILIATION_RUN_CREATED",
        resourceType: "reconciliationRun",
        resourceId: run.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          reconciliationRunId: run.id,
          bankAccountId: input.bankAccountId,
          periodStart: input.periodStart.toISOString(),
          periodEnd: input.periodEnd.toISOString(),
          timestamp: createdAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      reconciliationRunId: run.id,
      status: run.status,
    };
  });
}

function validateRunId(reconciliationRunId: string) {
  if (!reconciliationRunId) {
    throw new RunLifecycleError("reconciliationRunId is required.", "VALIDATION");
  }
}

function assertRunAccess(
  run: RunRecord | null,
  reconciliationRunId: string,
  organizationId: string,
): asserts run is RunRecord {
  if (!run) {
    throw new RunLifecycleError(`Reconciliation run ${reconciliationRunId} was not found.`, "VALIDATION");
  }

  if (run.organizationId !== organizationId) {
    throw new RunLifecycleError("Reconciliation run does not belong to the current organization.", "FORBIDDEN");
  }
}

function assertSubmittable(run: RunRecord) {
  if (!openRunStatuses.includes(run.status)) {
    throw new RunLifecycleError("Only draft, in-progress, or reopened runs can be submitted for review.", "CONFLICT");
  }
}

function assertApprovable(run: RunRecord) {
  if (run.status !== ReconciliationRunStatus.READY_FOR_REVIEW) {
    throw new RunLifecycleError("Only runs that are ready for review can be approved.", "CONFLICT");
  }
}

function validateReopenInput(input: ReopenRunInput) {
  validateRunId(input.reconciliationRunId);

  if (!input.reason || input.reason.trim().length === 0) {
    throw new RunLifecycleError("A reopen reason is required.", "VALIDATION");
  }
}

function assertReopenable(run: RunRecord) {
  if (run.status !== ReconciliationRunStatus.APPROVED) {
    throw new RunLifecycleError("Only approved runs can be reopened.", "CONFLICT");
  }
}

export async function submitReconciliationRunForReview(
  input: SubmitRunInput,
  context: LifecycleContext,
  database: RunLifecycleDatabase = prisma as RunLifecycleDatabase,
): Promise<SubmitRunResult> {
  validateRunId(input.reconciliationRunId);

  return database.$transaction(async (tx) => {
    const run = await tx.reconciliationRun.findUnique({
      where: { id: input.reconciliationRunId },
      select: { id: true, organizationId: true, status: true },
    });

    assertRunAccess(run, input.reconciliationRunId, context.organizationId);
    assertSubmittable(run);

    const confirmedMatchCount = await tx.reconciliationMatch.count({
      where: {
        organizationId: context.organizationId,
        reconciliationRunId: run.id,
        status: ReconciliationMatchStatus.CONFIRMED,
      },
    });

    if (confirmedMatchCount === 0) {
      throw new RunLifecycleError("A run needs at least one confirmed match before it can be submitted for review.", "VALIDATION");
    }

    const submittedAt = new Date();
    // CAS keyed on the previously read status: contends on the same run row
    // as assertRunEditable's lock-touch in manual-match.ts, so a concurrent
    // submit and a concurrent manual match cannot both win.
    const transitionResult = await tx.reconciliationRun.updateMany({
      where: {
        id: run.id,
        organizationId: context.organizationId,
        status: { in: openRunStatuses },
      },
      data: { status: ReconciliationRunStatus.READY_FOR_REVIEW },
    });

    if (transitionResult.count === 0) {
      throw new RunLifecycleError(
        "Reconciliation run status changed before submission completed. Please retry.",
        "CONFLICT",
      );
    }

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "RECONCILIATION_RUN_SUBMITTED",
        resourceType: "reconciliationRun",
        resourceId: run.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          reconciliationRunId: run.id,
          timestamp: submittedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      reconciliationRunId: run.id,
      status: ReconciliationRunStatus.READY_FOR_REVIEW,
    };
  });
}

export async function approveReconciliationRun(
  input: ApproveRunInput,
  context: LifecycleContext,
  database: RunLifecycleDatabase = prisma as RunLifecycleDatabase,
): Promise<ApproveRunResult> {
  validateRunId(input.reconciliationRunId);

  return database.$transaction(async (tx) => {
    const run = await tx.reconciliationRun.findUnique({
      where: { id: input.reconciliationRunId },
      select: { id: true, organizationId: true, status: true },
    });

    assertRunAccess(run, input.reconciliationRunId, context.organizationId);
    assertApprovable(run);

    const approvedAt = new Date();
    // CAS keyed on READY_FOR_REVIEW: guards against two concurrent approvals
    // (or an approval racing a reopen) both succeeding for the same run.
    const approvalResult = await tx.reconciliationRun.updateMany({
      where: {
        id: run.id,
        organizationId: context.organizationId,
        status: ReconciliationRunStatus.READY_FOR_REVIEW,
      },
      data: {
        status: ReconciliationRunStatus.APPROVED,
        approvedBy: context.userId,
        approvedAt,
        completedAt: approvedAt,
      },
    });

    if (approvalResult.count === 0) {
      throw new RunLifecycleError(
        "Reconciliation run was already approved or is no longer ready for review.",
        "CONFLICT",
      );
    }

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "RECONCILIATION_RUN_APPROVED",
        resourceType: "reconciliationRun",
        resourceId: run.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          reconciliationRunId: run.id,
          timestamp: approvedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      reconciliationRunId: run.id,
      status: ReconciliationRunStatus.APPROVED,
    };
  });
}

export async function reopenReconciliationRun(
  input: ReopenRunInput,
  context: LifecycleContext,
  database: RunLifecycleDatabase = prisma as RunLifecycleDatabase,
): Promise<ReopenRunResult> {
  validateReopenInput(input);

  return database.$transaction(async (tx) => {
    const run = await tx.reconciliationRun.findUnique({
      where: { id: input.reconciliationRunId },
      select: { id: true, organizationId: true, status: true },
    });

    assertRunAccess(run, input.reconciliationRunId, context.organizationId);
    assertReopenable(run);

    const reopenedAt = new Date();
    // CAS keyed on APPROVED: guards against two concurrent reopens (or a
    // reopen racing another approval) both succeeding for the same run.
    // approvedBy/approvedAt/completedAt are intentionally left out of `data`
    // so they are preserved as history of the original approval.
    const reopenResult = await tx.reconciliationRun.updateMany({
      where: {
        id: run.id,
        organizationId: context.organizationId,
        status: ReconciliationRunStatus.APPROVED,
      },
      data: {
        status: ReconciliationRunStatus.REOPENED,
        reopenedBy: context.userId,
        reopenedAt,
      },
    });

    if (reopenResult.count === 0) {
      throw new RunLifecycleError(
        "Reconciliation run was already reopened or is no longer approved.",
        "CONFLICT",
      );
    }

    await tx.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "RECONCILIATION_RUN_REOPENED",
        resourceType: "reconciliationRun",
        resourceId: run.id,
        metadata: {
          organizationId: context.organizationId,
          userId: context.userId,
          reconciliationRunId: run.id,
          reason: input.reason,
          timestamp: reopenedAt.toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return {
      reconciliationRunId: run.id,
      status: ReconciliationRunStatus.REOPENED,
    };
  });
}
