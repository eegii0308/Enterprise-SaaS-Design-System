# E-Reconcile MN Prototype

This repository currently contains a Figma-generated Vite React prototype for E-Reconcile MN.

Production planning should stay MVP-focused: simple architecture, fast development, maintainability, and SaaS readiness. The prototype is a visual and workflow reference, not the final production architecture.

Core MVP path:

- Import bank and ledger CSV/XLSX files.
- Validate mappings and row-level import errors.
- Manually reconcile bank and ledger transactions.
- Review exceptions.
- Approve the reconciliation run.
- Export summary, exception, and unmatched reports.
- Audit critical financial actions.

## Running The Prototype

Run `npm i` to install dependencies.

Run `npm run dev` to start the development server.

## Documentation

Planning docs live in `docs/`. Start with `docs/blueprint.md`, then read `docs/feature-roadmap.md`, `docs/architecture.md`, `docs/database-design.md`, `docs/api-design.md`, and `docs/business-rules.md`.