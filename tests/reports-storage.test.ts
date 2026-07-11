import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getReportFile, putReportFile } from "../lib/reports/storage.ts";

let testRoot: string;

test.before(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), "reports-storage-test-"));
  process.env.STORAGE_DRIVER = "local";
  process.env.STORAGE_LOCAL_ROOT = testRoot;
});

test.after(async () => {
  if (testRoot) {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test("putReportFile writes a file that getReportFile reads back", async () => {
  await putReportFile("organizations/org-1/reports/report-1.csv", "a,b,c\n1,2,3\n");

  const buffer = await getReportFile("organizations/org-1/reports/report-1.csv");

  assert.equal(buffer.toString("utf8"), "a,b,c\n1,2,3\n");
});

test("putReportFile normalizes backslashes in the key", async () => {
  await putReportFile("organizations\\org-1\\reports\\report-2.csv", "x,y\n1,2\n");

  const buffer = await getReportFile("organizations/org-1/reports/report-2.csv");

  assert.equal(buffer.toString("utf8"), "x,y\n1,2\n");
});

test("getReportFile rejects a key that escapes the storage root via ..", async () => {
  await assert.rejects(() => getReportFile("../../etc/passwd"), /Invalid storage key/);
});

test("getReportFile rejects a key that escapes the storage root via a nested ..", async () => {
  await assert.rejects(
    () => getReportFile("organizations/org-1/../../../etc/passwd"),
    /Invalid storage key/,
  );
});

test("putReportFile rejects a key that escapes the storage root via ..", async () => {
  await assert.rejects(() => putReportFile("../../etc/passwd", "data"), /Invalid storage key/);
});
