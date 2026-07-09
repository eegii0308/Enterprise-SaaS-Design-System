"use server";

import { requirePermission } from "@/lib/permissions/authorize";
import { manuallyMatchTransactions, removeManualMatch, ManualMatchError } from "@/lib/reconciliation/manual-match";

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
