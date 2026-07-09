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
- Reconciliation match correction and run reopening: a confirmed match can be corrected by replacing one side (bank or ledger transaction) with a required reason — the original match becomes `removed` and a new `confirmed` match is created linked via `correctedFromMatchId`; an `approved` run can be reopened by a user with `reconciliation.approve` and a required reason, recording `reopenedBy`/`reopenedAt` while preserving approval history — both audit-logged (`RECONCILIATION_MATCH_CORRECTED`, `RECONCILIATION_RUN_REOPENED`) and covered by automated tests

Current:
- Phase 4 (Manual Reconciliation) — match rejection and exception marking remain

Next:
- Match rejection
- Exception marking for unresolved transactions

## Reconciliation Architecture Rules

- `lib/reconciliation/manual-match.ts` remains the domain service for manual match creation, removal, and correction (`correctManualMatch`).
- Run lifecycle transitions (submit for review, approve, reopen) are handled through `lib/reconciliation/run-lifecycle.ts`, not through manual-match.ts.
- Reconciliation state changes (matches and run status) must be transaction-scoped so match writes, run status writes, and audit log writes commit atomically.
- Runs in `ready_for_review` or `approved` status prevent normal match edits (creation, removal, and correction are blocked until the run is approved or reopened).
- Correcting a match creates a new match rather than mutating the original; the original is marked `removed` with a `correctionReason`, and the new match links back via `correctedFromMatchId`, preserving full match history.
- Reopening an `approved` run requires `reconciliation.approve` and a reason; it does not clear `approvedBy`/`approvedAt`/`completedAt`, so approval history remains queryable after a run is reopened.

## Rules for AI

Before coding:
1. Read docs/
2. Understand architecture
3. Do not rewrite existing systems unnecessarily
4. Keep MVP focus
5. Update documentation after changes