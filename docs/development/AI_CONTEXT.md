# E-Reconcile MN Project Context

## Product
E-Reconcile MN is a SaaS reconciliation platform for Mongolian businesses.

## Goal
Replace Excel/manual reconciliation processes.

## Current Stage
MVP development.

## Tech Stack
Frontend:
- Next.js
- TypeScript
- Tailwind
- Shadcn UI

Backend:
- Next.js API routes
- PostgreSQL
- Prisma

Authentication:
- NextAuth

Deployment:
- Vercel

## Core Features

1. User management
2. Company workspace
3. Data import
4. Reconciliation engine
5. Matching rules
6. Reports
7. Audit logs

## Development Status

Completed:
- UI prototype
- Database schema (organizations, users, roles, imports, transactions, reconciliation, reports, audit logs)
- Authentication and organization-scoped authorization
- CSV/XLSX import pipeline
- Reconciliation workspace: unmatched bank/ledger review, manual match creation, and confirmed-match removal (unmatch), each with audit logging and automated tests
- Reconciliation run lifecycle: submit for review (draft/in_progress/reopened → ready_for_review) and approve (ready_for_review → approved), each enforced server-side (`reconciliation.run`, `reconciliation.approve`), audit-logged, and covered by automated tests
- Reconciliation concurrency hardening: atomic transaction-status claims to prevent duplicate matches, and CAS-guarded run status transitions

Current:
- Phase 4 (Manual Reconciliation) — match rejection and exception marking remain

Next:
- Match rejection
- Exception marking for unresolved transactions

## Reconciliation Architecture Rules

- `lib/reconciliation/manual-match.ts` remains the domain service for manual match creation and removal.
- Run lifecycle transitions (submit for review, approve) are handled through `lib/reconciliation/run-lifecycle.ts`, not through manual-match.ts.
- Reconciliation state changes (matches and run status) must be transaction-scoped so match writes, run status writes, and audit log writes commit atomically.
- Runs in `ready_for_review` or `approved` status prevent normal match edits (creation and removal are blocked until the run is approved or reopened).

## Rules for AI

Before coding:
1. Read docs/
2. Understand architecture
3. Do not rewrite existing systems unnecessarily
4. Keep MVP focus
5. Update documentation after changes