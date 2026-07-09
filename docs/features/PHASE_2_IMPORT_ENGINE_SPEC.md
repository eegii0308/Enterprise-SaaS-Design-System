# Phase 2 Implementation Spec: Import Engine

## Purpose

Phase 2 turns the Phase 1 tenant, auth, and permission foundation into a usable financial data intake workflow. The goal is to let authorized users upload bank or ledger CSV/XLSX files, confirm column mapping, validate row-level data, detect duplicates, and create normalized transactions inside the active organization.

Phase 2 should not implement transaction review, reconciliation matching, reports, audit log UI, matching rules, integrations, or billing.

## 1. User Flow

### Happy Path

1. User signs in and opens the protected dashboard.
2. User navigates to Imports.
3. System verifies an active session, active membership, and `imports.create` permission.
4. User selects a source type:
   - Bank
   - Ledger
5. User uploads one CSV or XLSX file.
6. System validates file extension, MIME/content signature, size, and organization-scoped duplicate file hash.
7. System stores the source file with a tenant-scoped storage key.
8. System creates an import batch with `UPLOADED` status.
9. System parses the header row and a preview sample.
10. User confirms column mapping for required fields.
11. User starts processing.
12. System updates the batch to `PROCESSING`.
13. System stores each parsed row in `import_rows` with raw data, normalized data when possible, row hash, validation status, and error messages.
14. System creates `transactions` for valid, non-duplicate rows.
15. System updates row statuses and import batch counts.
16. System completes the batch as:
    - `COMPLETED` when every non-empty row created a transaction.
    - `COMPLETED_WITH_ERRORS` when at least one row is invalid or duplicate.
    - `FAILED` when processing cannot finish safely.
17. User sees import results, including total rows, valid rows, duplicate rows, invalid rows, created transactions, and processing failures.
18. User can open import history and inspect each batch.

### Error And Recovery Paths

1. If the user lacks `imports.create`, the Imports page shows a permission-denied state and upload endpoints return `FORBIDDEN`.
2. If file validation fails, no batch is created unless the file was safely stored and can be represented as a failed batch.
3. If the file was already uploaded for the organization, return a duplicate-file error and link the existing batch when allowed.
4. If mapping is incomplete, keep the batch in `UPLOADED` and show field-level mapping errors.
5. If some rows are invalid, complete the batch with errors and keep row-level details available.
6. If processing fails unexpectedly, mark the batch `FAILED`, store a safe processing error, and prevent partial reruns from creating duplicate transactions.
7. If the user retries a failed or uploaded batch, processing must be idempotent through row hashes and transaction fingerprints.

## 2. Database Changes Needed

The Phase 1 Prisma schema already defines the core Phase 2 models and enums:

- `SourceType`
- `ImportStatus`
- `ImportRowStatus`
- `TransactionStatus`
- `BankAccount`
- `ImportBatch`
- `ImportRow`
- `Transaction`
- `AuditLog`

Required database work for Phase 2:

1. Create and commit the initial Prisma migration if it does not already exist.
2. Confirm all Phase 2 tables exist in the target database:
   - `bank_accounts`
   - `import_batches`
   - `import_rows`
   - `transactions`
   - `audit_logs`
3. Confirm organization scoping exists on every Phase 2 table through `organization_id`.
4. Confirm these uniqueness rules are enforced:
   - `import_batches`: unique `[organization_id, file_hash]`
   - `import_rows`: unique `[organization_id, import_batch_id, row_number]`
   - `import_rows`: unique `[organization_id, row_hash]`
   - `transactions`: unique `[organization_id, external_fingerprint]`
5. Add indexes if query performance requires them during implementation:
   - `import_batches`: `[organization_id, created_at]`
   - `import_batches`: `[organization_id, status]`
   - `import_rows`: `[organization_id, import_batch_id, validation_status]`
   - `transactions`: `[organization_id, source_type, transaction_date]`
6. Decide whether Phase 2 requires persisted mapping data.

Current schema does not include an explicit `column_mapping` field on `import_batches`. Recommended minimal change:

- Add `columnMapping Json? @map("column_mapping")` to `ImportBatch`.
- Add `processingError String? @map("processing_error")` to `ImportBatch` if failed-batch details need to be visible without scanning row errors.

If mapping is not persisted, `POST /api/imports/:id/process` must receive the confirmed mapping and processing must remain reproducible through stored row/raw file data.

Storage requirements:

- Store uploaded files under tenant-scoped keys, for example `organizations/{organizationId}/imports/{importBatchId}/{safeFileName}`.
- Do not expose raw storage keys or signed URL internals in API errors.
- Retention policy can remain internal for Phase 2, but the key format must be stable for later audit and report phases.

Audit events:

- Write an `import.created` event when a batch is created.
- Write an `import.processed` event when processing completes.
- Write an `import.failed` event when processing fails.
- Include safe metadata: source type, file name, file size, row counts, duplicate count, invalid count, and batch status.

## 3. API Endpoints

All endpoints require an authenticated session and active organization membership. Mutations require `imports.create`. Read endpoints require at least `transactions.view` or `imports.create`; prefer allowing Admin, Finance Manager, Accountant, Auditor, and Viewer to read import history if product policy allows.

Responses should follow the existing API design:

```json
{
  "data": {},
  "meta": {}
}
```

Errors should follow:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The uploaded file could not be processed."
  }
}
```

### `POST /api/imports`

Creates an import batch and uploads the file.

Request:

- `multipart/form-data`
- `sourceType`: `BANK` or `LEDGER`
- `file`: CSV or XLSX

Behavior:

- Validate session and `imports.create`.
- Validate source type.
- Validate file extension and content.
- Enforce file size and row-count limits.
- Hash file contents.
- Reject duplicate file hash for the same organization.
- Store file using a tenant-scoped key.
- Create `ImportBatch` with `UPLOADED`.
- Return parsed headers and preview rows for mapping.

Response data:

- `id`
- `sourceType`
- `fileName`
- `fileSize`
- `status`
- `headers`
- `previewRows`
- `createdAt`

### `GET /api/imports`

Lists import history.

Query parameters:

- `page`
- `page_size`
- `source_type`
- `status`
- `date_from`
- `date_to`

Response data:

- Batch rows with id, source type, file name, status, total rows, valid rows, error rows, created by, created at, completed at.
- Pagination metadata.

### `GET /api/imports/:id`

Returns import batch details.

Response data:

- Batch metadata.
- Mapping status.
- Row counts.
- Duplicate count.
- Invalid count.
- Created transaction count.
- Safe processing error if present.
- First page of row-level errors.

### `GET /api/imports/:id/rows`

Returns import rows for review.

Query parameters:

- `page`
- `page_size`
- `validation_status`

Response data:

- `rowNumber`
- `rawData`
- `normalizedData`
- `validationStatus`
- `errorMessages`
- `createdTransactionId`

### `POST /api/imports/:id/process`

Starts processing after mapping is confirmed.

Request JSON:

```json
{
  "mapping": {
    "transactionDate": "Date",
    "description": "Description",
    "debitAmount": "Debit",
    "creditAmount": "Credit",
    "amount": null,
    "currency": "Currency",
    "vendor": "Vendor",
    "reference": "Reference",
    "bankAccount": "Account"
  }
}
```

Behavior:

- Validate session and `imports.create`.
- Confirm batch belongs to active organization.
- Allow processing only from `UPLOADED` or retryable `FAILED`.
- Validate mapping.
- Parse file rows.
- Normalize values.
- Detect duplicate rows.
- Create transactions for valid non-duplicate rows.
- Update batch status and counts.
- Write audit event.

Response data:

- Batch id.
- Final status.
- Total rows.
- Valid rows.
- Error rows.
- Duplicate rows.
- Created transactions.

### `GET /api/transactions`

Phase 2 may implement a limited transaction list only if needed to verify imports. Full transaction review remains Phase 3.

Minimum useful parameters:

- `page`
- `page_size`
- `source_type`
- `import_batch_id`

## 4. UI Components Needed

Route shells:

- `/dashboard/imports`
- `/dashboard/imports/[id]`

Components:

- `ImportSourceSelector`
  - Segmented control or radio group for Bank/Ledger.
- `ImportUploadDropzone`
  - File picker/dropzone with accepted file types, max size hint, selected file state, and upload progress.
- `ImportMappingTable`
  - Shows detected headers and lets users map required normalized fields.
- `ImportPreviewTable`
  - Shows sample rows before processing.
- `ImportValidationSummary`
  - Shows total rows, valid rows, invalid rows, duplicate rows, and created transactions.
- `ImportRowErrorsTable`
  - Paginated table for invalid and duplicate rows with row number, raw values, and errors.
- `ImportHistoryTable`
  - Paginated, filterable batch history.
- `ImportStatusBadge`
  - Visual status for `UPLOADED`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`.
- `ImportEmptyState`
  - Used when no imports exist.
- `ImportPermissionDenied`
  - Used when a user can view the dashboard but cannot create imports.
- `ImportProcessingState`
  - Stable loading state while processing is in progress.

Existing UI primitives to reuse:

- Button
- Card only for repeated items or tool panels
- Table
- Select
- Input
- Badge
- Alert
- Progress
- Tabs if separating Overview, Errors, and Transactions on the import detail page

Navigation:

- Add Imports entry to protected dashboard navigation when that layout exists.
- Dashboard quick action "Import transactions" should route to `/dashboard/imports`.

## 5. Validation Rules

### File Validation

- Accepted extensions: `.csv`, `.xlsx`.
- Reject executable, archive, XML/OFX/QFX, PDF, image, and unknown file types.
- Validate content signature in addition to extension/MIME.
- Enforce a documented maximum file size.
- Enforce a documented maximum row count.
- Reject empty files.
- Reject files without a header row.
- Reject files with no data rows after trimming empty rows.

Recommended Phase 2 limits unless product policy changes:

- Max file size: 10 MB.
- Max rows per upload: 10,000.
- Max columns per upload: 100.

### Mapping Validation

Required normalized fields:

- `transactionDate`
- `description`
- `currency`
- `sourceType`
- Either `amount` or both `debitAmount` and `creditAmount`

Optional normalized fields:

- `vendor`
- `reference`
- `bankAccount`

Rules:

- Each required field must map to an existing source column unless source type is supplied by the upload form.
- A source column should not be mapped to multiple required normalized fields, except where explicitly allowed.
- `amount` cannot be combined with `debitAmount`/`creditAmount` for the same import mapping.
- For bank imports, `bankAccount` may be optional in Phase 2 but should be supported by the schema through `bankAccountId`.

### Row Validation

- Transaction date must parse to a valid date.
- Description is required after trimming.
- Currency is required and must match the organization default currency for MVP.
- Amount values must parse as decimal monetary values.
- Exactly one of debit or credit must be positive when debit/credit columns are used.
- A signed amount must be non-zero when the single amount column is used.
- Amount precision is limited to two decimal places.
- Source type must be `BANK` or `LEDGER`.
- Empty rows are ignored or marked invalid consistently; prefer ignoring fully empty trailing rows.
- Row hash should be generated from organization id, source type, normalized date, description, amount, currency, reference, and raw row identity where appropriate.
- Transaction external fingerprint should be stable enough to prevent duplicate transaction creation on retries.

### Status Rules

Import batch:

- `UPLOADED` -> `PROCESSING`
- `PROCESSING` -> `COMPLETED`
- `PROCESSING` -> `COMPLETED_WITH_ERRORS`
- `PROCESSING` -> `FAILED`
- `FAILED` -> `PROCESSING` only when retry is safe

Import row:

- `PENDING` -> `VALID`
- `PENDING` -> `DUPLICATE`
- `PENDING` -> `INVALID`
- `VALID` -> `PROCESSED`

Transaction:

- Created Phase 2 transactions default to `UNMATCHED`.
- Phase 2 must not set transactions to `MATCHED`; that belongs to reconciliation.
- Invalid rows must not create transactions.
- Duplicate rows must not create new transactions.

## 6. Error Handling

Use stable error codes and safe messages. Do not expose stack traces, SQL errors, storage paths, signed URLs, parser internals, or raw secrets.

Recommended error codes:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `FILE_TOO_LARGE`
- `UNSUPPORTED_FILE_TYPE`
- `EMPTY_FILE`
- `ROW_LIMIT_EXCEEDED`
- `DUPLICATE_FILE`
- `INVALID_MAPPING`
- `IMPORT_NOT_PROCESSABLE`
- `IMPORT_PROCESSING_FAILED`
- `RATE_LIMITED`

User-facing patterns:

- Field errors for source type, file, and mapping fields.
- Row-level errors for invalid import rows.
- Batch-level error for processing failure.
- Generic permission message for forbidden actions.
- Generic duplicate file message with existing batch reference when available.

Operational rules:

- Use transactions around database writes that must stay consistent.
- If processing partially succeeds, do not leave the batch in `PROCESSING`.
- Make processing idempotent by checking row hashes and transaction fingerprints before creating rows/transactions.
- Log server-side errors with enough internal context to debug, but keep API responses safe.
- If storage succeeds but database creation fails, schedule cleanup or mark the orphaned storage object for manual cleanup.
- If database creation succeeds but storage fails, mark the batch `FAILED` only if a batch was created; otherwise return a safe upload error.

## 7. Testing Checklist

### Unit Tests

- Permission helper rejects users without `imports.create` for upload/process mutations.
- File type validator accepts CSV and XLSX.
- File type validator rejects unsupported extensions and mismatched content.
- File size and row limit checks work at boundary values.
- Mapping validator accepts `amount` mapping.
- Mapping validator accepts `debitAmount` plus `creditAmount` mapping.
- Mapping validator rejects missing required fields.
- Mapping validator rejects conflicting amount modes.
- Date normalization handles expected formats.
- Amount normalization handles signed amount, debit, credit, commas, and two-decimal precision.
- Currency validation rejects non-default currency.
- Row hash generation is stable.
- Transaction fingerprint generation is stable.
- Duplicate file detection is organization-scoped.
- Duplicate row detection is organization-scoped.

### API Tests

- Unauthenticated upload returns `UNAUTHENTICATED`.
- User without active membership cannot upload.
- User without `imports.create` cannot upload or process.
- Upload creates an `UPLOADED` batch for a valid CSV.
- Upload creates an `UPLOADED` batch for a valid XLSX.
- Duplicate upload returns `DUPLICATE_FILE`.
- Invalid file type returns `UNSUPPORTED_FILE_TYPE`.
- Oversized file returns `FILE_TOO_LARGE`.
- Processing valid bank rows creates `UNMATCHED` bank transactions.
- Processing valid ledger rows creates `UNMATCHED` ledger transactions.
- Processing invalid rows stores row errors and returns `COMPLETED_WITH_ERRORS`.
- Retrying a failed/imported batch does not create duplicate transactions.
- Import history is scoped to the active organization.
- Import detail does not leak another organization's batch.
- Import rows endpoint is paginated and organization-scoped.
- Processing writes audit events.

### Component Tests

- Import page renders source selector and upload control for permitted users.
- Permission-denied state renders for users without import permission.
- Upload form blocks submit without source type.
- Upload form blocks submit without file.
- Mapping table shows required fields.
- Mapping table shows validation errors for incomplete mapping.
- Validation summary displays completed, completed-with-errors, and failed states.
- Row error table displays row number, raw values, and error messages.
- Import history empty state appears when no imports exist.

### End-To-End Smoke Test

1. Register first Admin organization.
2. Sign in as Admin or Accountant.
3. Upload a representative bank CSV.
4. Confirm mapping.
5. Process import.
6. Confirm batch completes and transactions are created.
7. Upload a representative ledger XLSX.
8. Confirm mapping.
9. Process import.
10. Confirm import history shows both batches.
11. Upload the same bank file again.
12. Confirm duplicate file handling.
13. Upload a file with invalid rows.
14. Confirm row-level errors and `COMPLETED_WITH_ERRORS`.

### Manual QA

- Verify keyboard navigation through source selection, file upload, mapping, and processing.
- Verify loading, empty, error, duplicate, and permission-denied states.
- Verify large valid files remain responsive within accepted limits.
- Verify API responses do not include stack traces, SQL details, or storage internals.
- Verify Phase 2 does not expose reconciliation actions before Phase 4.
