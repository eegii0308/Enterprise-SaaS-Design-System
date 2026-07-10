import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { getReportStoragePath } from "../lib/reports/storage.ts";

const expectedRoot = process.env.REPORT_UPLOAD_ROOT ?? path.join(process.cwd(), ".uploads");

test("getReportStoragePath resolves a normal key under the storage root", () => {
  const storagePath = getReportStoragePath("organizations/org-1/reports/report-1.csv");

  assert.equal(storagePath, path.resolve(expectedRoot, "organizations/org-1/reports/report-1.csv"));
});

test("getReportStoragePath normalizes backslashes in the key", () => {
  const storagePath = getReportStoragePath("organizations\\org-1\\reports\\report-1.csv");

  assert.equal(storagePath, path.resolve(expectedRoot, "organizations/org-1/reports/report-1.csv"));
});

test("getReportStoragePath rejects a key that escapes the storage root via ..", () => {
  assert.throws(() => getReportStoragePath("../../etc/passwd"), /Invalid report storage key/);
});

test("getReportStoragePath rejects a key that escapes the storage root via a nested ..", () => {
  assert.throws(() => getReportStoragePath("organizations/org-1/../../../etc/passwd"), /Invalid report storage key/);
});

test("getReportStoragePath rejects an absolute path outside the storage root", () => {
  const outsidePath = path.resolve(expectedRoot, "..", "outside.csv");
  assert.throws(() => getReportStoragePath(outsidePath), /Invalid report storage key/);
});
