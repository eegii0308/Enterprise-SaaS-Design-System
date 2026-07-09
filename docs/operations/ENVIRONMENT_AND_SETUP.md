# Environment And Setup

This project requires environment variables for database access and session signing. Keep real values in local `.env` files or your deployment platform secret store. Do not commit real secrets.

## Required Environment Variables

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma | PostgreSQL connection string. Local development can use a local database; production must use a managed or otherwise production-ready PostgreSQL database. |
| `AUTH_SESSION_SECRET` | Yes | Auth session cookies | Random secret used to sign session cookies. Must be at least 32 characters and unique per environment. |

## Development Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Edit `.env` and set:

   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/e_reconcile_mn?schema=public"
   AUTH_SESSION_SECRET="replace-with-a-local-random-secret-at-least-32-characters"
   ```

4. Generate Prisma client and apply committed migrations:

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

For shared development, create and commit migrations when `prisma/schema.prisma` changes. Do not use `prisma db push` for shared database changes.

## Production Requirements

- Set `NODE_ENV=production` through the hosting runtime.
- Provide `DATABASE_URL` through the deployment secret manager, not a committed file.
- Use a production PostgreSQL database with backups, monitoring, least-privilege credentials, and TLS where supported by the provider.
- Set `AUTH_SESSION_SECRET` to a strong random value that is different from development and staging.
- Rotate `AUTH_SESSION_SECRET` carefully because changing it invalidates existing signed sessions.
- Run `npm run build` during deployment and apply Prisma migrations before serving traffic.
- Restrict access to production environment variables to the minimum set of people and systems.
