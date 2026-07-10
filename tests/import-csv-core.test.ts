import test from "node:test";
import assert from "node:assert/strict";
import { ImportRowStatus, SourceType } from "@prisma/client";
import { buildImportRowSearchText, detectColumnMapping, parseCsv, prepareImportRows } from "../lib/imports/csv-core.ts";

test("parseCsv handles quoted commas and detects import columns", () => {
  const parsed = parseCsv('Date,Description,Amount,Reference\n2026-01-02,"Bank fee, monthly",-12.50,FEE-1\n');

  assert.deepEqual(parsed.headers, ["Date", "Description", "Amount", "Reference"]);
  assert.equal(parsed.records[0].Description, "Bank fee, monthly");
  assert.deepEqual(detectColumnMapping(parsed.headers), {
    transactionDate: "Date",
    description: "Description",
    amount: "Amount",
    reference: "Reference",
  });
});

test("prepareImportRows validates rows and tracks valid invalid and duplicate counts", () => {
  const csv = [
    "Transaction Date,Description,Debit,Credit,Currency,Reference",
    "2026-01-02,Customer payment,,1000,MNT,INV-1",
    "2026-01-02,Customer payment,,1000,MNT,INV-1",
    "not-a-date,Missing date,,25,MNT,INV-2",
    "2026-01-03,Missing amount,,,MNT,INV-3",
  ].join("\n");

  const prepared = prepareImportRows(csv, SourceType.BANK, "batch-1");

  assert.equal(prepared.totalRows, 4);
  assert.equal(prepared.validRows, 1);
  assert.equal(prepared.invalidRows, 2);
  assert.equal(prepared.duplicateRows, 1);
  assert.equal(prepared.rows[0].validationStatus, ImportRowStatus.VALID);
  assert.equal(prepared.rows[1].validationStatus, ImportRowStatus.DUPLICATE);
  assert.equal(prepared.rows[2].validationStatus, ImportRowStatus.INVALID);
  assert.equal(prepared.rows[3].validationStatus, ImportRowStatus.INVALID);
  assert.deepEqual(prepared.rows[0].normalizedData, {
    sourceType: SourceType.BANK,
    transactionDate: "2026-01-02",
    description: "Customer payment",
    amount: 1000,
    debitAmount: 0,
    creditAmount: 1000,
    currency: "MNT",
    reference: "INV-1",
    vendor: "",
  });
});

test("prepareImportRows attaches a searchable searchText built from raw values and error messages to every row", () => {
  const csv = [
    "Transaction Date,Description,Debit,Credit,Currency,Reference",
    "2026-01-02,Customer payment,,1000,MNT,INV-1",
    "not-a-date,Missing date,,25,MNT,INV-2",
  ].join("\n");

  const prepared = prepareImportRows(csv, SourceType.BANK, "batch-1");

  assert.match(prepared.rows[0].searchText, /Customer payment/);
  assert.match(prepared.rows[0].searchText, /INV-1/);
  assert.match(prepared.rows[1].searchText, /Missing date/);
  assert.match(prepared.rows[1].searchText, /Transaction date is missing or invalid\./);
});

test("buildImportRowSearchText joins non-empty raw values and error messages, skipping empty fields", () => {
  const searchText = buildImportRowSearchText(
    { Date: "2026-01-02", Description: "ACME WIDGET CO", Reference: "" },
    ["Amount, debit, or credit is required."],
  );

  assert.match(searchText, /ACME WIDGET CO/);
  assert.match(searchText, /2026-01-02/);
  assert.match(searchText, /Amount, debit, or credit is required\./);
  assert.doesNotMatch(searchText, /Reference/);
});

test("buildImportRowSearchText handles no errors and empty raw data", () => {
  assert.equal(buildImportRowSearchText({}, null), "");
  assert.equal(buildImportRowSearchText({ Date: "2026-01-02" }, null), "2026-01-02");
});
