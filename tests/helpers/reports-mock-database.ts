import { SourceType, TransactionStatus } from "@prisma/client";
import type { ReportGenerationDatabase } from "../../lib/reports/generation.ts";

export type MockRun = {
  id: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  status: string;
  bankAccountId: string;
  createdBy: string;
  createdAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  organization: { name: string; defaultCurrency: string };
};

type CapturedCalls = {
  reconciliationRunFindManyArgs: unknown[];
  reconciliationRunFindUniqueArgs: unknown[];
  transactionFindManyArgs: unknown[];
  bankAccountFindManyArgs: unknown[];
  userFindManyArgs: unknown[];
  auditLogFindManyArgs: unknown[];
};

export function createFinancialDatabase(overrides: {
  runs?: MockRun[];
  aggregateSums?: Record<string, number>;
  depositsWithdrawals?: { credit: number; debit: number };
  confirmedMatches?: { bankTransactionId: string }[];
  matchedAggregateSum?: number;
  counts?: Record<string, number>;
  adjustmentCounts?: { bank: number; ledger: number };
  bankAccounts?: { id: string; name: string }[];
  users?: { id: string; fullName: string }[];
  approvalAuditLogs?: { resourceId: string; metadata: unknown }[];
  transactions?: unknown[];
  adjustments?: {
    sourceType: SourceType;
    id: string;
    transactionId: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
    reason: string;
    createdBy: string;
    createdAt: Date;
  }[];
}): ReportGenerationDatabase & { calls: CapturedCalls } {
  const calls: CapturedCalls = {
    reconciliationRunFindManyArgs: [],
    reconciliationRunFindUniqueArgs: [],
    transactionFindManyArgs: [],
    bankAccountFindManyArgs: [],
    userFindManyArgs: [],
    auditLogFindManyArgs: [],
  };

  const runs = overrides.runs ?? [];
  const aggregateSums = overrides.aggregateSums ?? {};
  const depositsWithdrawals = overrides.depositsWithdrawals ?? { credit: 0, debit: 0 };
  const confirmedMatches = overrides.confirmedMatches ?? [];
  const counts = overrides.counts ?? {};
  const adjustmentCounts = overrides.adjustmentCounts ?? { bank: 0, ledger: 0 };

  return {
    calls,
    reconciliationRun: {
      async findMany(args) {
        calls.reconciliationRunFindManyArgs.push(args);
        return runs as never;
      },
      async findUnique(args) {
        calls.reconciliationRunFindUniqueArgs.push(args);
        const id = (args as { where: { id: string } }).where.id;
        return (runs.find((run) => run.id === id) ?? null) as never;
      },
    },
    reconciliationMatch: {
      async findMany() {
        return confirmedMatches as never;
      },
    },
    transaction: {
      async findMany(args) {
        calls.transactionFindManyArgs.push(args);
        return (overrides.transactions ?? []) as never;
      },
      async aggregate(args) {
        const typedArgs = args as { where: Record<string, unknown>; _sum: Record<string, boolean> };
        const where = typedArgs.where;

        if (typedArgs._sum.creditAmount || typedArgs._sum.debitAmount) {
          return { _sum: { amount: null, creditAmount: depositsWithdrawals.credit, debitAmount: depositsWithdrawals.debit } } as never;
        }

        if (where.id) {
          return { _sum: { amount: overrides.matchedAggregateSum ?? null } } as never;
        }

        const sourceType = where.sourceType as SourceType | undefined;
        const status = where.status as TransactionStatus | undefined;
        const isBank = sourceType === SourceType.BANK;

        let key: string;
        if (status === TransactionStatus.UNMATCHED) {
          key = isBank ? "unmatchedBank" : "unmatchedLedger";
        } else if (status === TransactionStatus.EXCEPTION) {
          key = isBank ? "exceptionBank" : "exceptionLedger";
        } else {
          key = isBank ? "bankTotal" : "ledgerTotal";
        }

        return { _sum: { amount: aggregateSums[key] ?? null } } as never;
      },
      async count(args) {
        const where = (args as { where: Record<string, unknown> }).where;
        const sourceType = where.sourceType as SourceType | undefined;
        const status = where.status as TransactionStatus | undefined;
        const isBank = sourceType === SourceType.BANK;

        let key: string;
        if (status === TransactionStatus.UNMATCHED) {
          key = isBank ? "unmatchedBank" : "unmatchedLedger";
        } else {
          key = isBank ? "exceptionBank" : "exceptionLedger";
        }

        return counts[key] ?? 0;
      },
    },
    transactionAdjustment: {
      async count(args) {
        const where = (args as { where: { transaction: { sourceType: SourceType } } }).where;
        return where.transaction.sourceType === SourceType.BANK ? adjustmentCounts.bank : adjustmentCounts.ledger;
      },
      async findMany(args) {
        const where = (args as { where: { transaction: { sourceType: SourceType } } }).where;
        const all = overrides.adjustments ?? [];
        return all.filter((adjustment) => adjustment.sourceType === where.transaction.sourceType) as never;
      },
    },
    bankAccount: {
      async findMany(args) {
        calls.bankAccountFindManyArgs.push(args);
        return (overrides.bankAccounts ?? []) as never;
      },
    },
    user: {
      async findMany(args) {
        calls.userFindManyArgs.push(args);
        return (overrides.users ?? []) as never;
      },
    },
    auditLog: {
      async findMany(args) {
        calls.auditLogFindManyArgs.push(args);
        return (overrides.approvalAuditLogs ?? []) as never;
      },
    },
  };
}

export function baseRun(overrides: Partial<MockRun> = {}): MockRun {
  return {
    id: "run-1",
    organizationId: "org-1",
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-06-30T23:59:59.999Z"),
    status: "DRAFT",
    bankAccountId: "account-1",
    createdBy: "user-1",
    createdAt: new Date("2026-06-01T08:00:00.000Z"),
    approvedBy: null,
    approvedAt: null,
    organization: { name: "Acme Reconciliation", defaultCurrency: "MNT" },
    ...overrides,
  };
}
