"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, ReportStatus, ReportType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requirePermission } from "@/lib/permissions/authorize";
import { generateReportTable, ReportGenerationError } from "@/lib/reports/generation";
import { serializeReportTableToCsv } from "@/lib/reports/csv-writer";
import { getReportStoragePath } from "@/lib/reports/storage";

export type GenerateReportExportState =
  | {
      ok: true;
      message: string;
      reportId: string;
    }
  | {
      ok: false;
      message: string;
      code: string;
    };

export type GenerateReportExportInput = {
  reportType: string;
  periodStart: string;
  periodEnd: string;
};

function isReportType(value: string): value is ReportType {
  return Object.values(ReportType).includes(value as ReportType);
}

function parsePeriodDate(value: string, endOfDay: boolean) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function generateReportExportAction(input: GenerateReportExportInput): Promise<GenerateReportExportState> {
  const session = await requirePermission("reports.export");

  if (!isReportType(input.reportType)) {
    return { ok: false, message: "Select a valid report type.", code: "VALIDATION" };
  }

  const periodStart = parsePeriodDate(input.periodStart, false);
  const periodEnd = parsePeriodDate(input.periodEnd, true);

  if (!periodStart || !periodEnd) {
    return { ok: false, message: "Select a valid period start and end date.", code: "VALIDATION" };
  }

  if (periodStart.getTime() > periodEnd.getTime()) {
    return { ok: false, message: "The period start date must not be after the period end date.", code: "VALIDATION" };
  }

  const reportType = input.reportType;

  const report = await prisma.report.create({
    data: {
      organizationId: session.organizationId,
      reportType,
      periodStart,
      periodEnd,
      status: ReportStatus.PENDING,
      createdBy: session.userId,
    },
    select: { id: true },
  });

  try {
    const table = await generateReportTable(
      { reportType, periodStart, periodEnd },
      { organizationId: session.organizationId },
    );

    const csvText = serializeReportTableToCsv(table);
    const fileStorageKey = `organizations/${session.organizationId}/reports/${report.id}.csv`;
    const storagePath = getReportStoragePath(fileStorageKey);

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, csvText, "utf8");

    await prisma.report.update({
      where: { id: report.id },
      data: { status: ReportStatus.READY, fileStorageKey },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "REPORT_EXPORTED",
        resourceType: "report",
        resourceId: report.id,
        metadata: {
          organizationId: session.organizationId,
          userId: session.userId,
          reportId: report.id,
          reportType,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          timestamp: new Date().toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    revalidatePath("/dashboard/reports");

    return { ok: true, message: "Report generated and exported as CSV.", reportId: report.id };
  } catch (error) {
    await prisma.report.update({
      where: { id: report.id },
      data: { status: ReportStatus.FAILED },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "REPORT_EXPORT_FAILED",
        resourceType: "report",
        resourceId: report.id,
        metadata: {
          organizationId: session.organizationId,
          userId: session.userId,
          reportId: report.id,
          reportType,
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        } satisfies Prisma.JsonObject,
      },
    });

    revalidatePath("/dashboard/reports");

    if (error instanceof ReportGenerationError) {
      return { ok: false, message: error.message, code: error.code };
    }

    return { ok: false, message: "The report could not be generated. Please try again.", code: "SERVER" };
  }
}
