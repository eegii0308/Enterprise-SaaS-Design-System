import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileText, Filter } from "lucide-react";
import { ReportStatus, ReportType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { hasPermission, requirePermission } from "@/lib/permissions/authorize";
import { generateReportTable } from "@/lib/reports/generation";
import { firstParam, enumValue, parsePage } from "@/lib/reconciliation/transaction-query";
import { Button } from "@/src/app/components/ui/button";
import { Badge } from "@/src/app/components/ui/badge";
import { GenerateReportButton } from "./ReportActions";

const historyPageSize = 10;

const reportTypeLabels: Record<ReportType, string> = {
  RECONCILIATION_SUMMARY: "Reconciliation summary",
  EXCEPTION_LIST: "Exception list",
  UNMATCHED_TRANSACTIONS: "Unmatched transactions",
};

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
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

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parsePeriodDate(value: string | undefined, endOfDay: boolean) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function defaultPeriodStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function defaultPeriodEnd() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function buildHistoryPageHref(params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("historyPage", page.toString());
  return `/dashboard/reports?${nextParams.toString()}`;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await requirePermission("reports.view");
  const canExport = await hasPermission("reports.export");
  const resolvedSearchParams = (await searchParams) ?? {};

  const reportType = enumValue(ReportType, firstParam(resolvedSearchParams.reportType)) ?? ReportType.RECONCILIATION_SUMMARY;
  const periodStart = parsePeriodDate(firstParam(resolvedSearchParams.periodStart), false) ?? defaultPeriodStart();
  const periodEnd = parsePeriodDate(firstParam(resolvedSearchParams.periodEnd), true) ?? defaultPeriodEnd();
  const historyPage = parsePage(firstParam(resolvedSearchParams.historyPage));

  const currentParams = new URLSearchParams();
  currentParams.set("reportType", reportType);
  currentParams.set("periodStart", toDateInputValue(periodStart));
  currentParams.set("periodEnd", toDateInputValue(periodEnd));

  const [table, reportHistory, totalReports] = await Promise.all([
    generateReportTable({ reportType, periodStart, periodEnd }, { organizationId: session.organizationId }),
    prisma.report.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      skip: (historyPage - 1) * historyPageSize,
      take: historyPageSize,
      select: { id: true, reportType: true, periodStart: true, periodEnd: true, status: true, createdAt: true, fileStorageKey: true },
    }),
    prisma.report.count({ where: { organizationId: session.organizationId } }),
  ]);

  const totalHistoryPages = Math.max(1, Math.ceil(totalReports / historyPageSize));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">
          View reconciliation reports for {session.organizationName} and export them as CSV. Data is scoped to your current
          organization.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <form className="grid gap-4 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_repeat(2,minmax(160px,1fr))_auto] xl:items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Report type</span>
            <select
              name="reportType"
              defaultValue={reportType}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950"
            >
              {Object.values(ReportType).map((option) => (
                <option key={option} value={option}>
                  {reportTypeLabels[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Period start</span>
            <input
              name="periodStart"
              type="date"
              defaultValue={toDateInputValue(periodStart)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Period end</span>
            <input
              name="periodEnd"
              type="date"
              defaultValue={toDateInputValue(periodEnd)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950"
            />
          </label>

          <Button type="submit" className="h-10 gap-2">
            <Filter size={16} aria-hidden="true" />
            View report
          </Button>
        </form>

        <div className="flex flex-col gap-1 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">{reportTypeLabels[reportType]}</h2>
            <p className="text-sm text-slate-500">
              {formatDate(periodStart)} - {formatDate(periodEnd)} · {table.rows.length.toLocaleString("en")} row
              {table.rows.length === 1 ? "" : "s"}
            </p>
          </div>
          {canExport ? (
            <GenerateReportButton
              reportType={reportType}
              periodStart={toDateInputValue(periodStart)}
              periodEnd={toDateInputValue(periodEnd)}
            />
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {table.headers.map((header) => (
                  <th key={header} className="whitespace-nowrap px-4 py-3 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.rows.length > 0 ? (
                table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={table.headers.length} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-900">No data for this period</p>
                    <p className="mt-1 text-sm text-slate-500">Adjust the report type or period to see results.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4">
          <FileText size={16} className="text-blue-600" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900">Export history</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportHistory.length > 0 ? (
                reportHistory.map((report) => (
                  <tr key={report.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{reportTypeLabels[report.reportType]}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={report.status === ReportStatus.READY ? "default" : report.status === ReportStatus.FAILED ? "destructive" : "secondary"}>
                        {formatStatus(report.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(report.createdAt)}</td>
                    <td className="px-4 py-3">
                      {canExport && report.status === ReportStatus.READY && report.fileStorageKey ? (
                        <Button asChild variant="outline" size="sm" className="gap-2">
                          <a href={`/api/reports/${report.id}/download`}>
                            <Download size={14} aria-hidden="true" />
                            CSV
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-900">No reports exported yet</p>
                    <p className="mt-1 text-sm text-slate-500">Generated CSV exports for this organization will appear here.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing {reportHistory.length === 0 ? 0 : (historyPage - 1) * historyPageSize + 1} to{" "}
            {Math.min(historyPage * historyPageSize, totalReports)} of {totalReports.toLocaleString("en")} exports
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className={historyPage <= 1 ? "pointer-events-none opacity-50" : ""}>
              <Link href={buildHistoryPageHref(currentParams, Math.max(1, historyPage - 1))}>
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </Link>
            </Button>
            <span className="text-sm font-medium text-slate-700">
              Page {Math.min(historyPage, totalHistoryPages)} of {totalHistoryPages}
            </span>
            <Button asChild variant="outline" className={historyPage >= totalHistoryPages ? "pointer-events-none opacity-50" : ""}>
              <Link href={buildHistoryPageHref(currentParams, Math.min(totalHistoryPages, historyPage + 1))}>
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
