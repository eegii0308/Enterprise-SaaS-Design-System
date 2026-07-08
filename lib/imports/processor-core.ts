import { ImportStatus } from "@prisma/client";

export type ImportSummary = {
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  processedAt: Date | null;
  processingError: string | null;
};

export function isCompletedImportStatus(status: ImportStatus) {
  return status === ImportStatus.COMPLETED
    || status === ImportStatus.COMPLETED_WITH_ERRORS
    || status === ImportStatus.FAILED;
}

export function getCompletedImportStatus(counts: {
  invalidRows: number;
  duplicateRows: number;
  failedRows: number;
}) {
  return counts.invalidRows > 0 || counts.duplicateRows > 0 || counts.failedRows > 0
    ? ImportStatus.COMPLETED_WITH_ERRORS
    : ImportStatus.COMPLETED;
}

export function getImportSummary(batch: {
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  completedAt: Date | null;
  processingError: string | null;
}): ImportSummary {
  return {
    status: batch.status,
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    invalidRows: batch.errorRows,
    duplicateRows: batch.duplicateRows,
    processedAt: batch.completedAt,
    processingError: batch.processingError,
  };
}

export function shouldCreateAuditEvent(existingEventCount: number) {
  return existingEventCount === 0;
}

export function didAcquireProcessingLock(updatedRows: number) {
  return updatedRows === 1;
}
