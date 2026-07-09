# AI Development Workflow

## Purpose

This document describes the intended AI-assisted development workflow for E-Reconcile. It separates architecture planning, audit/review, implementation, and documentation so the project can move quickly without losing production discipline.

## Tool Roles

### ChatGPT

Recommended use:

- Architecture decisions.
- Product and technical planning.
- Risk review.
- Design tradeoff analysis.
- Roadmap shaping.
- Documentation review.

ChatGPT is best used before implementation to clarify direction and after implementation to evaluate whether the work still matches the product and SaaS architecture goals.

### Codex

Recommended use:

- Repository audits.
- Documentation creation and updates.
- Static analysis.
- Test runs and verification.
- Targeted code reviews.
- Implementation support when explicitly requested.

For documentation-only tasks, Codex should avoid application code changes and clearly separate current implementation from future plans.

### Claude Code

Recommended use:

- Application implementation.
- Refactoring under an approved plan.
- Feature development.
- Test writing.
- Migration implementation after architecture review.

Claude Code should implement against current architecture decisions and update tests and docs as part of the development cycle.

## Recommended Cycle

```text
Audit
  ↓
Review
  ↓
Implement
  ↓
Test
  ↓
Document
  ↓
Repeat
```

## Audit

Audit the current repository before major phases.

Audit scope should include:

- Architecture.
- Tenant isolation.
- Authentication and authorization.
- Financial data integrity.
- Database constraints and migrations.
- Audit logging.
- Testing.
- Production readiness.

## Review

Review audit findings and decide what must be fixed before new feature work.

Review outputs should include:

- Critical blockers.
- High-priority risks.
- Deferred items.
- Explicit implementation scope.

## Implement

Implementation should be handled in small, reviewable phases.

Implementation rules:

- Do not invent features outside the approved scope.
- Preserve tenant boundaries.
- Add tests for security and financial logic.
- Add or update audit logs for financial mutations.
- Update docs when behavior changes.

## Test

Testing should include:

- Unit tests for pure domain logic.
- Authorization tests for permission boundaries.
- Tenant isolation tests.
- Import processing tests.
- Reconciliation tests.
- Build and typecheck.
- Migration verification on a clean database.

## Document

Documentation should be updated after each implementation phase.

Documents likely to need updates:

- `docs/architecture/ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/DATA_FLOW.md`
- `docs/security/TENANT_ISOLATION.md`
- `docs/security/AUTHENTICATION_AND_AUTHORIZATION.md`
- `docs/database/DATABASE_DESIGN.md`
- `docs/financial/FINANCIAL_DATA_INTEGRITY.md`
- `docs/financial/AUDIT_LOG_POLICY.md`
- `docs/development/DEVELOPMENT_GUIDE.md`

## Current Recommended Next Cycle

1. Audit result: production readiness has major tenant isolation and auth/test blockers.
2. Review decision: prioritize database migration repair and test reliability.
3. Implementation phase: fix tenant constraints, migration repeatability, and test alias configuration.
4. Documentation update: revise database, tenant isolation, and development guide after fixes.
