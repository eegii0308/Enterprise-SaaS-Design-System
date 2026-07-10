import Link from "next/link";
import { ImportStatus } from "@prisma/client";
import { FileSpreadsheet, Upload } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { UploadImportForm } from "./UploadImportForm";

const importBatchLimit = 10;

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStatus(status: ImportStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function ImportsPage() {
  const session = await requirePermission("imports.create");
  const importBatches = await prisma.importBatch.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: importBatchLimit,
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      fileHash: true,
      sourceType: true,
      status: true,
      totalRows: true,
      validRows: true,
      errorRows: true,
      duplicateRows: true,
      createdAt: true,
      createdBy: true,
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-slate-900">Imports</h1>
        <p className="text-sm text-slate-500">
          Upload CSV files for {session.organizationName}. Each batch is validated and processed immediately; open a batch
          below to review its results.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <UploadImportForm />

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 p-4">
            <Upload size={16} className="text-blue-600" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900">Recent import batches</h2>
          </div>

          <div className="divide-y divide-slate-100">
            {importBatches.length > 0 ? (
              importBatches.map((importBatch) => (
                <Link
                  key={importBatch.id}
                  href={`/dashboard/imports/${importBatch.id}`}
                  className="grid gap-3 p-4 transition-colors hover:bg-slate-50 lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileSpreadsheet size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
                      <p className="truncate text-sm font-semibold text-slate-950">{importBatch.fileName}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatStatus(importBatch.status)} - {importBatch.sourceType.toLowerCase()} - {formatBytes(importBatch.fileSize)} - hash {importBatch.fileHash.slice(0, 12)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {importBatch.totalRows.toLocaleString("en")} rows · {importBatch.validRows.toLocaleString("en")} imported ·{" "}
                      {importBatch.errorRows.toLocaleString("en")} rejected · {importBatch.duplicateRows.toLocaleString("en")} duplicate
                    </p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-xs font-semibold text-slate-700">{formatDate(importBatch.createdAt)}</p>
                    <p className="mt-1 text-xs text-slate-500">Created by {importBatch.createdBy}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="p-4 text-sm text-slate-500">No import batches have been uploaded for this organization yet.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}