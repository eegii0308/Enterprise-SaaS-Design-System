import { NextResponse } from "next/server";
import { Prisma, ReportStatus, ReportType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { getReportFile } from "@/lib/reports/storage";
import { buildReconciliationSummaryPresentation } from "@/lib/reports/render/reconciliation-summary";
import { renderReconciliationSummaryPdf } from "@/lib/reports/exporters/pdf";
import { renderReconciliationSummaryXlsx } from "@/lib/reports/exporters/xlsx";

const exportFormats = ["csv", "pdf", "xlsx"] as const;
type ExportFormat = (typeof exportFormats)[number];

function isExportFormat(value: string | null): value is ExportFormat {
  return exportFormats.includes(value as ExportFormat);
}

const contentTypeByFormat: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const session = await requirePermission("reports.export");
  const { reportId } = await params;

  const formatParam = new URL(request.url).searchParams.get("format");
  const format: ExportFormat = isExportFormat(formatParam) ? formatParam : "csv";

  const report = await prisma.report.findFirst({
    where: { id: reportId, organizationId: session.organizationId },
    select: {
      id: true,
      status: true,
      fileStorageKey: true,
      reportType: true,
      periodStart: true,
      periodEnd: true,
    },
  });

  if (!report || report.status !== ReportStatus.READY) {
    return NextResponse.json({ message: "Report export was not found." }, { status: 404 });
  }

  // PDF/XLSX render the rich financial-report presentation model
  // (render/reconciliation-summary.ts), which only makes sense for
  // RECONCILIATION_SUMMARY reports; the other report types remain CSV-only.
  if (format !== "csv" && report.reportType !== ReportType.RECONCILIATION_SUMMARY) {
    return NextResponse.json(
      { message: "PDF and XLSX export are only available for the financial reconciliation report." },
      { status: 400 },
    );
  }

  const baseFileName = `${report.reportType.toLowerCase()}_${report.periodStart.toISOString().slice(0, 10)}_${report.periodEnd
    .toISOString()
    .slice(0, 10)}`;

  try {
    let fileBuffer: Buffer;
    let fileName: string;

    if (format === "csv") {
      if (!report.fileStorageKey) {
        return NextResponse.json({ message: "Report export was not found." }, { status: 404 });
      }

      fileBuffer = await getReportFile(report.fileStorageKey);
      fileName = `${baseFileName}.csv`;
    } else {
      // PDF/XLSX are rendered on demand from the current data (not a stored
      // file) so they always reflect the latest state, using the exact same
      // presentation model regardless of format -- no separate calculation
      // happens here or in either exporter.
      const presentation = await buildReconciliationSummaryPresentation(
        { periodStart: report.periodStart, periodEnd: report.periodEnd },
        { organizationId: session.organizationId },
      );

      if (format === "pdf") {
        fileBuffer = await renderReconciliationSummaryPdf(presentation);
        fileName = `${baseFileName}.pdf`;
      } else {
        fileBuffer = await renderReconciliationSummaryXlsx(presentation);
        fileName = `${baseFileName}.xlsx`;
      }
    }

    // Every download -- the first one right after export, or any later
    // repeat download, in any format -- is audited here, since this route is
    // the single code path all of them go through.
    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "REPORT_DOWNLOADED",
        resourceType: "report",
        resourceId: report.id,
        metadata: {
          organizationId: session.organizationId,
          userId: session.userId,
          reportId: report.id,
          reportType: report.reportType,
          format,
          timestamp: new Date().toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeByFormat[format],
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error(`Report download failed (report ${report.id}, format ${format}):`, error);
    return NextResponse.json({ message: "Report export file could not be read." }, { status: 500 });
  }
}
