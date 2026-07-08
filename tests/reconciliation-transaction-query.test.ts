import test from "node:test";
import assert from "node:assert/strict";
import { SourceType, TransactionStatus } from "@prisma/client";
import { buildReconciliationTransactionQuery } from "../lib/reconciliation/transaction-query.ts";

test("default reconciliation query shows only unmatched transactions", () => {
  const query = buildReconciliationTransactionQuery({}, "org-1");

  assert.equal(query.bankWhere.organizationId, "org-1");
  assert.equal(query.bankWhere.status, TransactionStatus.UNMATCHED);
  assert.equal(query.bankWhere.sourceType, SourceType.BANK);
  assert.equal(query.ledgerWhere.organizationId, "org-1");
  assert.equal(query.ledgerWhere.status, TransactionStatus.UNMATCHED);
  assert.equal(query.ledgerWhere.sourceType, SourceType.LEDGER);
  assert.equal(query.shouldShowBank, true);
  assert.equal(query.shouldShowLedger, true);
});

test("reconciliation query ignores status=MATCHED", () => {
  const query = buildReconciliationTransactionQuery({ status: TransactionStatus.MATCHED }, "org-1");

  assert.equal(query.bankWhere.status, TransactionStatus.UNMATCHED);
  assert.equal(query.ledgerWhere.status, TransactionStatus.UNMATCHED);
});

test("reconciliation query keeps transactions scoped to the current organization", () => {
  const query = buildReconciliationTransactionQuery({ sourceType: SourceType.BANK }, "org-current");

  assert.equal(query.bankWhere.organizationId, "org-current");
  assert.equal(query.ledgerWhere.organizationId, "org-current");
  assert.equal(query.shouldShowBank, true);
  assert.equal(query.shouldShowLedger, false);
});
