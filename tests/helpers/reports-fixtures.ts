import { Prisma } from "@prisma/client";
import type { ReconciliationSummaryRow } from "../../lib/reports/generation.ts";
import type { ReconciliationSummaryPresentation } from "../../lib/reports/render/reconciliation-summary.ts";

export function sampleReconciliationSummaryRow(overrides: Partial<ReconciliationSummaryRow> = {}): ReconciliationSummaryRow {
  return {
    reconciliationRunId: "run-1",
    organizationName: "Acme Reconciliation",
    bankAccountId: "account-1",
    bankAccountName: "Operating Account",
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-06-30T23:59:59.999Z"),
    status: "APPROVED",
    preparedByUserId: "user-1",
    preparedByName: "Jane Preparer",
    approvedByUserId: "user-2",
    approvedByName: "Alex Approver",
    preparationDate: new Date("2026-06-01T08:00:00.000Z"),
    approvalDate: new Date("2026-06-05T10:00:00.000Z"),
    currency: "MNT",
    openingBalance: new Prisma.Decimal(0),
    totalDeposits: new Prisma.Decimal(1200),
    totalWithdrawals: new Prisma.Decimal(200),
    bankClosingBalance: new Prisma.Decimal(1000),
    ledgerClosingBalance: new Prisma.Decimal(950),
    variance: new Prisma.Decimal(50),
    matchedAmount: new Prisma.Decimal(930),
    unmatchedBankAmount: new Prisma.Decimal(50),
    unmatchedLedgerAmount: new Prisma.Decimal(0),
    exceptionAmount: new Prisma.Decimal(25),
    outstandingExceptions: 2,
    outstandingTransactions: 1,
    adjustmentCount: 3,
    approvalSummary: "Approved clean, no outstanding items at approval time.",
    ...overrides,
  };
}

export function samplePresentation(
  rows: ReconciliationSummaryRow[] = [sampleReconciliationSummaryRow()],
  overrides: Partial<Omit<ReconciliationSummaryPresentation, "rows">> = {},
): ReconciliationSummaryPresentation {
  return {
    generatedAt: new Date("2026-07-11T12:00:00.000Z"),
    periodStart: new Date("2026-06-01T00:00:00.000Z"),
    periodEnd: new Date("2026-06-30T23:59:59.999Z"),
    rows,
    unmatchedTransactions: {
      headers: ["Transaction ID", "Source", "Transaction Date", "Description", "Vendor", "Reference", "Amount", "Currency"],
      rows: [["txn-9", "BANK", "2026-06-20", "Unmatched deposit", "", "REF-9", "75.00", "MNT"]],
    },
    exceptions: {
      headers: [
        "Transaction ID",
        "Source",
        "Transaction Date",
        "Description",
        "Vendor",
        "Reference",
        "Amount",
        "Currency",
        "Exception Reason",
        "Marked By",
        "Marked At",
      ],
      rows: [["txn-8", "LEDGER", "2026-06-18", "Unrecognized charge", "", "", "25.00", "MNT", "No bank match", "user-1", "2026-06-19T00:00:00.000Z"]],
    },
    adjustments: [
      {
        id: "adj-1",
        transactionId: "txn-7",
        fieldName: "amount",
        oldValue: "100.00",
        newValue: "120.00",
        reason: "Corrected entry",
        createdBy: "user-1",
        createdAt: new Date("2026-06-15T00:00:00.000Z"),
      },
    ],
    ...overrides,
  };
}
