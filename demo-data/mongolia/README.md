# E-Reconcile — Монгол улсын демо өгөгдөл (Mongolia Demo Dataset)

## Зорилго / Purpose

This dataset simulates one month of real-world financial operations for a
Mongolian company, **Номин Финанс ХХК** (a mid-size financial advisory /
non-bank financial institution based in Ulaanbaatar), for the reconciliation
period **July 2026 (2026 оны 7 сар)**.

It is built to demonstrate — and to test — E-Reconcile's core workflow:
importing transaction exports from a bank, an accounting system, and a
payment gateway, then automatically matching them and surfacing the
exceptions a finance team needs to review. All figures use **MNT (₮)** and
all names, invoice numbers, bank references, and dates are Mongolian and
internally consistent across every file, so records can be traced from one
file to another exactly as they would be in a live reconciliation.

## Бизнесийн зохиомж / Business scenario

- **Компани:** Номин Финанс ХХК (РД: 5074123)
- **Банк:** Хаан Банк, харилцах данс 5012001234
- **Хугацаа:** 2026 оны 7 сарын 1–31
- **Эхлэх үлдэгдэл:** ₮850,000,000 → **Эцсийн үлдэгдэл:** ₮1,406,135,000
- Орлого нь харилцагч компаниудад үзүүлсэн санхүүгийн зөвлөх, аудит,
  эрсдэлийн үнэлгээ, зээлийн зөвлөх зэрэг **үйлчилгээний хөлс**-нөөс бүрдэнэ.
- Зарлага нь **цалин, татвар, түрээс, зээлийн төлбөр, нийлүүлэгчийн
  төлбөр, коммунал үйлчилгээ**-нээс бүрдэнэ.

## Файлын тайлбар / File descriptions

### 1. `bank_statement_mn.xlsx` — Bank statement export
500 transactions from Хаан Банк for account `5012001234`, covering:
customer payments (credit), supplier payments, salary runs (15th & 30th),
tax/social-insurance payments, loan installments, office rent, and utility
bills. Includes a running `balance` column computed chronologically.

| Column | Description |
|---|---|
| transaction_id | `BSMN-2026-####` |
| transaction_date | `YYYY.MM.DD HH:MM:SS` (Mongolian bank export format) |
| account_number | Company's Хаан Банк account |
| description | Mongolian narrative (payer/payee + purpose) |
| debit_amount / credit_amount | MNT, one populated per row |
| balance | Running account balance after the transaction |
| currency | `MNT` |
| branch | Хаан Банк branch that processed the transaction |
| reference_number | Invoice ID, PO number, contract number, etc. |

### 2. `accounting_ledger_mn.xlsx` — Accounting software export
500 customer invoices issued by Номин Финанс ХХК, covering 46 realistic
Mongolian counter-parties (ХХК, ХК, ББСБ, and ЖДҮ small businesses), each
with a 10% НӨАТ (VAT) line.

| Column | Description |
|---|---|
| invoice_id | `INV-2026-####` |
| transaction_date | `YYYY.MM.DD` |
| customer_name | Mongolian company name |
| customer_register_number | 7-digit улсын бүртгэлийн дугаар |
| description | Service billed (consulting, audit, risk assessment, etc.) |
| amount | Net amount before tax |
| tax_amount | 10% НӨАТ |
| total_amount | amount + tax_amount |
| payment_status | Paid (425) / Unpaid (40) / Partially Paid (20) / Overdue (15) |

### 3. `payment_gateway_mn.csv` — Payment gateway export
120 payments processed through QPay, SocialPay, Card, and Bank Transfer for
invoices that customers paid online rather than by direct bank transfer.
`payment_reference` matches an `invoice_id` in the accounting ledger.

| Column | Description |
|---|---|
| payment_id | `PG-2026-####` |
| payment_date | `YYYY.MM.DD HH:MM:SS` |
| merchant_name | Номин Финанс ХХК |
| customer_name | Paying customer |
| payment_reference | Matching `invoice_id` |
| amount | MNT |
| status | Success (105) / Failed (10) / Pending (5) |
| payment_method | Bank Transfer, QPay, SocialPay, Card, Cash |

### 4. `unmatched_transactions_mn.csv` — Reconciliation exceptions
100 records representing the kind of exception report E-Reconcile itself
would produce after matching the three files above — the "problem queue" a
finance team reviews.

| Column | Description |
|---|---|
| issue_id | `ISSUE-2026-####` |
| issue_type | Missing Transaction / Amount Difference / Duplicate Transaction / Wrong Reference / Failed Payment / Pending Payment |
| source_system | Bank Statement / Accounting Ledger / Payment Gateway |
| source_transaction_id | Originating record ID |
| related_transaction_id | The record it should have matched (blank if none exists) |
| expected_amount / actual_amount / difference_amount | MNT |
| description, status, notes | Mongolian narrative and review status |

Issue mix: Amount Difference (19), Wrong Reference (18), Duplicate
Transaction (17), Missing Transaction (31), Failed Payment (10), Pending
Payment (5).

### 5. `invalid_import_test_mn.csv` — Import validation test file
20 deliberately malformed rows, in the same schema as
`bank_statement_mn.xlsx`, for testing the file-upload validator. Each row (or
pair of rows) exercises one validation rule:

| Rows | Scenario |
|---|---|
| 9001–9002 | Missing required column (blank `account_number`, blank `description`) |
| 9003–9004 | Empty required values (blank amounts, blank `currency`) |
| 9005–9007 | Invalid dates (`2026.13.45`, `07/45/2026`, blank date) |
| 9008–9010 | Invalid amounts (text `"тав сая"`, negative debit, `"N/A"`) |
| 9011 (×2) | Duplicate `transaction_id` |
| 9013–9014 | Unrealistically large amounts (15-digit value, ₮50 billion debit) |
| 9015–9017 | Wrong currency codes (`USD`, `EUR`, `XYZ` instead of `MNT`) |
| 9018–9020 | Mixed issues: missing ID, debit=credit on same row, invalid calendar date (`2026.02.30`) |

## Хүлээгдэж буй тохирлын үр дүн / Expected reconciliation results

Based on the 500 bank statement transactions for July 2026:

| Category | Count | % |
|---|---|---|
| **Matched** (clean bank transfer + gateway payments tying to an invoice) | ~425 | ~85% |
| **Unmatched** (missing, wrong reference, pending) | ~50 | ~10% |
| **Errors** (amount differences, duplicates, failed payments) | ~25 | ~5% |

`unmatched_transactions_mn.csv` contains 100 rows rather than 75 — the extra
25 are additional edge-case scenarios (further duplicates, wrong references,
amount differences, and missing transactions) layered in for broader QA
coverage beyond the natural July exception set.

## Тест хийх зохиомжууд / Testing scenarios

1. **Happy path import** — Import `bank_statement_mn.xlsx` and
   `accounting_ledger_mn.xlsx`; confirm ~425 transactions auto-match by
   `reference_number` ↔ `invoice_id`.
2. **Gateway reconciliation** — Import `payment_gateway_mn.csv` and confirm
   the 105 `Success` rows match against unpaid-looking bank entries via
   `payment_reference` ↔ `invoice_id`.
3. **Exception review workflow** — Load `unmatched_transactions_mn.csv` into
   the reconciliation workspace and verify each `issue_type` renders with the
   correct severity/status (Open, Under Review, Escalated, Pending).
4. **Import validation** — Upload `invalid_import_test_mn.csv` and confirm
   the importer rejects/flags every row listed in the table above with an
   appropriate, specific error message (not a generic parse failure).
5. **Duplicate detection** — Confirm the importer flags the two
   `BSMN-2026-9011` rows in the invalid-import file, and the
   `Duplicate Transaction` rows in the unmatched file, as duplicates rather
   than silently double-counting them.
6. **Currency guardrails** — Confirm rows 9015–9017 (USD/EUR/XYZ) are
   rejected or routed to a currency-mismatch review queue rather than being
   silently treated as MNT.

## Ашигласан харилцагчид / Reference data used

- **Bank:** Хаан Банк (6 salbars/branches)
- **Tax/social payees:** Улсын Татварын Ерөнхий Газар, Нийгмийн Даатгалын Ерөнхий Газар
- **Loan bank:** Голомт Банк
- **Utility providers:** Улаанбаатар Дулааны Сүлжээ, Улаанбаатар Цахилгаан Түгээх Сүлжээ, Ус Сувгийн Удирдах Газар, Мобиком Корпораци, Юнител Групп
- **46 customer companies** across ХХК, ХК, ББСБ, and ЖДҮ business types
- **14 suppliers** (office supplies, IT, cleaning, security, logistics, audit/legal)
- **30 employees** with realistic Mongolian names for salary runs
