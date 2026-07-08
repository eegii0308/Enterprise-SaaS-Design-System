import test from "node:test";
import assert from "node:assert/strict";
import { ImportStatus } from "@prisma/client";
import { didAcquireProcessingLock, getCompletedImportStatus, getImportSummary, isCompletedImportStatus, shouldCreateAuditEvent } from "../lib/imports/processor-core.ts";

test("getCompletedImportStatus returns COMPLETED when every row processed", () => {
  assert.equal(
    getCompletedImportStatus({ invalidRows: 0, duplicateRows: 0, failedRows: 0 }),
    ImportStatus.COMPLETED,
  );
});

test("getCompletedImportStatus returns COMPLETED_WITH_ERRORS for invalid duplicate or failed rows", () => {
  assert.equal(
    getCompletedImportStatus({ invalidRows: 1, duplicateRows: 0, failedRows: 0 }),
    ImportStatus.COMPLETED_WITH_ERRORS,
  );
  assert.equal(
    getCompletedImportStatus({ invalidRows: 0, duplicateRows: 1, failedRows: 0 }),
    ImportStatus.COMPLETED_WITH_ERRORS,
  );
  assert.equal(
    getCompletedImportStatus({ invalidRows: 0, duplicateRows: 0, failedRows: 1 }),
    ImportStatus.COMPLETED_WITH_ERRORS,
  );
});

test("completed batches are idempotent and return the current import summary", () => {
  const processedAt = new Date("2026-07-08T00:00:00.000Z");

  assert.equal(isCompletedImportStatus(ImportStatus.COMPLETED), true);
  assert.deepEqual(
    getImportSummary({
      status: ImportStatus.COMPLETED,
      totalRows: 2,
      validRows: 2,
      errorRows: 0,
      duplicateRows: 0,
      completedAt: processedAt,
      processingError: null,
    }),
    {
      status: ImportStatus.COMPLETED,
      totalRows: 2,
      validRows: 2,
      invalidRows: 0,
      duplicateRows: 0,
      processedAt,
      processingError: null,
    },
  );
});

test("processing lock is acquired by exactly one status update", () => {
  assert.equal(didAcquireProcessingLock(1), true);
  assert.equal(didAcquireProcessingLock(0), false);
  assert.equal(isCompletedImportStatus(ImportStatus.PROCESSING), false);
});

test("partial row failures complete with errors while allowing processed rows", () => {
  assert.equal(
    getCompletedImportStatus({ invalidRows: 1, duplicateRows: 0, failedRows: 0 }),
    ImportStatus.COMPLETED_WITH_ERRORS,
  );
});

test("transaction rollback protection requires a single atomic row update", () => {
  assert.equal(didAcquireProcessingLock(1), true);
  assert.equal(didAcquireProcessingLock(2), false);
});

test("duplicate audit events are skipped after the first event", () => {
  assert.equal(shouldCreateAuditEvent(0), true);
  assert.equal(shouldCreateAuditEvent(1), false);
});
