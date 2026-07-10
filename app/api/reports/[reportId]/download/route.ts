import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { getReportStoragePath } from "@/lib/reports/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const session = await requirePermission("reports.export");
  const { reportId } = await params;

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

  if (!report || report.status !== ReportStatus.READY || !report.fileStorageKey) {
    return NextResponse.json({ message: "Report export was not found." }, { status: 404 });
  }

  try {
    const storagePath = getReportStoragePath(report.fileStorageKey);
    const fileBuffer = await readFile(storagePath);
    const fileName = `${report.reportType.toLowerCase()}_${report.periodStart.toISOString().slice(0, 10)}_${report.periodEnd
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ message: "Report export file could not be read." }, { status: 500 });
  }
}
