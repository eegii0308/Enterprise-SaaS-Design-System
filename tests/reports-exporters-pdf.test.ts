import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReconciliationSummaryPdfSections,
  renderReconciliationSummaryPdf,
} from "../lib/reports/exporters/pdf.ts";
import { sampleReconciliationSummaryRow, samplePresentation } from "./helpers/reports-fixtures.ts";

function fieldValue(fields: { label: string; value: string }[], label: string) {
  return fields.find((field) => field.label === label)?.value;
}

// ---- Content plan (exact, no PDF parsing needed) ----

test("buildReconciliationSummaryPdfSections produces one section per run with all required header fields", () => {
  const sections = buildReconciliationSummaryPdfSections(samplePresentation());

  assert.equal(sections.length, 1);
  const [section] = sections;

  assert.equal(fieldValue(section!.headerFields, "Organization"), "Acme Reconciliation");
  assert.equal(fieldValue(section!.headerFields, "Bank Account"), "Operating Account");
  assert.equal(fieldValue(section!.headerFields, "Reporting Period"), "2026-06-01 to 2026-06-30");
  assert.equal(fieldValue(section!.headerFields, "Prepared By"), "Jane Preparer");
  assert.equal(fieldValue(section!.headerFields, "Approved By"), "Alex Approver");
  assert.equal(fieldValue(section!.headerFields, "Report Generated"), "2026-07-11 12:00:00 UTC");
  assert.equal(fieldValue(section!.headerFields, "Status"), "APPROVED");
});

test("buildReconciliationSummaryPdfSections includes every required financial summary field, currency-formatted", () => {
  const [section] = buildReconciliationSummaryPdfSections(samplePresentation());

  assert.equal(fieldValue(section!.financialFields, "Opening Balance"), "MNT 0.00");
  assert.equal(fieldValue(section!.financialFields, "Deposits"), "MNT 1200.00");
  assert.equal(fieldValue(section!.financialFields, "Withdrawals"), "MNT 200.00");
  assert.equal(fieldValue(section!.financialFields, "Bank Closing Balance"), "MNT 1000.00");
  assert.equal(fieldValue(section!.financialFields, "Ledger Closing Balance"), "MNT 950.00");
  assert.equal(fieldValue(section!.financialFields, "Variance"), "MNT 50.00");
  assert.equal(fieldValue(section!.financialFields, "Matched Amount"), "MNT 930.00");
  assert.equal(fieldValue(section!.financialFields, "Unmatched Bank"), "MNT 50.00");
  assert.equal(fieldValue(section!.financialFields, "Unmatched Ledger"), "MNT 0.00");
  assert.equal(fieldValue(section!.financialFields, "Exception Amount"), "MNT 25.00");
});

test("buildReconciliationSummaryPdfSections includes every required operational summary field and the approval summary", () => {
  const [section] = buildReconciliationSummaryPdfSections(samplePresentation());

  assert.equal(fieldValue(section!.operationalFields, "Outstanding Exceptions"), "2");
  assert.equal(fieldValue(section!.operationalFields, "Outstanding Transactions"), "1");
  assert.equal(fieldValue(section!.operationalFields, "Adjustment Count"), "3");
  assert.equal(section!.approvalSummary, "Approved clean, no outstanding items at approval time.");
});

test("buildReconciliationSummaryPdfSections shows 'Not yet approved' when there is no approver", () => {
  const [section] = buildReconciliationSummaryPdfSections(
    samplePresentation([sampleReconciliationSummaryRow({ approvedByName: null })]),
  );

  assert.equal(fieldValue(section!.headerFields, "Approved By"), "Not yet approved");
});

test("buildReconciliationSummaryPdfSections produces an empty array when there are no runs", () => {
  assert.deepEqual(buildReconciliationSummaryPdfSections(samplePresentation([])), []);
});

// ---- Rendering (smoke tests: valid output, correct page count, no crash) ----

test("renderReconciliationSummaryPdf produces a valid PDF buffer", async () => {
  const buffer = await renderReconciliationSummaryPdf(samplePresentation());

  assert.ok(buffer.length > 0);
  assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
});

test("renderReconciliationSummaryPdf renders one page per reconciliation run", async () => {
  const rowA = sampleReconciliationSummaryRow({ reconciliationRunId: "run-a" });
  const rowB = sampleReconciliationSummaryRow({ reconciliationRunId: "run-b" });

  const buffer = await renderReconciliationSummaryPdf(samplePresentation([rowA, rowB]));
  const text = buffer.toString("latin1");

  // Object definitions (unlike compressed content streams) are always plain
  // text in a PDF, so counting /Type /Page objects reliably counts pages.
  const pageObjectCount = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  assert.equal(pageObjectCount, 2);
});

test("renderReconciliationSummaryPdf does not throw when there are no runs", async () => {
  const buffer = await renderReconciliationSummaryPdf(samplePresentation([]));
  assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-");
});
