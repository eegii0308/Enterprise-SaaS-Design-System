import Link from "next/link";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Prisma, ReconciliationMatchStatus, ReconciliationRunStatus, SourceType, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { hasPermission, requirePermission } from "@/lib/permissions/authorize";
import { buildReconciliationTransactionQuery, firstParam, parsePage } from "@/lib/reconciliation/transaction-query";
import { selectCurrentRun } from "@/lib/reconciliation/run-lifecycle";
import { Button } from "@/src/app/components/ui/button";
import { ApproveRunButton, ManualMatchProvider, RemoveMatchButton, SelectionRadio, SubmitRunButton } from "./ManualMatchProvider";

const pageSize = 15;

type ReconciliationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type TransactionRow = {
  id: string;
  transactionDate: Date;
  description: string;
  amount: Prisma.Decimal;
  currency: string;
  reference: string | null;
  status: TransactionStatus;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function buildPageHref(params: URLSearchParams, sourceType: SourceType, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set(sourceType === SourceType.BANK ? "bankPage" : "ledgerPage", page.toString());
  return `/dashboard/reconciliation?${nextParams.toString()}`;
}

function buildMatchPageHref(params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("matchPage", page.toString());
  return `/dashboard/reconciliation?${nextParams.toString()}`;
}

const lockedMatchRunStatuses: ReconciliationRunStatus[] = [ReconciliationRunStatus.READY_FOR_REVIEW, ReconciliationRunStatus.APPROVED];

type MatchedTransactionRow = {
  id: string;
  bankTransaction: { id: string; transactionDate: Date; description: string; amount: Prisma.Decimal; currency: string };
  ledgerTransaction: { id: string; transactionDate: Date; description: string; amount: Prisma.Decimal; currency: string };
  reconciliationRun: { status: ReconciliationRunStatus };
};

function MatchedTransactionsTable({
  matches,
  totalMatches,
  page,
  currentParams,
}: {
  matches: MatchedTransactionRow[];
  totalMatches: number;
  page: number;
  currentParams: URLSearchParams;
}) {
  const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
  const firstResult = totalMatches === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalMatches);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">Matched transactions</h2>
          <p className="text-sm text-slate-500">
            {totalMatches.toLocaleString("en")} confirmed match{totalMatches === 1 ? "" : "es"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Bank transaction</th>
              <th className="px-4 py-3 font-semibold">Ledger transaction</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matches.length > 0 ? (
              matches.map((match) => (
                <tr key={match.id} className="align-top">
                  <td className="max-w-[320px] px-4 py-3">
                    <p className="truncate font-medium text-slate-950">{match.bankTransaction.description}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(match.bankTransaction.transactionDate)} · {formatAmount(match.bankTransaction.amount, match.bankTransaction.currency)}
                    </p>
                  </td>
                  <td className="max-w-[320px] px-4 py-3">
                    <p className="truncate font-medium text-slate-950">{match.ledgerTransaction.description}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(match.ledgerTransaction.transactionDate)} ·{" "}
                      {formatAmount(match.ledgerTransaction.amount, match.ledgerTransaction.currency)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <RemoveMatchButton
                      reconciliationMatchId={match.id}
                      locked={lockedMatchRunStatuses.includes(match.reconciliationRun.status)}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-900">No confirmed matches</p>
                  <p className="mt-1 text-sm text-slate-500">Matches created from the manual match panel will appear here.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Showing {firstResult.toLocaleString("en")} to {lastResult.toLocaleString("en")} of {totalMatches.toLocaleString("en")} matches
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={buildMatchPageHref(currentParams, Math.max(1, page - 1))}>
              <ChevronLeft size={16} aria-hidden="true" />
              Previous
            </Link>
          </Button>
          <span className="text-sm font-medium text-slate-700">
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <Button asChild variant="outline" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
            <Link href={buildMatchPageHref(currentParams, Math.min(totalPages, page + 1))}>
              Next
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function TransactionTable({
  title,
  transactions,
  totalTransactions,
  page,
  currentParams,
  sourceType,
}: {
  title: string;
  transactions: TransactionRow[];
  totalTransactions: number;
  page: number;
  currentParams: URLSearchParams;
  sourceType: SourceType;
}) {
  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));
  const firstResult = totalTransactions === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalTransactions);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">
            {totalTransactions.toLocaleString("en")} transaction{totalTransactions === 1 ? "" : "s"} in this queue
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Select</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Currency</th>
              <th className="px-4 py-3 font-semibold">Reference number</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.length > 0 ? (
              transactions.map((transaction) => (
                <tr key={transaction.id} className="align-top has-[:checked]:bg-blue-50">
                  <td className="px-4 py-3">
                    <SelectionRadio
                      sourceType={sourceType}
                      transactionId={transaction.id}
                      label={`Select ${transaction.description} (${formatAmount(transaction.amount, transaction.currency)}) as the ${sourceType === SourceType.BANK ? "bank" : "ledger"} transaction to match`}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(transaction.transactionDate)}</td>
                  <td className="max-w-[360px] px-4 py-3">
                    <p className="truncate font-medium text-slate-950">{transaction.description}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-950">
                    {formatAmount(transaction.amount, transaction.currency)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{transaction.currency}</td>
                  <td className="max-w-[220px] px-4 py-3">
                    <p className="truncate text-slate-700">{transaction.reference ?? "No reference"}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatStatus(transaction.status)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <p className="text-sm font-semibold text-slate-900">No transactions found</p>
                  <p className="mt-1 text-sm text-slate-500">Adjust the filters or import transactions for this source.</p>
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
            <Link href={buildPageHref(currentParams, sourceType, Math.max(1, page - 1))}>
              <ChevronLeft size={16} aria-hidden="true" />
              Previous
            </Link>
          </Button>
          <span className="text-sm font-medium text-slate-700">
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <Button asChild variant="outline" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
            <Link href={buildPageHref(currentParams, sourceType, Math.min(totalPages, page + 1))}>
              Next
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default async function ReconciliationPage({ searchParams }: ReconciliationPageProps) {
  const session = await requirePermission("reconciliation.run");
  const canApprove = await hasPermission("reconciliation.approve");
  const resolvedSearchParams = (await searchParams) ?? {};
  const organizationId = session.organizationId;
  const {
    sourceType,
    dateFrom,
    dateTo,
    amountValue,
    bankPage,
    ledgerPage,
    bankWhere,
    ledgerWhere,
    shouldShowBank,
    shouldShowLedger,
  } = buildReconciliationTransactionQuery(resolvedSearchParams, organizationId);
  const select = {
    id: true,
    transactionDate: true,
    description: true,
    amount: true,
    currency: true,
    reference: true,
    status: true,
  } satisfies Prisma.TransactionSelect;
  const orderBy = [{ transactionDate: "desc" }, { createdAt: "desc" }, { id: "desc" }] satisfies Prisma.TransactionOrderByWithRelationInput[];
  const matchPage = parsePage(firstParam(resolvedSearchParams.matchPage));
  const transactionSummarySelect = {
    id: true,
    transactionDate: true,
    description: true,
    amount: true,
    currency: true,
  } satisfies Prisma.TransactionSelect;

  const [bankTransactions, totalBankTransactions, ledgerTransactions, totalLedgerTransactions, confirmedMatches, totalConfirmedMatches] = await Promise.all([
    shouldShowBank
      ? prisma.transaction.findMany({
          where: bankWhere,
          orderBy,
          skip: (bankPage - 1) * pageSize,
          take: pageSize,
          select,
        })
      : Promise.resolve([]),
    shouldShowBank ? prisma.transaction.count({ where: bankWhere }) : Promise.resolve(0),
    shouldShowLedger
      ? prisma.transaction.findMany({
          where: ledgerWhere,
          orderBy,
          skip: (ledgerPage - 1) * pageSize,
          take: pageSize,
          select,
        })
      : Promise.resolve([]),
    shouldShowLedger ? prisma.transaction.count({ where: ledgerWhere }) : Promise.resolve(0),
    prisma.reconciliationMatch.findMany({
      where: { organizationId, status: ReconciliationMatchStatus.CONFIRMED },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (matchPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        bankTransaction: { select: transactionSummarySelect },
        ledgerTransaction: { select: transactionSummarySelect },
        reconciliationRun: { select: { status: true } },
      },
    }),
    prisma.reconciliationMatch.count({ where: { organizationId, status: ReconciliationMatchStatus.CONFIRMED } }),
  ]);

  const candidateRuns = await prisma.reconciliationRun.findMany({
    where: {
      organizationId,
      status: {
        in: [
          ReconciliationRunStatus.DRAFT,
          ReconciliationRunStatus.IN_PROGRESS,
          ReconciliationRunStatus.READY_FOR_REVIEW,
          ReconciliationRunStatus.REOPENED,
          ReconciliationRunStatus.APPROVED,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, createdAt: true, approvedAt: true },
  });
  const currentRun = selectCurrentRun(candidateRuns);
  const currentRunConfirmedMatchCount = currentRun
    ? await prisma.reconciliationMatch.count({
        where: { organizationId, reconciliationRunId: currentRun.id, status: ReconciliationMatchStatus.CONFIRMED },
      })
    : 0;
  const isRunLockedForMatching = currentRun?.status === ReconciliationRunStatus.READY_FOR_REVIEW;

  const currentParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const param = firstParam(value);
    if (param) {
      currentParams.set(key, param);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-slate-900">Reconciliation workspace</h1>
        <p className="text-sm text-slate-500">
          Review bank and ledger transactions for {session.organizationName}. Automatic matching is not active in this phase.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Reconciliation run</h2>
            {currentRun ? (
              <>
                <p className="text-sm text-slate-500">
                  {currentRun.name} · {formatStatus(currentRun.status)}
                </p>
                {currentRun.status === ReconciliationRunStatus.APPROVED && currentRun.approvedAt ? (
                  <p className="text-xs text-slate-400">Approved {formatDate(currentRun.approvedAt)}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-500">No reconciliation run yet. Create a manual match to start one.</p>
            )}
          </div>

          {currentRun &&
          (currentRun.status === ReconciliationRunStatus.DRAFT ||
            currentRun.status === ReconciliationRunStatus.IN_PROGRESS ||
            currentRun.status === ReconciliationRunStatus.REOPENED) ? (
            <SubmitRunButton reconciliationRunId={currentRun.id} disabled={currentRunConfirmedMatchCount === 0} />
          ) : null}

          {currentRun && currentRun.status === ReconciliationRunStatus.READY_FOR_REVIEW && canApprove ? (
            <ApproveRunButton reconciliationRunId={currentRun.id} />
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <form className="grid gap-4 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(140px,1fr))_auto] xl:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">From</span>
            <input name="dateFrom" type="date" defaultValue={dateFrom ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">To</span>
            <input name="dateTo" type="date" defaultValue={dateTo ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Amount</span>
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={amountValue ?? ""}
              placeholder="Exact amount"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 placeholder:text-slate-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Source</span>
            <select name="sourceType" defaultValue={sourceType ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950">
              <option value="">Bank and ledger</option>
              {Object.values(SourceType).map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Status</span>
            <select name="status" defaultValue={TransactionStatus.UNMATCHED} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950">
              {Object.values(TransactionStatus).map((option) => (
                <option key={option} value={option}>
                  {formatStatus(option)}
                </option>
              ))}
            </select>
          </label>

          <Button type="submit" className="h-10 gap-2">
            <Filter size={16} aria-hidden="true" />
            Apply
          </Button>
        </form>
      </section>

      <ManualMatchProvider locked={isRunLockedForMatching}>
        {shouldShowBank ? (
          <TransactionTable
            title="Bank transactions"
            transactions={bankTransactions}
            totalTransactions={totalBankTransactions}
            page={bankPage}
            currentParams={currentParams}
            sourceType={SourceType.BANK}
          />
        ) : null}

        {shouldShowLedger ? (
          <TransactionTable
            title="Ledger transactions"
            transactions={ledgerTransactions}
            totalTransactions={totalLedgerTransactions}
            page={ledgerPage}
            currentParams={currentParams}
            sourceType={SourceType.LEDGER}
          />
        ) : null}
      </ManualMatchProvider>

      <MatchedTransactionsTable
        matches={confirmedMatches}
        totalMatches={totalConfirmedMatches}
        page={matchPage}
        currentParams={currentParams}
      />
    </div>
  );
}
