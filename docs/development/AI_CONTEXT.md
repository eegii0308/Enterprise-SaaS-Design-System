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

Current:
- Phase 4 (Manual Reconciliation) — completing the remaining reconciliation lifecycle work

Next:
- Match rejection
- Exception marking for unresolved transactions
- Reconciliation run lifecycle: ready-for-review and approved states, with approved-run edit locking
- Approval permission enforcement (`reconciliation.approve`) for Finance Manager and Admin

## Rules for AI

Before coding:
1. Read docs/
2. Understand architecture
3. Do not rewrite existing systems unnecessarily
4. Keep MVP focus
5. Update documentation after changes