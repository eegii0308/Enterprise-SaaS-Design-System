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

## Rate Limiting: IP Trust Boundary

Login, first-admin registration, forgot-password, and CSV upload rate limiting (`lib/rate-limit/`, wired in `lib/auth/actions.ts` and `app/dashboard/imports/actions.ts`) include IP-scoped limits (`auth:login:ip`, `auth:register:ip`, `auth:forgot-password:ip`). These read the client IP from the `x-forwarded-for` header, falling back to `x-real-ip` (`lib/rate-limit/ip.ts`). The account-scoped and organization-scoped limits (keyed by email, user ID, or organization ID) do not depend on these headers and are unaffected by anything below.

**`x-forwarded-for` must only be trusted behind a proxy that strips incoming client headers.** It is a plain HTTP header: any client can set it to an arbitrary value on every request. If nothing in front of this app removes a client-supplied `x-forwarded-for`/`x-real-ip` before setting its own, IP-based rate limiting is trivially bypassed -- an attacker sends a different fake IP with each request and lands in a fresh, empty limiter bucket every time. IP-based limiting is only meaningful when the deployment guarantees this header reflects the real connecting client.

### Vercel

Vercel's edge network sets `x-forwarded-for` (and `x-real-ip`) to the actual connecting IP and overwrites any client-supplied value, so no extra configuration is required. This is the only deployment path this app has been verified against so far.

### Self-hosted deployment requirements

Before relying on IP-based rate limiting in any non-Vercel deployment (a VM, container host, or Node process behind your own infrastructure):

- A reverse proxy (nginx, Caddy, an ALB/NLB, Cloudflare, etc.) must terminate all public traffic in front of the Next.js process.
- That proxy must strip or overwrite any client-supplied `X-Forwarded-For`/`X-Real-IP` value and set it to the real connecting socket address before forwarding the request.
- Verify this behavior for the specific proxy/platform in use -- the application has no way to detect or enforce it from inside the Node process, and a misconfigured proxy that passes the client's header through unchanged silently disables all IP-based rate limiting.

### Never expose Next.js directly to the internet

Never point a public DNS record directly at the Next.js process (`next start` or a bare Node server) without a trusted proxy in front of it. Without one, every IP-based limit in this app (`auth:login:ip`, `auth:register:ip`, `auth:forgot-password:ip`) can be bypassed by varying the `X-Forwarded-For` header per request.
