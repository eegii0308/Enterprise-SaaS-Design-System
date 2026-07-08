import { Activity, CheckCircle2, FileClock, Landmark, Upload } from "lucide-react";
import { ReconciliationRunStatus, TransactionStatus } from "@prisma/client";
import { requireSession } from "@/lib/permissions/authorize";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/db/client";

const recentItemLimit = 5;

function formatDate(date: Date | null) {
  if (!date) {
    return "Pending";
  }

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

export default async function DashboardPage() {
  const session = await requireSession();
  const organizationId = session.organizationId;

  const [totalTransactions, unmatchedTransactions, completedReconciliationRuns, recentImports, recentAuditLogs] =
    await Promise.all([
      prisma.transaction.count({ where: { organizationId } }),
      prisma.transaction.count({ where: { organizationId, status: TransactionStatus.UNMATCHED } }),
      prisma.reconciliationRun.count({
        where: {
          organizationId,
          OR: [{ completedAt: { not: null } }, { status: ReconciliationRunStatus.APPROVED }],
        },
      }),
      prisma.importBatch.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: recentItemLimit,
        select: {
          id: true,
          fileName: true,
          status: true,
          sourceType: true,
          totalRows: true,
          validRows: true,
          errorRows: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: recentItemLimit,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          createdAt: true,
        },
      }),
    ]);

  const metrics = [
    {
      label: "Total transactions",
      value: totalTransactions.toLocaleString("en"),
      icon: Landmark,
    },
    {
      label: "Unmatched transactions",
      value: unmatchedTransactions.toLocaleString("en"),
      icon: Activity,
    },
    {
      label: "Completed reconciliation runs",
      value: completedReconciliationRuns.toLocaleString("en"),
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-slate-900">{t("navigation.dashboard")}</h1>
        <p className="text-sm text-slate-500">
          Live reconciliation overview for {session.organizationName}. Data is scoped to your current organization.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((item) => (
          <article key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
              <item.icon size={18} className="shrink-0 text-blue-600" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-950">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <Upload size={16} className="text-blue-600" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">Recent imports</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentImports.length > 0 ? (
              recentImports.map((importBatch) => (
                <article key={importBatch.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{importBatch.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatStatus(importBatch.sourceType)} - {importBatch.totalRows.toLocaleString("en")} rows -{" "}
                      {importBatch.validRows.toLocaleString("en")} valid - {importBatch.errorRows.toLocaleString("en")} errors
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs font-semibold text-slate-700">{formatStatus(importBatch.status)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(importBatch.completedAt ?? importBatch.createdAt)}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <p className="p-4 text-sm text-slate-500">No imports have been created for this organization yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <FileClock size={16} className="text-blue-600" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">Recent audit logs</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAuditLogs.length > 0 ? (
              recentAuditLogs.map((auditLog) => (
                <article key={auditLog.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{auditLog.action}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {auditLog.resourceType}
                      {auditLog.resourceId ? ` - ${auditLog.resourceId}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 sm:text-right">{formatDate(auditLog.createdAt)}</p>
                </article>
              ))
            ) : (
              <p className="p-4 text-sm text-slate-500">No audit activity has been recorded for this organization yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
