import PDFDocument from "pdfkit";
import type { ReconciliationSummaryPresentation } from "../render/reconciliation-summary.ts";

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date) {
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatAmount(value: { toFixed(digits: number): string }, currency: string) {
  return `${currency} ${value.toFixed(2)}`;
}

export type PdfFieldLine = { label: string; value: string };

export type PdfRunSection = {
  headerFields: PdfFieldLine[];
  financialFields: PdfFieldLine[];
  operationalFields: PdfFieldLine[];
  approvalSummary: string;
};

/**
 * The content plan for the PDF: exactly which labeled fields appear, and
 * what their formatted values are, for each reconciliation run in the
 * presentation model. This is the one place that decides "what goes on the
 * report" -- renderReconciliationSummaryPdf below only lays this plan out
 * visually with pdfkit and performs no formatting decisions of its own.
 * Split out specifically so content can be tested directly, without needing
 * a PDF parser: pdfkit uses kerning-adjusted `TJ` arrays for multi-word
 * text, so the rendered PDF's raw bytes do not contain simple contiguous
 * substrings for anything longer than one word.
 */
export function buildReconciliationSummaryPdfSections(
  presentation: ReconciliationSummaryPresentation,
): PdfRunSection[] {
  return presentation.rows.map((row) => ({
    headerFields: [
      { label: "Organization", value: row.organizationName },
      { label: "Bank Account", value: row.bankAccountName },
      { label: "Reporting Period", value: `${formatDateOnly(row.periodStart)} to ${formatDateOnly(row.periodEnd)}` },
      { label: "Prepared By", value: row.preparedByName },
      { label: "Approved By", value: row.approvedByName ?? "Not yet approved" },
      { label: "Report Generated", value: formatDateTime(presentation.generatedAt) },
      { label: "Status", value: row.status },
    ],
    financialFields: [
      { label: "Opening Balance", value: formatAmount(row.openingBalance, row.currency) },
      { label: "Deposits", value: formatAmount(row.totalDeposits, row.currency) },
      { label: "Withdrawals", value: formatAmount(row.totalWithdrawals, row.currency) },
      { label: "Bank Closing Balance", value: formatAmount(row.bankClosingBalance, row.currency) },
      { label: "Ledger Closing Balance", value: formatAmount(row.ledgerClosingBalance, row.currency) },
      { label: "Variance", value: formatAmount(row.variance, row.currency) },
      { label: "Matched Amount", value: formatAmount(row.matchedAmount, row.currency) },
      { label: "Unmatched Bank", value: formatAmount(row.unmatchedBankAmount, row.currency) },
      { label: "Unmatched Ledger", value: formatAmount(row.unmatchedLedgerAmount, row.currency) },
      { label: "Exception Amount", value: formatAmount(row.exceptionAmount, row.currency) },
    ],
    operationalFields: [
      { label: "Outstanding Exceptions", value: String(row.outstandingExceptions) },
      { label: "Outstanding Transactions", value: String(row.outstandingTransactions) },
      { label: "Adjustment Count", value: String(row.adjustmentCount) },
    ],
    approvalSummary: row.approvalSummary,
  }));
}

function writeSectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text(text);
  doc
    .moveTo(doc.x, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor("#cbd5e1")
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.5);
}

function writeField(doc: PDFKit.PDFDocument, field: PdfFieldLine) {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#334155")
    .text(`${field.label}: `, { continued: true })
    .font("Helvetica")
    .fillColor("#0f172a")
    .text(field.value);
}

function writeRunSection(doc: PDFKit.PDFDocument, section: PdfRunSection) {
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text("Financial Reconciliation Report");
  doc.moveDown(0.75);

  for (const field of section.headerFields) {
    writeField(doc, field);
  }

  writeSectionHeading(doc, "Financial Summary");
  for (const field of section.financialFields) {
    writeField(doc, field);
  }

  writeSectionHeading(doc, "Operational Summary");
  for (const field of section.operationalFields) {
    writeField(doc, field);
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#334155")
    .text("Approval Summary: ", { continued: true })
    .font("Helvetica")
    .fillColor("#0f172a")
    .text(section.approvalSummary);
}

/**
 * Renders one page per reconciliation run, laying out the content plan from
 * buildReconciliationSummaryPdfSections above. Performs no querying and no
 * financial arithmetic of its own -- only formatting and layout.
 */
export function renderReconciliationSummaryPdf(presentation: ReconciliationSummaryPresentation): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // compress: false keeps content streams as plain text in the output
    // bytes -- these are small, text-only accounting documents where the
    // size difference is negligible, and it lets anyone debugging a
    // rendering issue inspect the PDF's text directly.
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true, compress: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const sections = buildReconciliationSummaryPdfSections(presentation);

    if (sections.length === 0) {
      doc.font("Helvetica-Bold").fontSize(16).text("Financial Reconciliation Report");
      doc.moveDown();
      doc
        .font("Helvetica")
        .fontSize(11)
        .text(
          `No reconciliation runs found for ${formatDateOnly(presentation.periodStart)} to ${formatDateOnly(presentation.periodEnd)}.`,
        );
    } else {
      sections.forEach((section, index) => {
        if (index > 0) {
          doc.addPage();
        }
        writeRunSection(doc, section);
      });
    }

    doc.end();
  });
}
