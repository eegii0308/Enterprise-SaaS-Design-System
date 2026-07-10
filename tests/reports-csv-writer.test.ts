import test from "node:test";
import assert from "node:assert/strict";
import { escapeCsvField, serializeReportTableToCsv } from "../lib/reports/csv-writer.ts";
import type { ReportTable } from "../lib/reports/generation.ts";

test("escapeCsvField leaves plain values unquoted", () => {
  assert.equal(escapeCsvField("Acme Corp"), "Acme Corp");
  assert.equal(escapeCsvField(""), "");
});

test("escapeCsvField quotes and doubles embedded quotes", () => {
  assert.equal(escapeCsvField('Say "hello"'), '"Say ""hello"""');
});

test("escapeCsvField quotes values containing commas", () => {
  assert.equal(escapeCsvField("Acme, Inc."), '"Acme, Inc."');
});

test("escapeCsvField quotes values containing newlines", () => {
  assert.equal(escapeCsvField("Line one\nLine two"), '"Line one\nLine two"');
  assert.equal(escapeCsvField("Line one\r\nLine two"), '"Line one\r\nLine two"');
});

test("serializeReportTableToCsv writes a header row followed by data rows with CRLF line endings", () => {
  const table: ReportTable = {
    headers: ["Transaction ID", "Description", "Amount"],
    rows: [
      ["txn-1", "Vendor invoice", "100.00"],
      ["txn-2", "Acme, Inc. refund", "-50.00"],
    ],
  };

  const csv = serializeReportTableToCsv(table);

  assert.equal(
    csv,
    'Transaction ID,Description,Amount\r\ntxn-1,Vendor invoice,100.00\r\ntxn-2,"Acme, Inc. refund",-50.00\r\n',
  );
});

test("serializeReportTableToCsv handles an empty row set", () => {
  const table: ReportTable = { headers: ["A", "B"], rows: [] };

  assert.equal(serializeReportTableToCsv(table), "A,B\r\n");
});
