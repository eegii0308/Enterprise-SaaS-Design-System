import test from "node:test";
import assert from "node:assert/strict";
import { ImportRowStatus } from "@prisma/client";
import { buildImportRowQuery, enumValue, firstParam, parsePage } from "../lib/imports/row-query.ts";

test("buildImportRowQuery scopes rows to the organization and import batch with no filters by default", () => {
  const query = buildImportRowQuery({}, "org-1", "batch-1");

  assert.deepEqual(query.where, { organizationId: "org-1", importBatchId: "batch-1" });
  assert.equal(query.status, undefined);
  assert.equal(query.search, undefined);
  assert.equal(query.page, 1);
});

test("buildImportRowQuery filters by a valid validationStatus", () => {
  const query = buildImportRowQuery({ status: ImportRowStatus.INVALID }, "org-1", "batch-1");

  assert.equal(query.status, ImportRowStatus.INVALID);
  assert.deepEqual(query.where, {
    organizationId: "org-1",
    importBatchId: "batch-1",
    validationStatus: ImportRowStatus.INVALID,
  });
});

test("buildImportRowQuery ignores an unrecognized status value", () => {
  const query = buildImportRowQuery({ status: "NOT_A_REAL_STATUS" }, "org-1", "batch-1");

  assert.equal(query.status, undefined);
  assert.equal("validationStatus" in query.where, false);
});

test("buildImportRowQuery adds a case-insensitive contains filter on searchText when a search term is given", () => {
  const query = buildImportRowQuery({ q: "  ACME  " }, "org-1", "batch-1");

  assert.equal(query.search, "ACME");
  assert.deepEqual(query.where.searchText, { contains: "ACME", mode: "insensitive" });
});

test("buildImportRowQuery combines status and search filters", () => {
  const query = buildImportRowQuery({ status: ImportRowStatus.DUPLICATE, q: "already exists" }, "org-1", "batch-1");

  assert.deepEqual(query.where, {
    organizationId: "org-1",
    importBatchId: "batch-1",
    validationStatus: ImportRowStatus.DUPLICATE,
    searchText: { contains: "already exists", mode: "insensitive" },
  });
});

test("buildImportRowQuery keeps different batches and organizations isolated from each other", () => {
  const query = buildImportRowQuery({}, "org-2", "batch-9");

  assert.equal(query.where.organizationId, "org-2");
  assert.equal(query.where.importBatchId, "batch-9");
});

test("buildImportRowQuery parses a valid page number, defaulting to 1 for invalid input", () => {
  assert.equal(buildImportRowQuery({ page: "3" }, "org-1", "batch-1").page, 3);
  assert.equal(buildImportRowQuery({ page: "0" }, "org-1", "batch-1").page, 1);
  assert.equal(buildImportRowQuery({ page: "-1" }, "org-1", "batch-1").page, 1);
  assert.equal(buildImportRowQuery({ page: "not-a-number" }, "org-1", "batch-1").page, 1);
  assert.equal(buildImportRowQuery({}, "org-1", "batch-1").page, 1);
});

test("firstParam returns the first element of an array param or the scalar value unchanged", () => {
  assert.equal(firstParam(["a", "b"]), "a");
  assert.equal(firstParam("a"), "a");
  assert.equal(firstParam(undefined), undefined);
});

test("parsePage rejects non-integer and non-positive values", () => {
  assert.equal(parsePage("2.5"), 1);
  assert.equal(parsePage(undefined), 1);
});

test("enumValue only accepts values that belong to the given enum", () => {
  assert.equal(enumValue(ImportRowStatus, ImportRowStatus.VALID), ImportRowStatus.VALID);
  assert.equal(enumValue(ImportRowStatus, "bogus"), undefined);
  assert.equal(enumValue(ImportRowStatus, undefined), undefined);
});
