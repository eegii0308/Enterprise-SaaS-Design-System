import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import { Prisma, SourceType, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { Button } from "@/src/app/components/ui/button";

const pageSize = 25;

type TransactionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function enumValue<T extends Record<string, string>>(enumObject: T, value: string | undefined): T[keyof T] | undefined {
  if (!value) {
    return undefined;
  }

  return Object.values(enumObject).includes(value) ? (value as T[keyof T]) : undefined;
}

function parsePage(value: string | undefined) {
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatAmount(amount: Prisma.Decimal, currency: string) {
  return `${amount.toFixed(2)} ${currency}`;
}

function getDebitCredit(transaction: { debitAmount: Prisma.Decimal; creditAmount: Prisma.Decimal }) {
  if (transaction.debitAmount.greaterThan(0)) {
    return "Debit";
  }

  if (transaction.creditAmount.greaterThan(0)) {
    return "Credit";
  }

  return "Net";
}

function buildPageHref(params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("page", page.toString());
  return `/dashboard/transactions?${nextParams.toString()}`;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const session = await requirePermission("transactions.view");
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = enumValue(TransactionStatus, firstParam(resolvedSearchParams.status));
  const sourceType = enumValue(SourceType, firstParam(resolvedSearchParams.sourceType));
  const importBatchId = firstParam(resolvedSearchParams.importBatchId);
  const dateFrom = firstParam(resolvedSearchParams.dateFrom);
  const dateTo = firstParam(resolvedSearchParams.dateTo);
  const search = firstParam(resolvedSearchParams.q)?.trim();
  const page = parsePage(firstParam(resolvedSearchParams.page));
  const organizationId = session.organizationId;

  const transactionDate: Prisma.DateTimeFilter = {};
  const parsedDateFrom = parseDate(dateFrom);
  const parsedDateTo = parseDate(dateTo, true);

  if (parsedDateFrom) {
    transactionDate.gte = parsedDateFrom;
  }

  if (parsedDateTo) {
    transactionDate.lte = parsedDateTo;
  }

  const where: Prisma.TransactionWhereInput = {
    organizationId,
    ...(status ? { status } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(importBatchId ? { importBatchId } : {}),
    ...(parsedDateFrom || parsedDateTo ? { transactionDate } : {}),
    ...(search
      ? {
          OR: [
            { description: { contains: search, mode: "insensitive" } },
            { reference: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [transactions, totalTransactions, importBatches] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        transactionDate: true,
        description: true,
        reference: true,
        amount: true,
        currency: true,
        debitAmount: true,
        creditAmount: true,
        status: true,
        sourceType: true,
        createdAt: true,
        importBatch: {
          select: {
            id: true,
            fileName: true,
          },
        },
      },
    }),
    prisma.transaction.count({ where }),
    prisma.importBatch.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fileName: true,
      },
    }),
  ]);

  const currentParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const param = firstParam(value);
    if (param) {
      currentParams.set(key, param);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));
  const firstResult = totalTransactions === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalTransactions);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-slate-900">Transactions</h1>
        <p className="text-sm text-slate-500">
          Review imported bank and ledger transactions for {session.organizationName}. Matching will be handled in a later phase.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <form className="grid gap-4 border-b border-slate-100 p-4 lg:grid-cols-[1.5fr_repeat(5,minmax(140px,1fr))_auto] lg:items-end">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Search</span>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
              <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input
                name="q"
                defaultValue={search ?? ""}
                placeholder="Description or reference"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Status</span>
            <select name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950">
              <option value="">All statuses</option>
              {Object.values(TransactionStatus).map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Source</span>
            <select name="sourceType" defaultValue={sourceType ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950">
              <option value="">All sources</option>
              {Object.values(SourceType).map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Import batch</span>
            <select name="importBatchId" defaultValue={importBatchId ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950">
              <option value="">All batches</option>
              {importBatches.map((importBatch) => (
                <option key={importBatch.id} value={importBatch.id}>
                  {importBatch.fileName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">From</span>
            <input name="dateFrom" type="date" defaultValue={dateFrom ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">To</span>
            <input name="dateTo" type="date" defaultValue={dateTo ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950" />
          </label>

          <Button type="submit" className="h-10 gap-2">
            <Filter size={16} aria-hidden="true" />
            Apply
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Currency</th>
                <th className="px-4 py-3 font-semibold">Debit/Credit</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Import batch</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(transaction.transactionDate)}</td>
                    <td className="max-w-[320px] px-4 py-3">
                      <Link href={`/dashboard/transactions/${transaction.id}`} className="truncate font-medium text-blue-600 hover:underline block">
                        {transaction.description}
                      </Link>
                      <p className="mt-1 truncate text-xs text-slate-500">{transaction.reference ? `Ref ${transaction.reference}` : "No reference"}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-950">{formatAmount(transaction.amount, transaction.currency)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{transaction.currency}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{getDebitCredit(transaction)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatStatus(transaction.status)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatStatus(transaction.sourceType)}</td>
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate text-slate-700">{transaction.importBatch?.fileName ?? "Manual or unavailable"}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(transaction.createdAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-900">No transactions found</p>
                    <p className="mt-1 text-sm text-slate-500">Try adjusting the filters or upload a transaction import batch.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing {firstResult.toLocaleString("en")} to {lastResult.toLocaleString("en")} of {totalTransactions.toLocaleString("en")} transactions
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
              <Link href={buildPageHref(currentParams, Math.max(1, page - 1))}>
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </Link>
            </Button>
            <span className="text-sm font-medium text-slate-700">
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>
            <Button asChild variant="outline" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
              <Link href={buildPageHref(currentParams, Math.min(totalPages, page + 1))}>
                Next
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
