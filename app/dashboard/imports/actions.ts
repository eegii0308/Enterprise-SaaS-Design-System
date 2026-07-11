"use server";

import { createHash } from "node:crypto";
import { ImportStatus, Prisma, SourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { processImportBatch } from "@/lib/imports/processor";
import { putImportFile } from "@/lib/imports/storage";
import { requirePermission } from "@/lib/permissions/authorize";
import { consume } from "@/lib/rate-limit/limiter";
import { rateLimitConfig } from "@/lib/rate-limit/config";

export type UploadImportState = {
  status: "idle" | "success" | "error";
  message: string;
};

const acceptedCsvTypes = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);
const maxFileSizeBytes = 20 * 1024 * 1024;

function isSourceType(value: FormDataEntryValue | null): value is SourceType {
  return value === SourceType.BANK || value === SourceType.LEDGER;
}

function getSafeFileName(fileName: string) {
  const trimmedName = fileName.trim().replaceAll("\\", "/").split("/").pop() ?? "upload.csv";
  const safeName = trimmedName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return safeName || "upload.csv";
}

function isCsvFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return lowerName.endsWith(".csv") || acceptedCsvTypes.has(file.type);
}

export async function uploadImportAction(
  _previousState: UploadImportState,
  formData: FormData,
): Promise<UploadImportState> {
  const session = await requirePermission("imports.create");

  // Checked before any file reading/hashing/storage/processing -- the most
  // expensive parts of this action -- and before the per-org check, so a
  // user hammering the endpoint never eats into their organization's shared
  // budget just to be told they personally are throttled.
  const userLimit = await consume(
    { scope: "imports:upload:user", key: session.userId, ...rateLimitConfig.importUploadUser },
    prisma,
  );

  if (!userLimit.allowed) {
    return { status: "error", message: "You're uploading too quickly. Please wait a moment and try again." };
  }

  // Tenant-fairness guard: caps how much upload/processing load one
  // organization can generate regardless of how many of its users are
  // uploading, independent of the per-user limit above.
  const orgLimit = await consume(
    { scope: "imports:upload:org", key: session.organizationId, ...rateLimitConfig.importUploadOrg },
    prisma,
  );

  if (!orgLimit.allowed) {
    return {
      status: "error",
      message: "This organization has reached its upload limit for now. Please try again later.",
    };
  }

  const sourceType = formData.get("sourceType");
  const fileEntry = formData.get("file");

  if (!isSourceType(sourceType)) {
    return { status: "error", message: "Select whether this CSV is a bank or ledger import." };
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return { status: "error", message: "Choose a non-empty CSV file to upload." };
  }

  if (!isCsvFile(fileEntry)) {
    return { status: "error", message: "Only CSV files are supported in this phase." };
  }

  if (fileEntry.size > maxFileSizeBytes) {
    return { status: "error", message: "CSV files must be 20 MB or smaller." };
  }

  const fileBytes = Buffer.from(await fileEntry.arrayBuffer());
  const fileHash = createHash("sha256").update(fileBytes).digest("hex");
  const safeFileName = getSafeFileName(fileEntry.name);
  const fileStorageKey = `organizations/${session.organizationId}/imports/${fileHash}/${safeFileName}`;

  try {
    await putImportFile(fileStorageKey, fileBytes);

    const importBatch = await prisma.importBatch.create({
      data: {
        organizationId: session.organizationId,
        sourceType,
        fileName: fileEntry.name,
        fileSize: fileEntry.size,
        fileStorageKey,
        fileHash,
        createdBy: session.userId,
        status: ImportStatus.PENDING,
      },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorUserId: session.userId,
        action: "IMPORT_CREATED",
        resourceType: "importBatch",
        resourceId: importBatch.id,
        metadata: {
          organizationId: session.organizationId,
          userId: session.userId,
          importBatchId: importBatch.id,
          timestamp: new Date().toISOString(),
        },
      },
    });

    await processImportBatch(importBatch.id, {
      organizationId: session.organizationId,
      userId: session.userId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/imports");

    return {
      status: "success",
      message: `Upload recorded and processed as import batch ${importBatch.id}.`,
    };
  } catch (error) {
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/imports");

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "This file has already been uploaded for your organization.",
      };
    }

    return { status: "error", message: "The upload could not be processed. Please try again." };
  }
}