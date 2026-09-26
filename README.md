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

Sign in is by email only. All data lives in the browser (`localStorage`) so the demo works without a backend. Use **Reset demo data** in the admin settings to start over.

## Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4
- React Router v7
- Zustand (persisted store)
- lucide-react icons

## Run it

```bash
npm install
npm run dev
```

```bash
npm run build   # type-check and production build
npm run lint
```

## Project layout

```
src/
  types/        domain model
  data/seed.ts  demo users, listings, applications
  store/        zustand store: state, actions, selectors
  lib/          fees, status labels, utilities
  components/   ui kit, layout shells, per-area components
  pages/        public, auth, renter, owner, admin
```

## Next steps for production

- Replace the store with a real API and database. The store's action signatures map directly to endpoints.
- Real file upload and ID verification (for example a KYC provider).
- Payment provider for fees and Tenant Pass purchases.
- Email and push notifications.
