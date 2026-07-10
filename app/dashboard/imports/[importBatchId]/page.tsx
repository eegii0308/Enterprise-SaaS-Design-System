import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, FileSpreadsheet, Filter, Search } from "lucide-react";
import { ImportRowStatus, ImportStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { getImportSummary } from "@/lib/imports/processor-core";
import { buildImportRowQuery, firstParam } from "@/lib/imports/row-query";
import { Badge } from "@/src/app/components/ui/badge";
import { Button } from "@/src/app/components/ui/button";

const pageSize = 25;

type ImportResultsPageProps = {
  params: Promise<{ importBatchId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function formatRawData(rawData: Prisma.JsonValue) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return "";
  }

  return Object.entries(rawData as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

function getErrorMessages(errorMessages: Prisma.JsonValue) {
  return Array.isArray(errorMessages) ? errorMessages.filter((message): message is string => typeof message === "string") : [];
}

function rowStatusBadgeVariant(status: ImportRowStatus): "secondary" | "destructive" | "outline" {
  if (status === ImportRowStatus.PROCESSED) {
    return "secondary";
  }

  if (status === ImportRowStatus.INVALID) {
    return "destructive";
  }

  return "outline";
}

function buildPageHref(importBatchId: string, params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  nextParams.set("page", page.toString());
  return `/dashboard/imports/${importBatchId}?${nextParams.toString()}`;
}

function buildStatusFilterHref(importBatchId: string, status: ImportRowStatus | "") {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  const query = params.toString();
  return query ? `/dashboard/imports/${importBatchId}?${query}` : `/dashboard/imports/${importBatchId}`;
}

export default async function ImportResultsPage({ params, searchParams }: ImportResultsPageProps) {
  const session = await requirePermission("imports.create");
  const { importBatchId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};

  const importBatch = await prisma.importBatch.findFirst({
    where: { id: importBatchId, organizationId: session.organizationId },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      sourceType: true,
      status: true,
      totalRows: true,
      validRows: true,
      errorRows: true,
      duplicateRows: true,
      processingError: true,
      createdAt: true,
      completedAt: true,
      createdBy: true,
    },
  });

  if (!importBatch) {
    notFound();
  }

  const summary = getImportSummary(importBatch);
  const { status, search, page, where } = buildImportRowQuery(resolvedSearchParams, session.organizationId, importBatch.id);

  const [rows, totalRowsMatched] = await Promise.all([
    prisma.importRow.findMany({
      where,
      orderBy: { rowNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        rowNumber: true,
        rawData: true,
        errorMessages: true,
        validationStatus: true,
      },
    }),
    prisma.importRow.count({ where }),
  ]);

  const currentParams = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    const param = firstParam(value);
    if (param) {
      currentParams.set(key, param);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalRowsMatched / pageSize));
  const firstResult = totalRowsMatched === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalRowsMatched);

  const summaryTiles = [
    { label: "Total processed", value: summary.totalRows, href: buildStatusFilterHref(importBatch.id, "") },
    { label: "Imported", value: summary.validRows, href: buildStatusFilterHref(importBatch.id, ImportRowStatus.PROCESSED) },
    { label: "Rejected", value: summary.invalidRows, href: buildStatusFilterHref(importBatch.id, ImportRowStatus.INVALID) },
    { label: "Duplicate", value: summary.duplicateRows, href: buildStatusFilterHref(importBatch.id, ImportRowStatus.DUPLICATE) },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href="/dashboard/imports" className="text-sm font-medium text-blue-600 hover:underline">
          All import batches
        </Link>
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-slate-500" aria-hidden="true" />
          <h1 className="text-xl font-bold text-slate-900">{importBatch.fileName}</h1>
        </div>
        <p className="text-sm text-slate-500">
          {formatStatus(importBatch.sourceType)} import for {session.organizationName} · {formatBytes(importBatch.fileSize)} ·
          uploaded {formatDateTime(importBatch.createdAt)} by {importBatch.createdBy}
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Import summary</h2>
            <p className="text-sm text-slate-500">
              Status: {formatStatus(summary.status)}
              {summary.processedAt ? ` · Completed ${formatDateTime(summary.processedAt)}` : ""}
            </p>
          </div>
        </div>

        {summary.status === ImportStatus.FAILED && summary.processingError ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{summary.processingError}</span>
          </div>
        ) : null}

        {!summary.processedAt && summary.status !== ImportStatus.FAILED ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This batch has not finished processing yet. Row results below reflect the current state and may change.
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryTiles.map((tile) => (
            <Link
              key={tile.label}
              href={tile.href}
              className="rounded-md border border-slate-100 bg-slate-50 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50"
            >
              <dt className="text-xs font-semibold uppercase text-slate-500">{tile.label}</dt>
              <dd className="mt-1 text-lg font-bold text-slate-950">{tile.value.toLocaleString("en")}</dd>
            </Link>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <form className="grid gap-4 border-b border-slate-100 p-4 md:grid-cols-[1.5fr_1fr_auto] md:items-end">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Search</span>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3">
              <Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input
                name="q"
                defaultValue={search ?? ""}
                placeholder="Error reason or source value"
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">Row status</span>
            <select name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950">
              <option value="">All rows</option>
              {Object.values(ImportRowStatus).map((option) => (
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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Row</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Error reason</th>
                <th className="px-4 py-3 font-semibold">Source values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length > 0 ? (
                rows.map((row) => {
                  const errorMessages = getErrorMessages(row.errorMessages);

                  return (
                    <tr key={row.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-950">{row.rowNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={rowStatusBadgeVariant(row.validationStatus)}>{formatStatus(row.validationStatus)}</Badge>
                      </td>
                      <td className="max-w-[280px] px-4 py-3">
                        {errorMessages.length > 0 ? (
                          <ul className="space-y-1">
                            {errorMessages.map((message, index) => (
                              <li key={index} className="text-xs text-slate-700">
                                {message}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-slate-400">No errors</span>
                        )}
                      </td>
                      <td className="max-w-[420px] px-4 py-3">
                        <p className="truncate text-xs text-slate-600" title={formatRawData(row.rawData)}>
                          {formatRawData(row.rawData) || "No source values"}
                        </p>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-900">No rows found</p>
                    <p className="mt-1 text-sm text-slate-500">Try adjusting the search or row status filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing {firstResult.toLocaleString("en")} to {lastResult.toLocaleString("en")} of {totalRowsMatched.toLocaleString("en")} rows
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
              <Link href={buildPageHref(importBatch.id, currentParams, Math.max(1, page - 1))}>
                <ChevronLeft size={16} aria-hidden="true" />
                Previous
              </Link>
            </Button>
            <span className="text-sm font-medium text-slate-700">
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>
            <Button asChild variant="outline" className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
              <Link href={buildPageHref(importBatch.id, currentParams, Math.min(totalPages, page + 1))}>
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
