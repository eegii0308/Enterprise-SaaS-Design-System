"use server";

import { requirePermission } from "@/lib/permissions/authorize";
import {
  createBankAccount,
  updateBankAccount,
  archiveBankAccount,
  reactivateBankAccount,
  BankAccountError,
} from "@/lib/bank-accounts/management";

type BankAccountActionState =
  | {
      ok: true;
      message: string;
      bankAccountId: string;
    }
  | {
      ok: false;
      message: string;
      code: string;
    };

export async function createBankAccountAction(input: {
  name: string;
  bankName: string;
  maskedAccountNumber: string;
  currency: string;
}): Promise<BankAccountActionState> {
  const session = await requirePermission("bank_accounts.manage");

  try {
    const bankAccount = await createBankAccount(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return { ok: true, message: "Bank account created.", bankAccountId: bankAccount.bankAccountId };
  } catch (error) {
    if (error instanceof BankAccountError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Bank account could not be created.", code: "SERVER" };
  }
}

export async function updateBankAccountAction(input: {
  bankAccountId: string;
  name: string;
  bankName: string;
  maskedAccountNumber: string;
  currency: string;
}): Promise<BankAccountActionState> {
  const session = await requirePermission("bank_accounts.manage");

  try {
    const bankAccount = await updateBankAccount(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return { ok: true, message: "Bank account updated.", bankAccountId: bankAccount.bankAccountId };
  } catch (error) {
    if (error instanceof BankAccountError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Bank account could not be updated.", code: "SERVER" };
  }
}

export async function archiveBankAccountAction(input: { bankAccountId: string }): Promise<BankAccountActionState> {
  const session = await requirePermission("bank_accounts.manage");

  try {
    const bankAccount = await archiveBankAccount(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return { ok: true, message: "Bank account archived.", bankAccountId: bankAccount.bankAccountId };
  } catch (error) {
    if (error instanceof BankAccountError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Bank account could not be archived.", code: "SERVER" };
  }
}

export async function reactivateBankAccountAction(input: { bankAccountId: string }): Promise<BankAccountActionState> {
  const session = await requirePermission("bank_accounts.manage");

  try {
    const bankAccount = await reactivateBankAccount(input, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    return { ok: true, message: "Bank account reactivated.", bankAccountId: bankAccount.bankAccountId };
  } catch (error) {
    if (error instanceof BankAccountError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "Bank account could not be reactivated.", code: "SERVER" };
  }
}
