"use server";

import { requirePermission } from "@/lib/permissions/authorize";
import { adjustTransaction, TransactionAdjustmentError } from "@/lib/transactions/adjustment";

type AdjustTransactionActionState =
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

export async function adjustTransactionAction(input: {
  transactionId: string;
  fieldName: string;
  newValue: string;
  reason: string;
}): Promise<AdjustTransactionActionState> {
  const session = await requirePermission("transactions.edit");

  try {
    const adjustment = await adjustTransaction(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return {
      ok: true,
      message: "Transaction adjusted.",
      transactionId: adjustment.transactionId,
    };
  } catch (error) {
    if (error instanceof TransactionAdjustmentError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return {
      ok: false,
      message: "Transaction could not be adjusted.",
      code: "SERVER",
    };
  }
}
