# Localization Audit

Scope: user-facing hardcoded English text found in source files for the current Next.js app and the prototype UI. Generated `dist/` assets contain duplicated bundled strings and should be regenerated after source localization, not edited directly.

Primary files audited:

- `app/**/*.tsx`
- `features/auth/components/*.tsx`
- `lib/auth/actions.ts`
- `lib/auth/core.ts`
- `lib/errors.ts`
- `lib/validations/auth.ts`
- `lib/permissions/roles.ts`
- `src/app/App.tsx`

## 1. Authentication

### Current Next.js auth flow

- `app/login/page.tsx`
  - Page title/subtitle: `Sign in`, `Use your organization account to continue.`
- `app/register/page.tsx`
  - Page title/subtitle: `Create first organization`, `This one-time setup creates the first Admin membership.`
- `app/forgot-password/page.tsx`
  - Page title/subtitle: `Reset password`, `Request a reset link for an active account.`
- `features/auth/components/LoginForm.tsx`
  - Labels/buttons/links: `Email`, `Password`, `Sign in`, `Forgot password?`, `First admin setup`
- `features/auth/components/RegisterForm.tsx`
  - Labels/buttons/links: `Full name`, `Email`, `Password`, `Organization`, `Currency`, `Fiscal month`, `Create organization`, `Back to sign in`
- `features/auth/components/ForgotPasswordForm.tsx`
  - Labels/buttons/links: `Email`, `Send reset link`, `Back to sign in`
- `lib/auth/actions.ts`
  - Server messages: `No active organization membership was found for this account.`, `Enter a valid email address.`, `If an active account exists, a password reset link will be sent.`
- `lib/auth/core.ts`
  - Auth failure and conflict messages should be localized if surfaced through forms.
- `lib/validations/auth.ts`
  - Validation messages: `Password must be at least 8 characters.`, `Enter your full name.`, `Enter your organization name.`

### Prototype auth flow

- `src/app/App.tsx:654`
  - Login screen: `Email address`, `you@company.com`, `Password`, `Enter your password`, `Remember me`, `Forgot password?`, `Signing in...`, `Sign In`, `Or continue with`, SSO provider labels.
- `src/app/App.tsx:706`
  - Registration/onboarding copy: `Create your account`, `Start reconciling smarter in minutes`, `First name`, `Last name`, `Work email`, `Min. 12 characters`, `Use a mix of letters, numbers and symbols`, `Company name`, `Country`, `Back`, `Continue`, setup/verification text.
- `src/app/App.tsx:3447`
  - Other auth states: email verification, MFA, session expired, accept invitation, and reset-password screens contain titles, instructions, button text, sample email addresses, and validation-like helper copy.

## 2. Navigation

- `src/app/App.tsx:391`
  - Primary nav: `Dashboard`, `Transactions`, `Reconciliation`, `Imports`, `Matching Rules`, `Bank Accounts`, `Integrations`, `AI Assistant`, `Reports`, `Audit Logs`
- `src/app/App.tsx:405`
  - Secondary nav: `Notifications`, `Users`, `Roles`, `Settings`, `Billing`, `Help Center`
- `src/app/App.tsx:530`
  - Global search placeholder: `Search transactions, rules, reports...`
- `src/app/App.tsx:539`
  - Top-nav action: `Import`
- `src/app/App.tsx:604`
  - Profile menu: `Profile Settings`, `Security`, `Billing`
- `src/app/App.tsx:3431`
  - Breadcrumb includes `E-Reconcile MN` and a title-cased view id derived from English route names.
- `app/dashboard/page.tsx`
  - Header/action: `E-Reconcile MN`, `Sign out`

## 3. Dashboard

- `app/dashboard/page.tsx`
  - Page text: `Dashboard`, `Signed in as ... with ... access.`
  - KPI labels/values: `Organization`, `Active role`, `Permissions`, `Phase`, `Tenant foundation`
  - Cards: `Import transactions`, `CSV/XLSX import will attach to this organization context in Phase 2.`, `Review reconciliation`, `Manual matching and approval routes will use the same server-side session guard.`, `Manage access`, `Fixed Admin, Finance Manager, Accountant, Auditor, and Viewer roles are seeded per tenant.`
  - Section title: `Granted Permissions`
- `lib/permissions/roles.ts`
  - Role labels: `Admin`, `Finance Manager`, `Accountant`, `Auditor`, `Viewer`
  - Role descriptions: `Full tenant administration and financial workflow access.`, `Reviews, approves, reports, and manages reconciliation work.`, `Imports transactions, reviews records, and prepares reconciliations.`, `Reviews transactions, reports, and audit history without editing financial data.`, `Read-only access to approved finance workspace views.`
- `src/app/App.tsx:1181`
  - Prototype dashboard headings, KPI labels, chart titles, activity feed labels, quick actions, and empty/status labels.

## 4. Transactions

- `src/app/App.tsx:85`
  - Mock transaction descriptions/vendors/accounts/sources are English and US-centric: `AWS Cloud Services - Monthly Invoice`, `Stripe Payment Gateway Settlement`, `Salesforce CRM Annual Subscription`, `Tech Infrastructure`, `Payment Receipts`, `Manual Entry`, `Bank Import`, etc.
- `src/app/App.tsx:1428`
  - Transactions screen includes hardcoded headings, filters, buttons, placeholders, column headers, table cell labels, status text, and bulk/action menu text.
- `src/app/App.tsx:207`
  - Status labels shared with transaction rows: `Matched`, `Unmatched`, `Pending Review`, `Exception`, plus severity/status labels.
- Locale formatting:
  - `src/app/App.tsx` uses `Intl.NumberFormat("en-US", { currency: "USD" })` and `Intl.NumberFormat("en-US")`; these should become locale/currency-aware for Mongolian localization.

## 5. Imports

- `src/app/App.tsx:134`
  - Import history sample data: source names, file names, statuses, times, sizes, and labels such as `Today`, `Yesterday`, `Partial`, `Error`.
- `src/app/App.tsx:1641`
  - Imports screen includes upload area copy, import-source names, buttons, table headings, validation/helper copy, progress/status labels, and empty/error states.
- Common strings to extract:
  - `Upload`, `Download`, `Import`, `Preview`, `Records`, `Matched`, `Errors`, `Source`, `Status`, `File`, `Size`, `Retry`, `Delete`, `Browse files`, drag-and-drop guidance, and CSV/XLSX/XML/OFX helper text.

## 6. Reconciliation

- `src/app/App.tsx:101`
  - Audit/activity sample actions include reconciliation text: `Reconciliation Approved`, `Exception Resolved`, `Scheduled Import Completed`.
- `src/app/App.tsx:121`
  - AI assistant messages include reconciliation recommendations and anomaly explanations.
- `src/app/App.tsx:142`
  - Bank/ledger transaction descriptions and account names are English demo data.
- `src/app/App.tsx:1929`
  - Reconciliation workspace includes headings, source panel labels, match controls, confidence/status labels, exception language, approval actions, table headers, and buttons.
- `src/app/App.tsx:2174`
  - Matching rules screen includes rule names, conditions, tolerance/date labels, priorities, accuracy labels, create/edit actions, and statuses.

## 7. Reports

- `src/app/App.tsx:2576`
  - Reports screen includes headings, descriptions, report names, chart labels, filters/date ranges, export/download actions, table labels, and status text.
- `src/app/App.tsx:107`
  - Audit log sample: `Report Exported`, `Q4-2024-Reconciliation.pdf`
- `src/app/App.tsx:3294`
  - Help articles related to reports: `Understanding exception reports`
- Common strings to extract:
  - `Reports`, `Export`, `Download`, `Monthly`, `Quarterly`, `Reconciliation Report`, `Exception Report`, `Accuracy`, `Matched`, `Unmatched`, `Exceptions`, `Generated`, and release/report notes.

## 8. Settings

- `src/app/App.tsx:2768`
  - Users screen: headings, table headers, role names, invite/manage actions, statuses, sample user names, and email copy.
- `src/app/App.tsx:2856`
  - Roles screen: `Roles & Permissions`, `Define access control for your team`, `Create Custom Role`, `Permission`, role matrix labels.
- `src/app/App.tsx:2915`
  - Settings tabs: `Organization`, `Security`, `API Keys`, `Webhooks`, `Sessions`
  - Organization profile: `Organization Profile`, `Upload Logo`, form labels, `Save Changes`
  - Security: `Password Policy`, `Minimum password length`, `12 characters`, `Require uppercase letters`, `Require numbers & symbols`, `Password expiry`, `90 days`, `Password history`, `Last 5 passwords`, `Multi-Factor Authentication`
  - API/webhooks/sessions: `Generate Key`, `Production API Key`, `Test API Key`, `Webhook Signing Secret`, `Created`, `Last used`, `Add Endpoint`, `Active Sessions`, `Sign Out All Other Sessions`
- `src/app/App.tsx:3122`
  - Billing settings: `Billing`, `Manage your subscription and payment details`, `Upgrade Plan`, `Transactions`, `Team Members`, `Payment Method`, `Add`, `Next Invoice`, `Due January 1, 2025`, `Invoice History`, `Download All`

## 9. System messages

- `lib/errors.ts`
  - Generic fallback: `Something went wrong. Please try again.`
- `src/app/App.tsx:3233`
  - Notifications: `Reconciliation completed`, `4 exceptions require review`, `SAP ERP sync failed`, `New team member invited`, `Matching rule created`, `Monthly report ready`, `Stripe rate limit warning`, `Backup completed`, plus all notification body copy.
- `src/app/App.tsx:3256`
  - Notification UI: `Notifications`, `unread notifications`, `Mark All Read`, filters `all`, `unread`, `success`, `warning`, `error`, `info`
- `src/app/App.tsx:3378`
  - Error screens: `Access Denied`, `You don't have permission to view this page. Contact your administrator to request access.`, `Page Not Found`, `The page you're looking for doesn't exist or has been moved.`, `Server Error`, `Something went wrong on our end. We're working to fix it. Please try again in a moment.`, `Scheduled Maintenance`, `E-Reconcile MN is undergoing scheduled maintenance. We'll be back online shortly.`, `No Internet Connection`, `Check your internet connection and try again. Your data is safe.`, `Back to Dashboard`, `Try Again`
- `src/app/App.tsx:3510`
  - Empty state: `Screen not found`, `This screen is not yet implemented`, `Back to Dashboard`
- `src/app/App.tsx:3516`
  - Demo controls: `Error Pages`, `Auth Pages`, `View ...`

## Cross-Cutting Localization Notes

- Source contains many English demo proper nouns, US banks, US tax/vendor examples, USD currency, and US date formats. Decide which are fixture data versus product text before translating.
- Status enums are displayed directly or mapped to English labels in multiple places; centralize these labels before translation.
- Route ids and permission keys are English technical identifiers. Do not translate internal ids, but avoid rendering them directly where possible.
- `src/app/App.tsx` has the highest localization surface and should be split into translatable resources before productizing.
- `dist/assets/*.js` includes generated copies of many strings. Exclude `dist/` from manual localization and rebuild after source changes.
