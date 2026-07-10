"use server";

import { requirePermission } from "@/lib/permissions/authorize";
import {
  manuallyMatchTransactions,
  removeManualMatch,
  correctManualMatch,
  rejectManualMatch,
  ManualMatchError,
} from "@/lib/reconciliation/manual-match";
import {
  submitReconciliationRunForReview,
  approveReconciliationRun,
  reopenReconciliationRun,
  RunLifecycleError,
} from "@/lib/reconciliation/run-lifecycle";
import {
  markTransactionException,
  clearTransactionException,
  ExceptionMarkingError,
} from "@/lib/reconciliation/exception-marking";

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

type ExceptionMarkingActionState =
  | {
      ok: true;
      message: string;
      transactionId: string;
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

export async function rejectManualMatchAction(input: {
  reconciliationMatchId: string;
  reason: string;
}): Promise<ManualMatchActionState> {
  const session = await requirePermission("reconciliation.run");

  try {
    const match = await rejectManualMatch(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Reconciliation match rejected.",
      reconciliationMatchId: match.reconciliationMatchId,
    };
  } catch (error) {
    if (error instanceof ManualMatchError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Reconciliation match could not be rejected.",
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

export async function markTransactionExceptionAction(input: {
  transactionId: string;
  reason: string;
}): Promise<ExceptionMarkingActionState> {
  const session = await requirePermission("transactions.edit");

  try {
    const transaction = await markTransactionException(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Transaction marked as an exception.",
      transactionId: transaction.transactionId,
    };
  } catch (error) {
    if (error instanceof ExceptionMarkingError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Transaction could not be marked as an exception.",
      code: "SERVER",
    };
  }
}

export async function clearTransactionExceptionAction(input: {
  transactionId: string;
}): Promise<ExceptionMarkingActionState> {
  const session = await requirePermission("transactions.edit");

  try {
    const transaction = await clearTransactionException(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Exception cleared.",
      transactionId: transaction.transactionId,
    };
  } catch (error) {
    if (error instanceof ExceptionMarkingError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Exception could not be cleared.",
      code: "SERVER",
    };
  }
}
