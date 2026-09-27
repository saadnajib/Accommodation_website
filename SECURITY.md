# Security overview

This document lists the security controls in StayBridge and what is still required before a public launch.

## Authentication and sessions

- Passwords are hashed with scrypt (N=2^15, r=8, p=1) and a per-user random salt. Plain-text passwords are never stored or logged.
- Password policy: at least 10 characters with letters and numbers. Admin accounts cannot be self-registered.
- Sessions are opaque random tokens stored server-side (only the SHA-256 of the token is in the database). Cookie flags: `HttpOnly`, `SameSite=Lax`, `Secure` in production, 14-day sliding expiry with a 30-day absolute cap. Changing the password revokes every other session.
- Login is rate limited (20 attempts per 15 minutes per IP) and accounts lock for 15 minutes after 8 failed attempts. Failed and successful logins are written to the audit log.

## Request hardening

- Cross-site request forgery: `SameSite=Lax` cookies, a mandatory `X-Requested-With: fetch` header on every state-changing request, and an Origin/Referer check against the allowed origins.
- CORS is off by default. In development only the Vite origin is allowed. In production the client is served by the API on the same origin.
- Security headers via helmet: a strict Content Security Policy (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), HSTS in production, `Referrer-Policy`, `X-Content-Type-Options`, and a same-origin resource policy.
- All input is validated with zod schemas. Unknown fields, oversized bodies (1 MB JSON), and malformed JSON are rejected. Ids are pattern-checked.
- Global rate limit of 300 requests per minute per IP, with tighter limits on auth and uploads.
- Errors never expose stack traces. Unhandled errors return a generic message and are logged server-side.

## Authorization and privacy

- Every route checks the caller's role and ownership of the resource. Records a user is not allowed to see return 404 rather than 403, so existence is not leaked.
- Privacy rules are enforced in one place, `server/src/lib/serialize.ts`, and applied to every response:
  - Renters never receive the owner's email, phone, or the exact address until both fees are paid.
  - Owners never receive an application before the admin presents it, never the renter's full name, email, or phone until unlock, and never the renter's fee, masked ID number, document ids, or admin notes.
  - Only admins see verification documents, masked ID numbers, and internal notes.
- The application state machine lives on the server. Each role has a fixed set of allowed transitions, and every transition writes an event row and an audit-log row.
- ID numbers are masked to the last four digits on receipt and the full number is discarded.

## File uploads

- Files are held in memory, type-checked by magic bytes (JPEG, PNG, WebP, PDF only), then written under a random name in a directory outside any static root. The client-supplied MIME type and filename are never trusted for storage or serving.
- Limits: 8 MB per file, 8 files per request, 30 upload requests per minute.
- Verification documents are private: only the uploader and admins can fetch them, with `Cache-Control: no-store`. Served files carry `X-Content-Type-Options: nosniff` and a sandboxing CSP so an uploaded document can never run script.

## Database

- SQLite through Drizzle ORM with parameterized queries only. Foreign keys are on and writes that span tables run in transactions.
- Payments, purchases, application events, and the audit log are append-only tables that record who did what and when.

## Configuration

- Secrets come from environment variables. `.env` is git-ignored and the server refuses to start in production with the default session secret.
- Demo seeding and the reset endpoint are disabled in production.

## Before a public launch

These are not implemented and should be treated as blockers:

1. Real payment provider (Stripe or similar) with webhooks. Card details must never reach this server; use the provider's hosted fields.
2. Email verification on signup and password reset by email.
3. Identity verification through a KYC provider instead of manual review of uploaded documents, or at minimum encrypted storage of the upload directory.
4. HTTPS termination with a reverse proxy, `trust proxy` configured to that proxy, and backups of the database and uploads.
5. Move to Postgres for concurrent writes and an object store (S3) for files. The Drizzle schema and the file helper are the only places that change.
6. Dependency scanning in CI (`npm audit`) and a log shipping setup that redacts personal data.
