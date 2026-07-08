import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ImportRowStatus, ImportStatus, Prisma, SourceType } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { prepareImportRows } from "@/lib/imports/csv-core";
import { getImportStoragePath } from "@/lib/imports/storage";

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

export async function processImportBatch(importBatchId: string) {
  const importBatch = await prisma.importBatch.findUnique({
    where: { id: importBatchId },
    select: {
      id: true,
      organizationId: true,
      sourceType: true,
      fileStorageKey: true,
      status: true,
      createdBy: true,
    },
  });

  if (!importBatch) {
    throw new Error("Import batch was not found.");
  }

  if (importBatch.status !== ImportStatus.PENDING) {
    throw new Error("Only pending import batches can be processed.");
  }

  await prisma.importBatch.update({
    where: { id: importBatch.id },
    data: {
      status: ImportStatus.PROCESSING,
      processingError: null,
      completedAt: null,
    },
  });

  try {
    const csvText = await readFile(getImportStoragePath(importBatch.fileStorageKey), "utf8");
    const preparedImport = prepareImportRows(csvText, importBatch.sourceType, importBatch.id);

    await prisma.$transaction(async (tx) => {
      await tx.importRow.deleteMany({ where: { importBatchId: importBatch.id } });

      if (preparedImport.rows.length > 0) {
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

      if (importBatch.sourceType === SourceType.BANK) {
        const validRows = await tx.importRow.findMany({
          where: {
            organizationId: importBatch.organizationId,
            importBatchId: importBatch.id,
            validationStatus: ImportRowStatus.VALID,
          },
          select: {
            id: true,
            normalizedData: true,
          },
          orderBy: { rowNumber: "asc" },
        });

        for (const row of validRows) {
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
            await tx.importRow.updateMany({
              where: {
                id: row.id,
                organizationId: importBatch.organizationId,
                importBatchId: importBatch.id,
              },
              data: {
                validationStatus: ImportRowStatus.DUPLICATE,
                errorMessages: ["Transaction already exists for this organization."],
              },
            });

            continue;
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
              sourceType: SourceType.BANK,
              externalFingerprint,
            },
            select: { id: true },
          });

          await tx.importRow.updateMany({
            where: {
              id: row.id,
              organizationId: importBatch.organizationId,
              importBatchId: importBatch.id,
            },
            data: {
              validationStatus: ImportRowStatus.PROCESSED,
              createdTransactionId: transaction.id,
            },
          });
        }
      }

      await tx.importBatch.update({
        where: { id: importBatch.id },
        data: {
          status: ImportStatus.COMPLETED,
          totalRows: preparedImport.totalRows,
          validRows: preparedImport.validRows,
          errorRows: preparedImport.invalidRows,
          duplicateRows: preparedImport.duplicateRows,
          columnMapping: preparedImport.columnMapping,
          completedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: importBatch.organizationId,
          actorUserId: importBatch.createdBy,
          action: "TRANSACTION_IMPORT_COMPLETED",
          resourceType: "importBatch",
          resourceId: importBatch.id,
          metadata: {
            user: importBatch.createdBy,
            organization: importBatch.organizationId,
            importBatch: importBatch.id,
          },
        },
      });
    });

    return preparedImport;
  } catch (error) {
    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: {
        status: ImportStatus.FAILED,
        processingError: error instanceof Error ? error.message : "Import processing failed.",
        completedAt: new Date(),
      },
    });

    throw error;
  }
}