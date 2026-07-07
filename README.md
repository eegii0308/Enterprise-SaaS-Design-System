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

Run npm i to install dependencies.

Run npm run dev to start the development server.

## Database Setup

Copy .env.example to .env and set the required environment variables:

- DATABASE_URL: PostgreSQL connection string for Prisma.
- AUTH_SESSION_SECRET: random session signing secret with at least 32 characters.

Run the Prisma setup commands before starting production development:

    npm install
    npm run prisma:generate
    npm run prisma:migrate

For a clean database, npm run prisma:migrate applies all committed migrations from prisma/migrations and then regenerates the Prisma client. Do not use prisma db push for shared development; create and commit migration files whenever prisma/schema.prisma changes.

## Documentation

Environment setup and production requirements live in docs/environment.md.

Planning docs live in docs/. Start with docs/blueprint.md, then read docs/feature-roadmap.md, docs/architecture.md, docs/database-design.md, docs/api-design.md, and docs/business-rules.md.
