# Localization final check

This report captures the remaining hardcoded English user-facing strings found in the project. No code changes were made.

## Summary

- The main auth flow in the Next.js app is already localized through the i18n layer.
- The remaining hardcoded English text is concentrated in the legacy demo UI in [src/app/App.tsx](../src/app/App.tsx) and a few shared components.

## Remaining English strings

| String | Location | Should be translated? |
| --- | --- | --- |
| "Welcome back" | [src/app/App.tsx](../src/app/App.tsx#L666) | Yes |
| "Sign in to your E-Reconcile account" | [src/app/App.tsx](../src/app/App.tsx#L666) | Yes |
| "Email address" | [src/app/App.tsx](../src/app/App.tsx#L668) | Yes |
| "you@company.com" | [src/app/App.tsx](../src/app/App.tsx#L668) | Yes |
| "Password" | [src/app/App.tsx](../src/app/App.tsx#L671) | Yes |
| "Enter your password" | [src/app/App.tsx](../src/app/App.tsx#L671) | Yes |
| "Create your account" | [src/app/App.tsx](../src/app/App.tsx#L711) | Yes |
| "Start reconciling smarter in minutes" | [src/app/App.tsx](../src/app/App.tsx#L711) | Yes |
| "First name" | [src/app/App.tsx](../src/app/App.tsx#L720) | Yes |
| "Last name" | [src/app/App.tsx](../src/app/App.tsx#L721) | Yes |
| "Sarah" | [src/app/App.tsx](../src/app/App.tsx#L720) | Yes |
| "Chen" | [src/app/App.tsx](../src/app/App.tsx#L721) | Yes |
| "Work email" | [src/app/App.tsx](../src/app/App.tsx#L723) | Yes |
| "sarah@company.com" | [src/app/App.tsx](../src/app/App.tsx#L723) | Yes |
| "Min. 12 characters" | [src/app/App.tsx](../src/app/App.tsx#L724) | Yes |
| "Company name" | [src/app/App.tsx](../src/app/App.tsx#L731) | Yes |
| "Acme Corporation" | [src/app/App.tsx](../src/app/App.tsx#L731) | Yes |
| "Country" | [src/app/App.tsx](../src/app/App.tsx#L746) | Yes |
| "United States" | [src/app/App.tsx](../src/app/App.tsx#L746) | Yes |
| "Two-factor authentication" | [src/app/App.tsx](../src/app/App.tsx#L852) | Yes |
| "Enter the 6-digit code from your authenticator app" | [src/app/App.tsx](../src/app/App.tsx#L852) | Yes |
| "Session expired" | [src/app/App.tsx](../src/app/App.tsx#L876) | Yes |
| "Your session has timed out for security" | [src/app/App.tsx](../src/app/App.tsx#L876) | Yes |
| "You're invited!" | [src/app/App.tsx](../src/app/App.tsx#L890) | Yes |
| "Join the Acme Corp workspace on E-Reconcile MN" | [src/app/App.tsx](../src/app/App.tsx#L890) | Yes |
| "Your name" | [src/app/App.tsx](../src/app/App.tsx#L899) | Yes |
| "Enter your full name" | [src/app/App.tsx](../src/app/App.tsx#L899) | Yes |
| "Confirm password" | [src/app/App.tsx](../src/app/App.tsx#L900) | Yes |
| "Create a secure password" | [src/app/App.tsx](../src/app/App.tsx#L900) | Yes |
| "Confirm your password" | [src/app/App.tsx](../src/app/App.tsx#L901) | Yes |
| "Legal name" | [src/app/App.tsx](../src/app/App.tsx#L946) | Yes |
| "Acme Corporation, Inc." | [src/app/App.tsx](../src/app/App.tsx#L946) | Yes |
| "Tax ID / EIN" | [src/app/App.tsx](../src/app/App.tsx#L961) | Yes |
| "XX-XXXXXXX" | [src/app/App.tsx](../src/app/App.tsx#L961) | Yes |
| "Add a comment..." | [src/app/App.tsx](../src/app/App.tsx#L1518) | Yes |
| "Total Transactions" | [src/app/App.tsx](../src/app/App.tsx#L1209) | Yes |
| "Dec 2024 · All sources" | [src/app/App.tsx](../src/app/App.tsx#L1209) | Yes |
| "Matched" | [src/app/App.tsx](../src/app/App.tsx#L1211) | Yes |
| "88.9% match rate" | [src/app/App.tsx](../src/app/App.tsx#L1211) | Yes |
| "Unmatched" | [src/app/App.tsx](../src/app/App.tsx#L1213) | Yes |
| "Requires attention" | [src/app/App.tsx](../src/app/App.tsx#L1213) | Yes |
| "Exceptions" | [src/app/App.tsx](../src/app/App.tsx#L1215) | Yes |
| "2.3% exception rate" | [src/app/App.tsx](../src/app/App.tsx#L1215) | Yes |
| "Imported Today" | [src/app/App.tsx](../src/app/App.tsx#L1217) | Yes |
| "3 sources synced" | [src/app/App.tsx](../src/app/App.tsx#L1217) | Yes |
| "Pending Review" | [src/app/App.tsx](../src/app/App.tsx#L1219) | Yes |
| "Assigned to you: 42" | [src/app/App.tsx](../src/app/App.tsx#L1219) | Yes |
| "Rule Name" | [src/app/App.tsx](../src/app/App.tsx#L2211) | Yes |
| "e.g. Stripe Settlement Matching" | [src/app/App.tsx](../src/app/App.tsx#L2211) | Yes |
| "Amount Tolerance" | [src/app/App.tsx](../src/app/App.tsx#L2241) | Yes |
| "$0.50" | [src/app/App.tsx](../src/app/App.tsx#L2241) | Yes |
| "Date Tolerance" | [src/app/App.tsx](../src/app/App.tsx#L2243) | Yes |
| "1 day" | [src/app/App.tsx](../src/app/App.tsx#L2243) | Yes |
| "Search integrations..." | [src/app/App.tsx](../src/app/App.tsx#L2410) | Yes |
| "Ask about transactions, exceptions, or request analysis..." | [src/app/App.tsx](../src/app/App.tsx#L2563) | Yes |
| "Search logs..." | [src/app/App.tsx](../src/app/App.tsx#L2722) | Yes |
| "Invite Team Members" | [src/app/App.tsx](../src/app/App.tsx#L2783) | Yes |
| "Email addresses" | [src/app/App.tsx](../src/app/App.tsx#L2785) | Yes |
| "Search documentation..." | [src/app/App.tsx](../src/app/App.tsx#L3314) | Yes |
| "Verify your email" | [src/app/App.tsx](../src/app/App.tsx#L3456) | Yes |
| "Enter the 6-digit code sent to your inbox" | [src/app/App.tsx](../src/app/App.tsx#L3456) | Yes |
| "Error loading image" | [src/app/components/figma/ImageWithFallback.tsx](../src/app/components/figma/ImageWithFallback.tsx) | Yes |
| "breadcrumb" | [src/app/components/ui/breadcrumb.tsx](../src/app/components/ui/breadcrumb.tsx) | Yes, for accessibility |
| "pagination" | [src/app/components/ui/pagination.tsx](../src/app/components/ui/pagination.tsx) | Yes, for accessibility |
| "Go to previous page" | [src/app/components/ui/pagination.tsx](../src/app/components/ui/pagination.tsx) | Yes, for accessibility |
| "Go to next page" | [src/app/components/ui/pagination.tsx](../src/app/components/ui/pagination.tsx) | Yes, for accessibility |
| "Toggle Sidebar" | [src/app/components/ui/sidebar.tsx](../src/app/components/ui/sidebar.tsx) | Yes, for accessibility |

## Notes

- Strings that are purely technical or non-user-facing, such as class names, route names, and data attributes, were not included.
- The current localization setup already supports English and Mongolian through [locales/en.json](../locales/en.json) and [locales/mn.json](../locales/mn.json).
