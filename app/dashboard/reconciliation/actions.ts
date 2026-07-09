"use server";

import { requirePermission } from "@/lib/permissions/authorize";
import { manuallyMatchTransactions, removeManualMatch, correctManualMatch, ManualMatchError } from "@/lib/reconciliation/manual-match";
import {
  submitReconciliationRunForReview,
  approveReconciliationRun,
  reopenReconciliationRun,
  RunLifecycleError,
} from "@/lib/reconciliation/run-lifecycle";

type ManualMatchActionState =
  | {
      ok: true;
      message: string;
      reconciliationMatchId: string;
    }
  | {
      ok: false;
      message: string;
      code: string;
    };

type RunLifecycleActionState =
  | {
      ok: true;
      message: string;
      reconciliationRunId: string;
    }
  | {
      ok: false;
      message: string;
      code: string;
    };

export async function manuallyMatchTransactionsAction(input: {
  bankTransactionId: string;
  ledgerTransactionId: string;
}): Promise<ManualMatchActionState> {
  const session = await requirePermission("reconciliation.run");

  try {
    const match = await manuallyMatchTransactions(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Manual reconciliation match created.",
      reconciliationMatchId: match.reconciliationMatchId,
    };
  } catch (error) {
    if (error instanceof ManualMatchError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Manual reconciliation match could not be created.",
      code: "SERVER",
    };
  }
}

export async function removeManualMatchAction(input: { reconciliationMatchId: string }): Promise<ManualMatchActionState> {
  const session = await requirePermission("reconciliation.run");

  try {
    const match = await removeManualMatch(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Reconciliation match removed.",
      reconciliationMatchId: match.reconciliationMatchId,
    };
  } catch (error) {
    if (error instanceof ManualMatchError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Reconciliation match could not be removed.",
      code: "SERVER",
    };
  }
}

export async function correctManualMatchAction(input: {
  reconciliationMatchId: string;
  replacementBankTransactionId?: string;
  replacementLedgerTransactionId?: string;
  reason: string;
}): Promise<ManualMatchActionState> {
  const session = await requirePermission("reconciliation.run");

  try {
    const match = await correctManualMatch(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Reconciliation match corrected.",
      reconciliationMatchId: match.reconciliationMatchId,
    };
  } catch (error) {
    if (error instanceof ManualMatchError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Reconciliation match could not be corrected.",
      code: "SERVER",
    };
  }
}

export async function submitReconciliationRunForReviewAction(input: {
  reconciliationRunId: string;
}): Promise<RunLifecycleActionState> {
  const session = await requirePermission("reconciliation.run");

  try {
    const run = await submitReconciliationRunForReview(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Reconciliation run submitted for review.",
      reconciliationRunId: run.reconciliationRunId,
    };
  } catch (error) {
    if (error instanceof RunLifecycleError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Reconciliation run could not be submitted for review.",
      code: "SERVER",
    };
  }
}

export async function approveReconciliationRunAction(input: {
  reconciliationRunId: string;
}): Promise<RunLifecycleActionState> {
  const session = await requirePermission("reconciliation.approve");

  try {
    const run = await approveReconciliationRun(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Reconciliation run approved.",
      reconciliationRunId: run.reconciliationRunId,
    };
  } catch (error) {
    if (error instanceof RunLifecycleError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Reconciliation run could not be approved.",
      code: "SERVER",
    };
  }
}

export async function reopenReconciliationRunAction(input: {
  reconciliationRunId: string;
  reason: string;
}): Promise<RunLifecycleActionState> {
  const session = await requirePermission("reconciliation.approve");

  try {
    const run = await reopenReconciliationRun(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Reconciliation run reopened.",
      reconciliationRunId: run.reconciliationRunId,
    };
  } catch (error) {
    if (error instanceof RunLifecycleError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Reconciliation run could not be reopened.",
      code: "SERVER",
    };
  }
}
