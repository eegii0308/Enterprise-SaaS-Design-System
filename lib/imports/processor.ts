import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ImportRowStatus, ImportStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { prepareImportRows } from "@/lib/imports/csv-core";
import { didAcquireProcessingLock, getCompletedImportStatus, getImportSummary, isCompletedImportStatus, shouldCreateAuditEvent } from "@/lib/imports/processor-core";
import { getImportStoragePath } from "@/lib/imports/storage";

type ImportProcessingSession = {
  organizationId: string;
  userId: string;
};

type NormalizedTransactionData = {
  transactionDate: string;
  amount: number;
  debitAmount: number;
  creditAmount: number;
  currency: string;
  description: string;
  reference: string;
  vendor: string;
};

function getTransactionFingerprint(normalizedData: NormalizedTransactionData) {
  return createHash("sha256")
    .update(JSON.stringify({
      transactionDate: normalizedData.transactionDate,
      amount: normalizedData.amount.toFixed(2),
      currency: normalizedData.currency,
      description: normalizedData.description,
      reference: normalizedData.reference,
    }))
    .digest("hex");
}

function parseNormalizedTransactionData(value: Prisma.JsonValue): NormalizedTransactionData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Valid import row is missing normalized transaction data.");
  }

  const data = value as Record<string, unknown>;
  const transactionDate = typeof data.transactionDate === "string" ? data.transactionDate : "";
  const description = typeof data.description === "string" ? data.description : "";
  const currency = typeof data.currency === "string" ? data.currency : "";
  const reference = typeof data.reference === "string" ? data.reference : "";
  const vendor = typeof data.vendor === "string" ? data.vendor : "";
  const amount = typeof data.amount === "number" ? data.amount : Number.NaN;
  const debitAmount = typeof data.debitAmount === "number" ? data.debitAmount : 0;
  const creditAmount = typeof data.creditAmount === "number" ? data.creditAmount : 0;

  if (!transactionDate || !description || !currency || !Number.isFinite(amount)) {
    throw new Error("Valid import row contains invalid normalized transaction data.");
  }

  return {
    transactionDate,
    amount,
    debitAmount,
    creditAmount,
    currency,
    description,
    reference,
    vendor,
  };
}

async function createImportAuditLog(data: {
  organizationId: string;
  userId: string;
  importBatchId: string;
  action: "IMPORT_PROCESSING_STARTED" | "IMPORT_COMPLETED" | "IMPORT_FAILED";
  metadata?: Prisma.InputJsonValue;
}) {
  const existingAuditLog = await prisma.auditLog.findFirst({
    where: {
      organizationId: data.organizationId,
      action: data.action,
      resourceType: "importBatch",
      resourceId: data.importBatchId,
    },
    select: { id: true },
  });

  if (!shouldCreateAuditEvent(existingAuditLog ? 1 : 0)) {
    return;
  }

  await prisma.auditLog.create({
    data: {
      organizationId: data.organizationId,
      actorUserId: data.userId,
      action: data.action,
      resourceType: "importBatch",
      resourceId: data.importBatchId,
      metadata: data.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function processImportBatch(importBatchId: string, session: ImportProcessingSession) {
  const importBatch = await prisma.importBatch.findUnique({
    where: { id: importBatchId },
    select: {
      id: true,
      organizationId: true,
      sourceType: true,
      fileStorageKey: true,
      status: true,
      totalRows: true,
      validRows: true,
      errorRows: true,
      duplicateRows: true,
      processingError: true,
      completedAt: true,
      createdBy: true,
    },
  });

  if (!importBatch) {
    throw new Error("Import batch was not found.");
  }

  if (importBatch.organizationId !== session.organizationId) {
    throw new Error("Import batch does not belong to the active organization.");
  }

  if (isCompletedImportStatus(importBatch.status)) {
    return getImportSummary(importBatch);
  }

  const lockResult = await prisma.importBatch.updateMany({
    where: {
      id: importBatch.id,
      organizationId: importBatch.organizationId,
      status: ImportStatus.PENDING,
    },
    data: {
      status: ImportStatus.PROCESSING,
      processingError: null,
      completedAt: null,
    },
  });

  if (!didAcquireProcessingLock(lockResult.count)) {
    const currentBatch = await prisma.importBatch.findUnique({
      where: { id: importBatch.id },
      select: {
        status: true,
        totalRows: true,
        validRows: true,
        errorRows: true,
        duplicateRows: true,
        completedAt: true,
        processingError: true,
      },
    });

    if (currentBatch && isCompletedImportStatus(currentBatch.status)) {
      return getImportSummary(currentBatch);
    }

    throw new Error("Import batch is already being processed.");
  }

  await createImportAuditLog({
    organizationId: importBatch.organizationId,
    userId: session.userId,
    importBatchId: importBatch.id,
    action: "IMPORT_PROCESSING_STARTED",
    metadata: {
      organizationId: importBatch.organizationId,
      userId: session.userId,
      importBatchId: importBatch.id,
      timestamp: new Date().toISOString(),
    },
  });

  try {
    const csvText = await readFile(getImportStoragePath(importBatch.fileStorageKey), "utf8");
    const preparedImport = prepareImportRows(csvText, importBatch.sourceType, importBatch.id);

    await prisma.$transaction(async (tx) => {
      const existingRows = await tx.importRow.count({ where: { importBatchId: importBatch.id } });

      if (existingRows === 0 && preparedImport.rows.length > 0) {
        await tx.importRow.createMany({
          data: preparedImport.rows.map((row) => ({
            organizationId: importBatch.organizationId,
            importBatchId: importBatch.id,
            rowNumber: row.rowNumber,
            rawData: row.rawData,
            normalizedData: row.normalizedData ?? Prisma.JsonNull,
            rowHash: row.rowHash,
            validationStatus: row.validationStatus,
            errorMessages: row.errorMessages ?? Prisma.JsonNull,
          })),
        });
      }
    });

    const validRows = await prisma.importRow.findMany({
      where: {
        organizationId: importBatch.organizationId,
        importBatchId: importBatch.id,
        validationStatus: ImportRowStatus.VALID,
        createdTransactionId: null,
      },
      select: {
        id: true,
        normalizedData: true,
      },
      orderBy: { rowNumber: "asc" },
    });

    for (const row of validRows) {
      try {
        await prisma.$transaction(async (tx) => {
          const normalizedData = parseNormalizedTransactionData(row.normalizedData);
          const externalFingerprint = getTransactionFingerprint(normalizedData);
          const existingTransaction = await tx.transaction.findUnique({
            where: {
              organizationId_externalFingerprint: {
                organizationId: importBatch.organizationId,
                externalFingerprint,
              },
            },
            select: { id: true },
          });

          if (existingTransaction) {
            await tx.importRow.update({
              where: { id: row.id },
              data: {
                validationStatus: ImportRowStatus.DUPLICATE,
                errorMessages: ["Transaction already exists for this organization."],
              },
            });

            return;
          }

          const transaction = await tx.transaction.create({
            data: {
              organizationId: importBatch.organizationId,
              importBatchId: importBatch.id,
              transactionDate: new Date(`${normalizedData.transactionDate}T00:00:00.000Z`),
              amount: normalizedData.amount,
              debitAmount: normalizedData.debitAmount,
              creditAmount: normalizedData.creditAmount,
              currency: normalizedData.currency,
              description: normalizedData.description,
              reference: normalizedData.reference || null,
              vendor: normalizedData.vendor || null,
              sourceType: importBatch.sourceType,
              externalFingerprint,
            },
            select: { id: true },
          });

          await tx.importRow.update({
            where: { id: row.id },
            data: {
              validationStatus: ImportRowStatus.PROCESSED,
              createdTransactionId: transaction.id,
            },
          });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          await prisma.importRow.update({
            where: { id: row.id },
            data: {
              validationStatus: ImportRowStatus.DUPLICATE,
              errorMessages: ["Transaction already exists for this organization."],
            },
          });

          continue;
        }

        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            validationStatus: ImportRowStatus.INVALID,
            errorMessages: [error instanceof Error ? error.message : "Transaction creation failed."],
          },
        });
      }
    }

    const summary = await prisma.$transaction(async (tx) => {
      const rowCounts = await tx.importRow.groupBy({
        by: ["validationStatus"],
        where: {
          organizationId: importBatch.organizationId,
          importBatchId: importBatch.id,
        },
        _count: { _all: true },
      });

      const invalidRows = rowCounts.find((row) => row.validationStatus === ImportRowStatus.INVALID)?._count._all ?? 0;
      const duplicateRows = rowCounts.find((row) => row.validationStatus === ImportRowStatus.DUPLICATE)?._count._all ?? 0;
      const processedRows = rowCounts.find((row) => row.validationStatus === ImportRowStatus.PROCESSED)?._count._all ?? 0;
      const failedRows = rowCounts.find((row) => row.validationStatus === ImportRowStatus.VALID)?._count._all ?? 0;
      const completedStatus = getCompletedImportStatus({ invalidRows, duplicateRows, failedRows });
      const completedAt = new Date();

      const completedBatch = await tx.importBatch.update({
        where: { id: importBatch.id },
        data: {
          status: completedStatus,
          totalRows: preparedImport.totalRows,
          validRows: processedRows,
          errorRows: invalidRows + failedRows,
          duplicateRows,
          columnMapping: preparedImport.columnMapping,
          processingError: null,
          completedAt,
        },
        select: {
          status: true,
          totalRows: true,
          validRows: true,
          errorRows: true,
          duplicateRows: true,
          completedAt: true,
          processingError: true,
        },
      });

      const existingCompletedAuditLog = await tx.auditLog.findFirst({
        where: {
          organizationId: importBatch.organizationId,
          action: "IMPORT_COMPLETED",
          resourceType: "importBatch",
          resourceId: importBatch.id,
        },
        select: { id: true },
      });

      if (shouldCreateAuditEvent(existingCompletedAuditLog ? 1 : 0)) {
        await tx.auditLog.create({
          data: {
            organizationId: importBatch.organizationId,
            actorUserId: session.userId,
            action: "IMPORT_COMPLETED",
            resourceType: "importBatch",
            resourceId: importBatch.id,
            metadata: {
              organizationId: importBatch.organizationId,
              userId: session.userId,
              importBatchId: importBatch.id,
              timestamp: completedAt.toISOString(),
              status: completedStatus,
              totalRows: preparedImport.totalRows,
              validRows: processedRows,
              invalidRows,
              duplicateRows,
              failedRows,
            },
          },
        });
      }

      return getImportSummary(completedBatch);
    });

    return summary;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Import processing failed.";
    const failedAt = new Date();

    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: {
        status: ImportStatus.FAILED,
        processingError: errorMessage,
        completedAt: failedAt,
      },
    });

    await createImportAuditLog({
      organizationId: importBatch.organizationId,
      userId: session.userId,
      importBatchId: importBatch.id,
      action: "IMPORT_FAILED",
      metadata: {
        organizationId: importBatch.organizationId,
        userId: session.userId,
        importBatchId: importBatch.id,
        timestamp: failedAt.toISOString(),
        error: errorMessage,
      },
    });

    throw error;
  }
}
