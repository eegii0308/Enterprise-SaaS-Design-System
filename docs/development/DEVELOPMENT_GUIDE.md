# Development Guide

## Project Setup

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Run database migrations:

```bash
npm run prisma:migrate
```

Start the Next.js development server:

```bash
npm run dev
```

The Vite prototype remains available through:

```bash
npm run prototype:dev
```

## Environment Variables

Required variables:

- `DATABASE_URL`: PostgreSQL connection string used by Prisma.
- `AUTH_SESSION_SECRET`: random session signing secret with at least 32 characters.

Optional variables:

- `IMPORT_UPLOAD_ROOT`: local filesystem root for uploaded import files. Defaults to `.uploads` under the project working directory.

Production expectations:

- Store secrets in the deployment secret manager.
- Use different secrets per environment.
- Use a production PostgreSQL database with backups, monitoring, least-privilege credentials, and TLS where supported.

## Prisma Workflow

Current strategy:

- `prisma/schema.prisma` defines the database model.
- `prisma/migrations` stores committed migration history.
- Use migrations for shared development.
- Do not use `prisma db push` for shared environments.

Recommended workflow:

1. Update `prisma/schema.prisma`.
2. Create a named Prisma migration.
3. Review generated SQL.
4. Run migration against a clean local database.
5. Regenerate Prisma client.
6. Run tests.
7. Commit schema and migration together.

Known issue:

- Current migration history needs validation because tenant-isolation constraints appear to be dropped and only partially restored.

## Testing

Run tests:

```bash
npm test
```

Current status:

- Import and reconciliation tests largely pass.
- Auth and authorization tests currently fail because Node cannot resolve `@/lib` path aliases during test execution.

Recommended next fix:

- Configure test-time path aliases or avoid aliases in core modules used directly by Node tests.

## Local Development Notes

Production code is primarily in:

- `app/`
- `lib/`
- `features/`
- `prisma/`
- `tests/`

Prototype code is primarily in:

- `src/`
- `dist/`

Avoid treating the prototype as production architecture. It is a workflow and visual reference.

## Quality Checks

Before production-oriented changes are merged, run:

```bash
npm run typecheck
npm run build
npm test
```

Also verify migrations on a clean PostgreSQL database when database changes are involved.

## Documentation Expectations

When implementation changes:

- Update architecture documentation.
- Update data flow documentation.
- Update tenant isolation notes for database changes.
- Update audit policy when new events are added.
- Update development guide when setup, scripts, or workflows change.
