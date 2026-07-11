# E-Reconcile MN User Flows

Version: 1.1

## 1. Product Overview

E-Reconcile MN helps finance teams import bank and ledger files, review transactions, manually reconcile records, approve reconciliation runs, export basic reports, and preserve an audit history.

Primary MVP users:

- Organization Admin
- Finance Manager
- Accountant
- Auditor
- Viewer

## 2. Authentication Flow

Login:

1. User enters email and password.
2. System validates credentials.
3. System checks account and membership status.
4. System creates a session.
5. User is redirected to the dashboard.

Forgot password:

1. User opens forgot password from login.
2. User enters email.
3. User receives reset link.
4. User creates a new password.
5. User signs in again.

Invitation acceptance:

1. Admin invites a user by email and role from Users.
2. System emails a one-time link (7-day expiry) via Resend.
3. New user opens the link, sets a full name and password (email is fixed to the invitation).
4. System creates the account and an active membership, and signs the user in.
5. Re-inviting a disabled member's email in the same organization reactivates them (existing password, no new account).

MVP decision:

- MFA implementation is deferred unless required by launch policy.
- Inviting an email that already belongs to a different organization is not supported (single-organization membership only; see Section 12).

## 3. Organization Setup Flow

First organization setup:

1. Admin registers or signs in.
2. Admin creates the organization.
3. Admin enters company name, default currency, and fiscal year start month.
4. System creates the first Admin membership.
5. Admin lands on the dashboard.

## 4. Dashboard Flow

Purpose: provide a compact reconciliation overview.

User sees:

- Total transactions.
- Matched transactions.
- Unmatched transactions.
- Exceptions.
- Recent imports.
- Recent activity.

Quick actions:

- Import transactions.
- Start or continue reconciliation.
- View exceptions.
- Generate MVP reports.

## 5. Transaction Import Flow

Purpose: import bank and ledger data into the system.

Flow:

1. User opens Imports.
2. User uploads a CSV or XLSX file.
3. User selects source type: bank or ledger.
4. System stores the upload under a tenant-scoped storage key.
5. User previews rows.
6. User maps required columns.
7. System validates required fields, formats, currency, duplicate file uploads, and duplicate rows.
8. User confirms import.
9. System creates an import batch, import rows, and normalized transactions for valid rows.
10. System shows processed rows, duplicate rows, and invalid rows.

Required MVP fields:

- Transaction date.
- Description.
- Amount or debit/credit.
- Currency.
- Source type.

Failure handling:

- Show row number.
- Show validation status.
- Show clear error reason.
- Keep import batch history visible.

## 6. Transaction Review Flow

Purpose: allow users to review imported transactions before and during reconciliation.

Flow:

1. User opens Transactions.
2. User searches, filters, and paginates server-side.
3. User opens transaction details.
4. User reviews source, amount, reference, status, notes, and history.

MVP user actions:

- Edit allowed normalized fields.
- Add review note.
- Mark as exception.
- View audit history where permitted.

Out of scope for MVP:

- Document attachment workflow.
- Currency conversion.

## 7. Manual Reconciliation Flow

Purpose: match bank transactions to ledger transactions.

Main flow:

1. User opens Reconciliation.
2. User creates or opens a reconciliation run for a period.
3. System shows unmatched bank and ledger transactions.
4. User compares transaction details.
5. User creates a manual match.
6. System records the match and audit log.
7. User confirms or removes matches as needed.
8. User marks unresolved items as exceptions.
9. User moves the run to ready for review.

Run states:

- `draft`
- `in_progress`
- `ready_for_review`
- `approved`
- `reopened`

## 8. Approval Flow

Purpose: finalize a reconciliation run with clear financial controls.

Flow:

1. Finance Manager or Admin opens a run in `ready_for_review`.
2. Approver reviews matches, exceptions, unmatched items, and notes.
3. Approver approves the run or reopens it for changes.
4. System records approver, approval time, and audit log.
5. Approved runs are locked from normal edits.

Control rule:

- Accountants can prepare reconciliation work but cannot approve a run.
- If required by launch policy, the preparer cannot approve the same run.

## 9. Matching Rules Flow

Purpose: suggest repeated matches after manual reconciliation works.

Flow:

1. Authorized user opens Matching Rules.
2. User creates a simple rule.
3. User defines vendor, description, reference, amount tolerance, date tolerance, and priority.
4. System uses the rule to propose matches.
5. User confirms or rejects proposed matches.

MVP limit:

- Rules do not auto-approve matches.
- Rules are MVP-late and should not block manual reconciliation delivery.

## 10. Reports Flow

Purpose: provide basic reconciliation outputs.

Flow:

1. User opens Reports.
2. User selects report type.
3. User selects date range or reconciliation run.
4. System generates report metadata and a tenant-scoped file.
5. User with `reports.export` downloads the report.
6. System records export audit log.

MVP reports:

- Reconciliation summary.
- Exception list.
- Unmatched transaction list.

Out of scope for MVP:

- Custom report builder.
- Broad audit report exports unless explicitly required.

## 11. Audit Log Flow

Purpose: track important activities.

Tracked actions:

- Sensitive sign-in events where available.
- Import created or processed.
- Transaction edited or noted.
- Match created, confirmed, rejected, or removed.
- Reconciliation run approved or reopened.
- Matching rule created or changed.
- User disabled or assigned a new role.
- Organization settings changed.
- Report exported.

## 12. User Management Flow

Admin flow:

1. Admin opens Users.
2. Admin invites a user by email and role, or reactivates a disabled member by re-inviting their email.
3. Admin changes an active member's role or disables/reactivates a member as needed.
4. System records an audit log for each of these actions and enforces that the organization always keeps at least one active Admin.
5. Invited user accepts (see Section 2) and accesses permitted areas.

MVP roles:

- Admin
- Finance Manager
- Accountant
- Auditor
- Viewer

Deferred:

- Custom role and permission editing.

## 13. Error Handling Flow

Every module must support:

- Loading state.
- Empty state.
- Success message.
- Error message.
- Permission denied.

Examples:

- No transactions: "Transactions have not been imported yet."
- Import failed: "Import failed. Review the row-level errors."
- Permission denied: "You do not have permission to perform this action."

## 14. MVP User Journey

Complete business workflow:

1. Admin creates organization.
2. User signs in.
3. User uploads bank and ledger files.
4. User validates mapping and row-level errors.
5. User reviews transactions.
6. User manually matches transactions.
7. User marks exceptions.
8. Finance Manager approves reconciliation run.
9. User exports summary, exception, and unmatched reports.
10. Audit history is available.

## 15. Future User Flows

Not MVP:

- MFA implementation unless required by launch policy.
- Multi-organization membership / org switching (a user can belong to exactly one organization; see Section 12).
- Direct bank connection.
- AI assistant execution.
- OCR invoice scanning.
- Automated tax reporting.
- Mobile application.
- Custom report builder.