# StayBridge

A managed accommodation-rental marketplace built with React. Owners post ads, renters apply, and the StayBridge admin team sits in the middle: it verifies renters, negotiates with owners, collects a service fee from both sides, and only then unlocks direct contact.

## Business model

| Revenue line | How it works |
| --- | --- |
| Renter service fee | A percentage of one month's rent, charged only after the owner accepts the renter. |
| Owner success fee | A percentage of one month's rent, charged only when a tenant is placed. |
| Verified Tenant Pass | One-off purchase: pre-verified profile, priority review, and a discount on every service fee. |
| Featured listing | Paid 30-day boost that puts a listing first in search and on the home page. |

Fees are configurable in the admin console under **Fees & settings**.

## Workflow

1. Renter proposes a price, accepts the accommodation agreement, uploads ID, and fills a self-profile.
2. Admin reviews and verifies the renter.
3. Admin presents the renter to the owner. The owner accepts or declines.
4. Both sides pay the service fee.
5. Contact is unlocked: in-app messaging, phone, email, and the exact address.
6. Owner confirms the contract is signed. Both sides leave a review.

## Roles

| Role | Entry point | Demo account |
| --- | --- | --- |
| Renter | `/dashboard` | `jonas@staybridge.demo` |
| Owner | `/owner` | `marco@staybridge.demo` |
| Admin | `/admin` | `admin@staybridge.demo` |

Every demo user's password is `Demo!Pass2026`. The admin password comes from `ADMIN_PASSWORD` in `server/.env` (default `ChangeMe!Admin2026`). Use **Reset demo data** in the admin settings to start over.

## Stack

- Client: React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Zustand (API cache), lucide-react
- Server: Node 22, Express 5, Drizzle ORM on SQLite (Postgres-ready), zod validation, helmet, express-rate-limit, multer
- Tests: vitest + supertest against an in-memory database

See [SECURITY.md](SECURITY.md) for the security controls and the launch checklist.

## Run it

```bash
npm install                      # also installs server dependencies
cp server/.env.example server/.env
# edit server/.env: set SESSION_SECRET to a long random string
npm run dev                      # Vite on :5173 with /api proxied to the server on :3000
```

The server creates the admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on first start and seeds demo data when `SEED_DEMO=true`.

```bash
npm run build    # type-check and build client and server
npm test         # server API tests
npm run lint
```

Production: build, then run `npm start --prefix server` with `NODE_ENV=production`. The server serves the built client from `dist/` on the same origin, so no CORS is needed. Put it behind HTTPS.

## API

The contract is in [server/API.md](server/API.md). Privacy rules (who sees names, contacts, addresses, documents) are enforced server-side in `server/src/lib/serialize.ts`, and the application state machine in `server/src/lib/stateMachine.ts`.

## Project layout

```
src/                client
  types/            API shapes
  store/            zustand cache over the API
  lib/api.ts        fetch wrapper (cookies, CSRF header, uploads)
  components/       ui kit, layout shells, per-area components
  pages/            public, auth, renter, owner, admin
server/
  src/db/           Drizzle schema and connection
  src/routes/       auth, files, listings, applications, messages, reviews, me, admin
  src/lib/          sessions, crypto, serializers, state machine, fees, files
  src/middleware/   security headers, CORS, CSRF, rate limits, auth, validation
  src/__tests__/    API tests
  drizzle/          SQL migrations
```

## Next steps for production

- Payment provider (Stripe or similar) with hosted card fields and webhooks. Payments are mocked today.
- Email verification and password reset by email.
- KYC provider for identity checks, or encrypted storage for uploaded documents.
- Postgres and S3 for scale; the schema and file helper are the only places that change.
