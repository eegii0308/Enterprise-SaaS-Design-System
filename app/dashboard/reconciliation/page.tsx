import Link from "next/link";
import { AlertOctagon, Building2, ChevronLeft, ChevronRight, Filter, History, XCircle } from "lucide-react";
import { Prisma, ReconciliationMatchStatus, ReconciliationRunStatus, SourceType, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { hasPermission, requirePermission } from "@/lib/permissions/authorize";
import { buildReconciliationTransactionQuery, firstParam, parsePage } from "@/lib/reconciliation/transaction-query";
import { openRunStatuses } from "@/lib/reconciliation/run-lifecycle";
import { calculateReconciliationTieOut, type ReconciliationTieOutSummary } from "@/lib/reconciliation/tie-out-summary";
import { evaluateApprovalReadiness } from "@/lib/reconciliation/approval-validation";
import { Button } from "@/src/app/components/ui/button";
import { Badge } from "@/src/app/components/ui/badge";
import {
  ApproveRunButton,
  ClearExceptionButton,
  CorrectMatchButton,
  CreateRunForm,
  ManualMatchProvider,
  MarkExceptionButton,
  RejectMatchButton,
  RemoveMatchButton,
  ReopenRunButton,
  SelectionRadio,
  SubmitRunButton,
} from "./ManualMatchProvider";

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
  correctedFromMatchId: string | null;
  correctedFromMatch: { id: string; correctionReason: string | null } | null;
};

type CorrectionCandidate = { id: string; label: string };

function MatchedTransactionsTable({
  matches,
  totalMatches,
  page,
  currentParams,
  bankCandidates,
  ledgerCandidates,
}: {
  matches: MatchedTransactionRow[];
  totalMatches: number;
  page: number;
  currentParams: URLSearchParams;
  bankCandidates: CorrectionCandidate[];
  ledgerCandidates: CorrectionCandidate[];
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
                    {match.correctedFromMatchId ? (
                      <div className="mt-2 flex flex-col gap-1">
                        <Badge variant="secondary" className="gap-1">
                          <History size={12} aria-hidden="true" />
                          Corrected
                        </Badge>
                        <p className="text-xs text-slate-400">
                          Corrected from match {match.correctedFromMatch?.id ?? match.correctedFromMatchId}
                        </p>
                        {match.correctedFromMatch?.correctionReason ? (
                          <p className="text-xs text-slate-400">Reason: {match.correctedFromMatch.correctionReason}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-[320px] px-4 py-3">
                    <p className="truncate font-medium text-slate-950">{match.ledgerTransaction.description}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(match.ledgerTransaction.transactionDate)} ·{" "}
                      {formatAmount(match.ledgerTransaction.amount, match.ledgerTransaction.currency)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-2">
                      <CorrectMatchButton
                        reconciliationMatchId={match.id}
                        locked={lockedMatchRunStatuses.includes(match.reconciliationRun.status)}
                        currentBankLabel={`${formatDate(match.bankTransaction.transactionDate)} · ${match.bankTransaction.description}`}
                        currentLedgerLabel={`${formatDate(match.ledgerTransaction.transactionDate)} · ${match.ledgerTransaction.description}`}
                        bankCandidates={bankCandidates}
                        ledgerCandidates={ledgerCandidates}
                      />
                      <RemoveMatchButton
                        reconciliationMatchId={match.id}
                        locked={lockedMatchRunStatuses.includes(match.reconciliationRun.status)}
                      />
                      <RejectMatchButton
                        reconciliationMatchId={match.id}
                        locked={lockedMatchRunStatuses.includes(match.reconciliationRun.status)}
                      />
                    </div>
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

type RejectedMatchRow = {
  id: string;
  bankTransaction: { id: string; transactionDate: Date; description: string; amount: Prisma.Decimal; currency: string };
  ledgerTransaction: { id: string; transactionDate: Date; description: string; amount: Prisma.Decimal; currency: string };
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
};

function buildRejectedPageHref(params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("rejectedPage", page.toString());
  return `/dashboard/reconciliation?${nextParams.toString()}`;
}

function RejectedMatchesTable({
  matches,
  totalMatches,
  page,
  currentParams,
}: {
  matches: RejectedMatchRow[];
  totalMatches: number;
  page: number;
  currentParams: URLSearchParams;
}) {
  if (totalMatches === 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalMatches);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">Rejected matches</h2>
          <p className="text-sm text-slate-500">
            {totalMatches.toLocaleString("en")} rejected match{totalMatches === 1 ? "" : "es"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Bank transaction</th>
              <th className="px-4 py-3 font-semibold">Ledger transaction</th>
              <th className="px-4 py-3 font-semibold">Rejection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matches.map((match) => (
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
                  <Badge variant="destructive" className="gap-1">
                    <XCircle size={12} aria-hidden="true" />
                    Rejected
                  </Badge>
                  {match.rejectionReason ? <p className="mt-2 text-xs text-slate-400">Reason: {match.rejectionReason}</p> : null}
                  {match.rejectedAt ? (
                    <p className="text-xs text-slate-400">
                      Rejected {formatDateTime(match.rejectedAt)}
                      {match.rejectedBy ? ` by ${match.rejectedBy}` : ""}
                    </p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Showing {firstResult.toLocaleString("en")} to {lastResult.toLocaleString("en")} of {totalMatches.toLocaleString("en")} matches
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={buildRejectedPageHref(currentParams, Math.max(1, page - 1))}>
              <ChevronLeft size={16} aria-hidden="true" />
              Previous
            </Link>
          </Button>
          <span className="text-sm font-medium text-slate-700">
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <Button asChild variant="outline" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
            <Link href={buildRejectedPageHref(currentParams, Math.min(totalPages, page + 1))}>
              Next
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

type ExceptionTransactionRow = {
  id: string;
  transactionDate: Date;
  description: string;
  amount: Prisma.Decimal;
  currency: string;
  sourceType: SourceType;
  exceptionReason: string | null;
  exceptionMarkedBy: string | null;
  exceptionMarkedAt: Date | null;
};

function buildExceptionPageHref(params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("exceptionPage", page.toString());
  return `/dashboard/reconciliation?${nextParams.toString()}`;
}

function ExceptionTransactionsTable({
  transactions,
  totalTransactions,
  page,
  currentParams,
  canClearException,
}: {
  transactions: ExceptionTransactionRow[];
  totalTransactions: number;
  page: number;
  currentParams: URLSearchParams;
  canClearException: boolean;
}) {
  if (totalTransactions === 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));
  const firstResult = (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalTransactions);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">Exceptions</h2>
          <p className="text-sm text-slate-500">
            {totalTransactions.toLocaleString("en")} transaction{totalTransactions === 1 ? "" : "s"} marked as an exception
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Transaction</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Exception</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="align-top">
                <td className="max-w-[320px] px-4 py-3">
                  <p className="truncate font-medium text-slate-950">{transaction.description}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(transaction.transactionDate)} · {formatAmount(transaction.amount, transaction.currency)}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatStatus(transaction.sourceType)}</td>
                <td className="px-4 py-3">
                  <Badge variant="destructive" className="gap-1">
                    <AlertOctagon size={12} aria-hidden="true" />
                    Exception
                  </Badge>
                  {transaction.exceptionReason ? (
                    <p className="mt-2 text-xs text-slate-400">Reason: {transaction.exceptionReason}</p>
                  ) : null}
                  {transaction.exceptionMarkedAt ? (
                    <p className="text-xs text-slate-400">
                      Marked {formatDateTime(transaction.exceptionMarkedAt)}
                      {transaction.exceptionMarkedBy ? ` by ${transaction.exceptionMarkedBy}` : ""}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {canClearException ? <ClearExceptionButton transactionId={transaction.id} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Showing {firstResult.toLocaleString("en")} to {lastResult.toLocaleString("en")} of {totalTransactions.toLocaleString("en")} transactions
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
            <Link href={buildExceptionPageHref(currentParams, Math.max(1, page - 1))}>
              <ChevronLeft size={16} aria-hidden="true" />
              Previous
            </Link>
          </Button>
          <span className="text-sm font-medium text-slate-700">
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
          <Button asChild variant="outline" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
            <Link href={buildExceptionPageHref(currentParams, Math.min(totalPages, page + 1))}>
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
  canMarkException,
}: {
  title: string;
  transactions: TransactionRow[];
  totalTransactions: number;
  page: number;
  currentParams: URLSearchParams;
  sourceType: SourceType;
  canMarkException: boolean;
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
              <th className="px-4 py-3 font-semibold">Action</th>
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
                  <td className="px-4 py-3">
                    {canMarkException ? <MarkExceptionButton transactionId={transaction.id} /> : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
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

type BankAccountOption = {
  id: string;
  name: string;
  bankName: string;
  maskedAccountNumber: string;
};

type RunOption = {
  id: string;
  name: string;
  status: ReconciliationRunStatus;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  bankAccount: { name: string; bankName: string; maskedAccountNumber: string };
};

function RunPickerSection({
  runs,
  bankAccounts,
  canManageBankAccounts,
}: {
  runs: RunOption[];
  bankAccounts: BankAccountOption[];
  canManageBankAccounts: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold text-slate-950">Create a reconciliation run</h2>
          <p className="text-sm text-slate-500">
            Select a bank account and reconciliation period to start a new run. Bank and ledger transactions are scoped to
            the run you create.
          </p>
        </div>

        {bankAccounts.length > 0 ? (
          <div className="mt-4">
            <CreateRunForm bankAccounts={bankAccounts} />
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No active bank accounts were found for this organization.{" "}
            {canManageBankAccounts ? (
              <>
                Add one on the{" "}
                <Link href="/dashboard/bank-accounts" className="font-medium underline">
                  Bank accounts
                </Link>{" "}
                page before creating a reconciliation run.
              </>
            ) : (
              "Ask an admin or finance manager to add one before creating a reconciliation run."
            )}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-950">Reconciliation runs</h2>
          <p className="text-sm text-slate-500">
            {runs.length.toLocaleString("en")} run{runs.length === 1 ? "" : "s"}. Select one to open its workspace.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Run</th>
                <th className="px-4 py-3 font-semibold">Bank account</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.length > 0 ? (
                runs.map((run) => (
                  <tr key={run.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/reconciliation?runId=${run.id}`} className="font-medium text-blue-600 hover:underline">
                        {run.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {run.bankAccount.name} · {run.bankAccount.bankName} ({run.bankAccount.maskedAccountNumber})
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatStatus(run.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-900">No reconciliation runs yet</p>
                    <p className="mt-1 text-sm text-slate-500">Create one above to start reconciling a bank account.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TieOutSummaryCard({ summary }: { summary: ReconciliationTieOutSummary }) {
  const isBalanced = summary.variance.isZero();
  const tiles: { label: string; amount: Prisma.Decimal }[] = [
    { label: "Bank transaction total", amount: summary.bankTransactionTotal },
    { label: "Ledger transaction total", amount: summary.ledgerTransactionTotal },
    { label: "Matched amount", amount: summary.matchedAmount },
    { label: "Unmatched bank amount", amount: summary.unmatchedBankAmount },
    { label: "Unmatched ledger amount", amount: summary.unmatchedLedgerAmount },
    { label: "Exception amount", amount: summary.exceptionAmount },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-bold text-slate-950">Financial tie-out</h2>
        <p className="text-sm text-slate-500">
          {formatDate(summary.periodStart)} – {formatDate(summary.periodEnd)}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-md border border-slate-100 bg-slate-50 p-3">
            <dt className="text-xs font-semibold uppercase text-slate-500">{tile.label}</dt>
            <dd className="mt-1 text-sm font-bold text-slate-950">{formatAmount(tile.amount, summary.currency)}</dd>
          </div>
        ))}
      </dl>

      <div className={`mt-3 rounded-md border p-3 ${isBalanced ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <p className={`text-xs font-semibold uppercase ${isBalanced ? "text-emerald-700" : "text-amber-700"}`}>
          Variance (bank total − ledger total)
        </p>
        <p className={`mt-1 text-sm font-bold ${isBalanced ? "text-emerald-800" : "text-amber-800"}`}>
          {formatAmount(summary.variance, summary.currency)} · {isBalanced ? "Balanced" : "Review required"}
        </p>
      </div>
    </section>
  );
}

type SelectedRun = {
  id: string;
  name: string;
  status: ReconciliationRunStatus;
  periodStart: Date;
  periodEnd: Date;
  bankAccountId: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  reopenedBy: string | null;
  reopenedAt: Date | null;
  bankAccount: { name: string; bankName: string; maskedAccountNumber: string; currency: string };
};

export default async function ReconciliationPage({ searchParams }: ReconciliationPageProps) {
  const session = await requirePermission("reconciliation.run");
  const canApprove = await hasPermission("reconciliation.approve");
  const canEditTransactions = await hasPermission("transactions.edit");
  const canManageBankAccounts = await hasPermission("bank_accounts.manage");
  const resolvedSearchParams = (await searchParams) ?? {};
  const organizationId = session.organizationId;
  const runId = firstParam(resolvedSearchParams.runId);

  const run: SelectedRun | null = runId
    ? await prisma.reconciliationRun.findFirst({
        where: { id: runId, organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          bankAccountId: true,
          approvedBy: true,
          approvedAt: true,
          reopenedBy: true,
          reopenedAt: true,
          bankAccount: { select: { name: true, bankName: true, maskedAccountNumber: true, currency: true } },
        },
      })
    : null;

  if (!run) {
    const [bankAccounts, runs] = await Promise.all([
      prisma.bankAccount.findMany({
        where: { organizationId, status: "active" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, bankName: true, maskedAccountNumber: true },
      }),
      prisma.reconciliationRun.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          name: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          createdAt: true,
          bankAccount: { select: { name: true, bankName: true, maskedAccountNumber: true } },
        },
      }),
    ]);

    return (
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-slate-900">Reconciliation workspace</h1>
          <p className="text-sm text-slate-500">
            Select an existing reconciliation run or create a new one to review bank and ledger transactions for{" "}
            {session.organizationName}.
          </p>
        </div>

        <RunPickerSection runs={runs} bankAccounts={bankAccounts} canManageBankAccounts={canManageBankAccounts} />
      </div>
    );
  }

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
  } = buildReconciliationTransactionQuery(resolvedSearchParams, organizationId, {
    bankAccountId: run.bankAccountId,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
  });
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
  const rejectedPage = parsePage(firstParam(resolvedSearchParams.rejectedPage));
  const exceptionPage = parsePage(firstParam(resolvedSearchParams.exceptionPage));
  const transactionSummarySelect = {
    id: true,
    transactionDate: true,
    description: true,
    amount: true,
    currency: true,
  } satisfies Prisma.TransactionSelect;

  const correctionCandidateLimit = 100;
  const runPeriod = { gte: run.periodStart, lte: run.periodEnd };
  // Exceptions live outside the UNMATCHED/MATCHED lifecycle and aren't tied to
  // a run by foreign key, so they're scoped the same way bank/ledger totals
  // are: the bank leg by this run's bank account, the ledger leg by period
  // only (ledger entries aren't tied to a bank account).
  const exceptionScope = {
    OR: [
      { sourceType: SourceType.BANK, bankAccountId: run.bankAccountId, transactionDate: runPeriod },
      { sourceType: SourceType.LEDGER, transactionDate: runPeriod },
    ],
  } satisfies Prisma.TransactionWhereInput;

  const [
    bankTransactions,
    totalBankTransactions,
    ledgerTransactions,
    totalLedgerTransactions,
    confirmedMatches,
    totalConfirmedMatches,
    rejectedMatches,
    totalRejectedMatches,
    exceptionTransactions,
    totalExceptionTransactions,
    unmatchedBankCandidates,
    unmatchedLedgerCandidates,
  ] = await Promise.all([
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
      where: { organizationId, reconciliationRunId: run.id, status: ReconciliationMatchStatus.CONFIRMED },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (matchPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        bankTransaction: { select: transactionSummarySelect },
        ledgerTransaction: { select: transactionSummarySelect },
        reconciliationRun: { select: { status: true } },
        correctedFromMatchId: true,
        correctedFromMatch: { select: { id: true, correctionReason: true } },
      },
    }),
    prisma.reconciliationMatch.count({
      where: { organizationId, reconciliationRunId: run.id, status: ReconciliationMatchStatus.CONFIRMED },
    }),
    prisma.reconciliationMatch.findMany({
      where: { organizationId, reconciliationRunId: run.id, status: ReconciliationMatchStatus.REJECTED },
      orderBy: [{ rejectedAt: "desc" }, { id: "desc" }],
      skip: (rejectedPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        bankTransaction: { select: transactionSummarySelect },
        ledgerTransaction: { select: transactionSummarySelect },
        rejectedBy: true,
        rejectedAt: true,
        rejectionReason: true,
      },
    }),
    prisma.reconciliationMatch.count({
      where: { organizationId, reconciliationRunId: run.id, status: ReconciliationMatchStatus.REJECTED },
    }),
    prisma.transaction.findMany({
      where: { organizationId, status: TransactionStatus.EXCEPTION, ...exceptionScope },
      orderBy: [{ exceptionMarkedAt: "desc" }, { id: "desc" }],
      skip: (exceptionPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        transactionDate: true,
        description: true,
        amount: true,
        currency: true,
        sourceType: true,
        exceptionReason: true,
        exceptionMarkedBy: true,
        exceptionMarkedAt: true,
      },
    }),
    prisma.transaction.count({ where: { organizationId, status: TransactionStatus.EXCEPTION, ...exceptionScope } }),
    prisma.transaction.findMany({
      where: {
        organizationId,
        sourceType: SourceType.BANK,
        bankAccountId: run.bankAccountId,
        status: TransactionStatus.UNMATCHED,
        transactionDate: runPeriod,
      },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      take: correctionCandidateLimit,
      select: transactionSummarySelect,
    }),
    prisma.transaction.findMany({
      where: {
        organizationId,
        sourceType: SourceType.LEDGER,
        status: TransactionStatus.UNMATCHED,
        transactionDate: runPeriod,
      },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      take: correctionCandidateLimit,
      select: transactionSummarySelect,
    }),
  ]);

  const bankCorrectionCandidates = unmatchedBankCandidates.map((transaction) => ({
    id: transaction.id,
    label: `${formatDate(transaction.transactionDate)} · ${transaction.description} · ${formatAmount(transaction.amount, transaction.currency)}`,
  }));
  const ledgerCorrectionCandidates = unmatchedLedgerCandidates.map((transaction) => ({
    id: transaction.id,
    label: `${formatDate(transaction.transactionDate)} · ${transaction.description} · ${formatAmount(transaction.amount, transaction.currency)}`,
  }));

  const tieOutSummary = await calculateReconciliationTieOut({ reconciliationRunId: run.id }, { organizationId });
  const approvalReadiness =
    run.status === ReconciliationRunStatus.READY_FOR_REVIEW && canApprove
      ? await evaluateApprovalReadiness({ reconciliationRunId: run.id }, { organizationId })
      : null;
  const isRunLockedForMatching = run.status === ReconciliationRunStatus.READY_FOR_REVIEW;

  const currentParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const param = firstParam(value);
    if (param) {
      currentParams.set(key, param);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reconciliation workspace</h1>
          <p className="text-sm text-slate-500">
            Review bank and ledger transactions for {session.organizationName}. Automatic matching is not active in this phase.
          </p>
        </div>
        <Link href="/dashboard/reconciliation" className="text-sm font-medium text-blue-600 hover:underline">
          All reconciliation runs
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Reconciliation run</h2>
            <p className="text-sm text-slate-500">
              {run.name} · {formatStatus(run.status)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Building2 size={12} aria-hidden="true" />
              {run.bankAccount.name} · {run.bankAccount.bankName} ({run.bankAccount.maskedAccountNumber})
            </p>
            <p className="text-xs text-slate-400">
              Period: {formatDate(run.periodStart)} – {formatDate(run.periodEnd)}
            </p>
            {run.status === ReconciliationRunStatus.APPROVED && run.approvedAt ? (
              <p className="text-xs text-slate-400">Approved {formatDate(run.approvedAt)}</p>
            ) : null}
            {run.status === ReconciliationRunStatus.REOPENED && run.reopenedAt ? (
              <>
                <p className="text-xs text-slate-400">Reopened by {run.reopenedBy ?? "unknown"}</p>
                <p className="text-xs text-slate-400">Reopened at {formatDateTime(run.reopenedAt)}</p>
              </>
            ) : null}
          </div>

          {openRunStatuses.includes(run.status) ? (
            <SubmitRunButton reconciliationRunId={run.id} disabled={totalConfirmedMatches === 0} />
          ) : null}

          {approvalReadiness ? (
            <ApproveRunButton
              reconciliationRunId={run.id}
              hasOutstandingItems={approvalReadiness.hasOutstandingItems}
              varianceLabel={formatAmount(approvalReadiness.variance, approvalReadiness.currency)}
              unmatchedBankCount={approvalReadiness.unmatchedBankCount}
              unmatchedBankAmountLabel={formatAmount(approvalReadiness.unmatchedBankAmount, approvalReadiness.currency)}
              unmatchedLedgerCount={approvalReadiness.unmatchedLedgerCount}
              unmatchedLedgerAmountLabel={formatAmount(approvalReadiness.unmatchedLedgerAmount, approvalReadiness.currency)}
              exceptionCount={approvalReadiness.exceptionCount}
              exceptionAmountLabel={formatAmount(approvalReadiness.exceptionAmount, approvalReadiness.currency)}
            />
          ) : null}

          {run.status === ReconciliationRunStatus.APPROVED && canApprove ? <ReopenRunButton reconciliationRunId={run.id} /> : null}
        </div>
      </section>

      <TieOutSummaryCard summary={tieOutSummary} />

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

      <ManualMatchProvider reconciliationRunId={run.id} locked={isRunLockedForMatching}>
        {shouldShowBank ? (
          <TransactionTable
            title="Bank transactions"
            transactions={bankTransactions}
            totalTransactions={totalBankTransactions}
            page={bankPage}
            currentParams={currentParams}
            sourceType={SourceType.BANK}
            canMarkException={canEditTransactions}
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
            canMarkException={canEditTransactions}
          />
        ) : null}
      </ManualMatchProvider>

      <MatchedTransactionsTable
        matches={confirmedMatches}
        totalMatches={totalConfirmedMatches}
        page={matchPage}
        currentParams={currentParams}
        bankCandidates={bankCorrectionCandidates}
        ledgerCandidates={ledgerCorrectionCandidates}
      />

      <RejectedMatchesTable
        matches={rejectedMatches}
        totalMatches={totalRejectedMatches}
        page={rejectedPage}
        currentParams={currentParams}
      />

      <ExceptionTransactionsTable
        transactions={exceptionTransactions}
        totalTransactions={totalExceptionTransactions}
        page={exceptionPage}
        currentParams={currentParams}
        canClearException={canEditTransactions}
      />
    </div>
  );
}
