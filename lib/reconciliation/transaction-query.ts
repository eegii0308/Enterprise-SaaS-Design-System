import { Prisma, SourceType, TransactionStatus } from "@prisma/client";

export type ReconciliationSearchParams = Record<string, string | string[] | undefined>;

export type ReconciliationRunScope = {
  bankAccountId: string;
  periodStart: Date;
  periodEnd: Date;
};

export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function enumValue<T extends Record<string, string>>(enumObject: T, value: string | undefined): T[keyof T] | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(enumObject).includes(value) ? (value as T[keyof T]) : undefined;
}

export function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseAmount(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalizedValue = value.trim();
  const amount = Number(normalizedValue);
  return Number.isFinite(amount) ? new Prisma.Decimal(normalizedValue) : undefined;
}

// Narrows a user-supplied date filter to fall within the run's own period,
// so the date range filters in the workspace form can only narrow the run's
// scope, never widen it beyond the selected run's reconciliation period.
function intersectWithRunPeriod(run: ReconciliationRunScope, userFrom: Date | undefined, userTo: Date | undefined) {
  const gte = userFrom && userFrom.getTime() > run.periodStart.getTime() ? userFrom : run.periodStart;
  const lte = userTo && userTo.getTime() < run.periodEnd.getTime() ? userTo : run.periodEnd;
  return { gte, lte };
}

export function buildReconciliationTransactionQuery(
  searchParams: ReconciliationSearchParams,
  organizationId: string,
  run: ReconciliationRunScope,
) {
  const sourceType = enumValue(SourceType, firstParam(searchParams.sourceType));
  const dateFrom = firstParam(searchParams.dateFrom);
  const dateTo = firstParam(searchParams.dateTo);
  const amountValue = firstParam(searchParams.amount);
  const bankPage = parsePage(firstParam(searchParams.bankPage));
  const ledgerPage = parsePage(firstParam(searchParams.ledgerPage));
  const amount = parseAmount(amountValue);

  const parsedDateFrom = parseDate(dateFrom);
  const parsedDateTo = parseDate(dateTo, true);
  const transactionDate = intersectWithRunPeriod(run, parsedDateFrom, parsedDateTo);

  const baseWhere: Prisma.TransactionWhereInput = {
    organizationId,
    status: TransactionStatus.UNMATCHED,
    transactionDate,
    ...(amount ? { amount } : {}),
  };

  return {
    sourceType,
    dateFrom,
    dateTo,
    amountValue,
    bankPage,
    ledgerPage,
    bankWhere: {
      ...baseWhere,
      sourceType: SourceType.BANK,
      bankAccountId: run.bankAccountId,
    } satisfies Prisma.TransactionWhereInput,
    ledgerWhere: { ...baseWhere, sourceType: SourceType.LEDGER } satisfies Prisma.TransactionWhereInput,
    shouldShowBank: !sourceType || sourceType === SourceType.BANK,
    shouldShowLedger: !sourceType || sourceType === SourceType.LEDGER,
  };
}
