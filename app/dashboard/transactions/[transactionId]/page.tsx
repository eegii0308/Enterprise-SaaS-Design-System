import Link from "next/link";
import { notFound } from "next/navigation";
import { Landmark } from "lucide-react";
import { Prisma, SourceType, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { hasPermission, requirePermission } from "@/lib/permissions/authorize";
import { ADJUSTABLE_FIELDS, type AdjustableTransactionField } from "@/lib/transactions/adjustment";
import { Badge } from "@/src/app/components/ui/badge";
import { AdjustTransactionForm } from "../AdjustTransactionForm";

type TransactionDetailPageProps = {
  params: Promise<{ transactionId: string }>;
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

function statusBadgeVariant(status: TransactionStatus): "secondary" | "destructive" | "outline" {
  if (status === TransactionStatus.MATCHED) {
    return "secondary";
  }

  if (status === TransactionStatus.EXCEPTION) {
    return "destructive";
  }

  return "outline";
}

const fieldLabels: Record<AdjustableTransactionField, string> = {
  description: "Description",
  vendor: "Vendor",
  reference: "Reference",
  currency: "Currency",
  amount: "Amount",
  transactionDate: "Transaction date",
};

export default async function TransactionDetailPage({ params }: TransactionDetailPageProps) {
  const session = await requirePermission("transactions.view");
  const { transactionId } = await params;

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, organizationId: session.organizationId },
    select: {
      id: true,
      transactionDate: true,
      description: true,
      vendor: true,
      reference: true,
      amount: true,
      currency: true,
      debitAmount: true,
      creditAmount: true,
      status: true,
      sourceType: true,
      exceptionReason: true,
      exceptionMarkedAt: true,
      exceptionClearedAt: true,
      createdAt: true,
      updatedAt: true,
      importBatch: { select: { id: true, fileName: true } },
      bankAccount: { select: { id: true, name: true, bankName: true } },
    },
  });

  if (!transaction) {
    notFound();
  }

  const canAdjust = await hasPermission("transactions.edit");

  const adjustments = await prisma.transactionAdjustment.findMany({
    where: { organizationId: session.organizationId, transactionId: transaction.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fieldName: true,
      oldValue: true,
      newValue: true,
      reason: true,
      createdBy: true,
      createdAt: true,
    },
  });

  const adjusterIds = [...new Set(adjustments.map((adjustment) => adjustment.createdBy))];
  const adjusters = adjusterIds.length
    ? await prisma.user.findMany({
        where: { id: { in: adjusterIds } },
        select: { id: true, fullName: true },
      })
    : [];
  const adjusterNames = new Map(adjusters.map((user) => [user.id, user.fullName]));

  const fieldOptions = ADJUSTABLE_FIELDS.map((fieldName) => ({
    value: fieldName,
    label: fieldLabels[fieldName],
    currentValue:
      fieldName === "vendor"
        ? (transaction.vendor ?? "")
        : fieldName === "reference"
          ? (transaction.reference ?? "")
          : fieldName === "amount"
            ? transaction.amount.toFixed(2)
            : fieldName === "transactionDate"
              ? transaction.transactionDate.toISOString().slice(0, 10)
              : fieldName === "currency"
                ? transaction.currency
                : transaction.description,
    inputType: fieldName === "amount" ? ("number" as const) : fieldName === "transactionDate" ? ("date" as const) : ("text" as const),
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/transactions" className="text-sm font-medium text-blue-600 hover:underline">
          All transactions
        </Link>
        <div className="flex items-center gap-2">
          <Landmark size={18} className="text-slate-500" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-900">{transaction.description}</h1>
          <Badge variant={statusBadgeVariant(transaction.status)}>{formatStatus(transaction.status)}</Badge>
        </div>
        <p className="text-sm text-slate-500">
          {formatStatus(transaction.sourceType)} transaction for {session.organizationName} · {formatDate(transaction.transactionDate)}
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-950">Transaction details</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Amount</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-950">{formatAmount(transaction.amount, transaction.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Debit</dt>
            <dd className="mt-1 text-sm text-slate-700">{formatAmount(transaction.debitAmount, transaction.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Credit</dt>
            <dd className="mt-1 text-sm text-slate-700">{formatAmount(transaction.creditAmount, transaction.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Vendor</dt>
            <dd className="mt-1 text-sm text-slate-700">{transaction.vendor ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Reference</dt>
            <dd className="mt-1 text-sm text-slate-700">{transaction.reference ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Source</dt>
            <dd className="mt-1 text-sm text-slate-700">{formatStatus(transaction.sourceType)}</dd>
          </div>
          {transaction.sourceType === SourceType.BANK && transaction.bankAccount ? (
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Bank account</dt>
              <dd className="mt-1 text-sm text-slate-700">
                {transaction.bankAccount.bankName} · {transaction.bankAccount.name}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Import batch</dt>
            <dd className="mt-1 text-sm text-slate-700">
              {transaction.importBatch ? (
                <Link href={`/dashboard/imports/${transaction.importBatch.id}`} className="text-blue-600 hover:underline">
                  {transaction.importBatch.fileName}
                </Link>
              ) : (
                "Manual or unavailable"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Created</dt>
            <dd className="mt-1 text-sm text-slate-700">{formatDateTime(transaction.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-slate-500">Last updated</dt>
            <dd className="mt-1 text-sm text-slate-700">{formatDateTime(transaction.updatedAt)}</dd>
          </div>
        </dl>

        {transaction.status === TransactionStatus.EXCEPTION && transaction.exceptionReason ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="font-semibold">Exception:</span> {transaction.exceptionReason}
          </div>
        ) : null}
      </section>

      {canAdjust ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-950">Correct this transaction</h2>
          <p className="mt-1 text-sm text-slate-500">
            Corrections preserve the original value as history. Every correction requires a reason and is recorded in the audit trail.
          </p>
          <div className="mt-4">
            <AdjustTransactionForm transactionId={transaction.id} fields={fieldOptions} />
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <h2 className="text-sm font-bold text-slate-950">Adjustment history</h2>
          <p className="mt-1 text-sm text-slate-500">Every correction made to this transaction, oldest values preserved.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Field</th>
                <th className="px-4 py-3 font-semibold">Old value</th>
                <th className="px-4 py-3 font-semibold">New value</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Adjusted by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adjustments.length > 0 ? (
                adjustments.map((adjustment) => (
                  <tr key={adjustment.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(adjustment.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-950">
                      {fieldLabels[adjustment.fieldName as AdjustableTransactionField] ?? adjustment.fieldName}
                    </td>
                    <td className="max-w-[160px] px-4 py-3 text-slate-700">{adjustment.oldValue || "—"}</td>
                    <td className="max-w-[160px] px-4 py-3 text-slate-700">{adjustment.newValue || "—"}</td>
                    <td className="max-w-[280px] px-4 py-3 text-slate-700">{adjustment.reason}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {adjusterNames.get(adjustment.createdBy) ?? adjustment.createdBy}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-900">No corrections yet</p>
                    <p className="mt-1 text-sm text-slate-500">This transaction has not been adjusted since it was imported.</p>
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
