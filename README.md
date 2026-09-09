# Heavy Duty Rentals — KSA Equipment Rental Platform

A transactional heavy-equipment rental platform for Saudi Arabia: search a real fleet, check genuine availability, see a fully itemised price, and book and pay online — in Arabic or English.

> **Demo data.** Every machine, rate and company detail in this repository is fictional and flagged `is_demo_data`, which makes the UI label it. No real inventory, prices or credentials are included. See [`docs/FINAL_REVIEW.md`](docs/FINAL_REVIEW.md) for exactly what is and is not implemented.

---

## Why this exists

Every competitor surveyed (see [`docs/research.md`](docs/research.md)) publishes a brochure: no prices, no availability, no transaction. The buyer's real question — *can you put a machine that can do this lift, at this site, on this date, for this budget* — is answered by a phone call.

This moves that transaction online, and the architecture is shaped by three constraints that follow from doing so honestly:

1. **A physical machine can never be double-booked.** Enforced by a PostgreSQL `EXCLUDE USING gist` constraint, not by application logic — the only mechanism that survives concurrency.
2. **A price can never originate in the browser.** The server recomputes every total from database rates and rejects a mismatch.
3. **Where a price cannot honestly be given, we do not give one.** Classes whose mobilisation needs a route survey route to a structured quote instead of a guess.

---

## Quick start

Requires **Node.js ≥ 22** and **Docker** (for PostgreSQL 17).

```bash
npm install
```

```bash
cp .env.example .env
```

Generate the two development secrets and paste them into `.env`:

```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64')); console.log('APP_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
```

Then bring up the database, apply migrations and seed demo data:

```bash
npm run db:up && npm run db:migrate && npm run db:seed
```

```bash
npm run dev
```

Open <http://localhost:3000> — you will be redirected to `/en` or `/ar` based on your browser's language.

### Demo sign-in

| Role | Email | Password |
|---|---|---|
| Platform admin | `admin@example.com` | `ChangeMe_Dev_Only_123` |
| Customer | `customer@example.com` | `ChangeMe_Dev_Only_123` |

The password comes from `SEED_ADMIN_PASSWORD` in `.env`. The seed refuses to run when `NODE_ENV=production`.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npm run verify` | typecheck → lint → test |
| `npm run db:up` | Start PostgreSQL and wait for it |
| `npm run db:down` | Stop PostgreSQL |
| `npm run db:migrate` | Apply migrations (forward-only) |
| `npm run db:seed` | Load demo data |
| `npm run db:reset` | Destroy the volume, recreate, migrate, seed |
| `npm run db:generate` | Regenerate a Drizzle migration from the schema |

Additionally, `node scripts/verify-flow.mjs` runs 33 live checks against a running dev server — SSR content, security headers, CSRF, mass assignment, webhook forgery, pricing correctness and SEO endpoints.

> Integration tests **skip** when PostgreSQL is unreachable so `npm test` still works without Docker. **CI must set `REQUIRE_DB=1`**, which turns an unreachable database into a hard failure — otherwise the tests protecting double-booking and tenant isolation would silently not run.

---

## Architecture at a glance

**Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · PostgreSQL 17 · Drizzle ORM**

A modular monolith, deliberately. The core requirement is transactional consistency — reserve, price, charge and invoice as one consistent story — and splitting that across services replaces a database transaction with a distributed saga to solve a scale problem this business does not have.

```
src/
  app/[locale]/          Public site, customer portal, admin console (AR/EN)
  app/api/               Pricing quote, payment webhook, media
  components/            Design system + feature components (server-first)
  lib/
    availability/        Overlap queries, holds, blackouts
    pricing/             engine.ts (pure, no I/O) + repository.ts (I/O, no arithmetic)
    booking/             Transactional booking service + scoped reads
    payments/            Provider interface, mock + Moyasar adapters, webhook service
    auth/                argon2id, opaque sessions, password policy
    server/              guard.ts (the trust boundary), audit, rate limiting
    db/schema/           Drizzle schema, split by domain
db/migrations/           0000 generated · 0001 hand-written integrity constraints
```

**Changing the code?** Start with [`docs/CODE_GUIDE.md`](docs/CODE_GUIDE.md) — how a request flows, where the invariants live, and the driver and framework quirks that have already caused real bugs here.

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DATABASE.md`](docs/DATABASE.md) · [`docs/SECURITY.md`](docs/SECURITY.md) · [`docs/PRD.md`](docs/PRD.md)

### The three load-bearing decisions

**No double booking** — `db/migrations/0001_integrity.sql`:

```sql
ALTER TABLE reservation ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (unit_id WITH =, period WITH &&)
  WHERE (status IN ('held','confirmed','active'));
```

Two customers pressing "Book" in the same millisecond cannot both succeed. The loser gets SQLSTATE `23P01`, which the booking service catches and reports as "no longer available". A test drives ten concurrent inserts and asserts exactly one wins.

**Money is integer halalas** — `bigint`, never a float, end to end. `0.1 + 0.2` on a VAT line produces an invoice that does not foot, which in Saudi Arabia is a tax defect rather than a rounding nuisance.

**The pricing engine is pure** — `src/lib/pricing/engine.ts` has no I/O, no clock and no randomness, so it is exhaustively unit-tested (41 assertions). The server calls it with database-sourced rates and compares the result to whatever the client claimed.

---

## Bilingual

Arabic is a peer locale, not a translation layer: its own URL segment, metadata, canonical and `hreflang` pair, with full RTL mirroring via Tailwind logical properties (`ms-*`, `pe-*`, `start-*`).

The English dictionary is the **type source**; `ar.ts` must satisfy the same type, so a missing Arabic translation is a **compile error** rather than an English string appearing silently in an Arabic page.

> The Arabic copy was written by a bilingual engineer against the English source and is coherent and usable, but it has **not** been reviewed by a professional Saudi translator. Every key maps 1:1, so replacement is a file swap. See the header of `src/lib/i18n/dictionaries/ar.ts`.

---

## Payments

Provider-agnostic by design, because the PSP choice depends on a commercial contract the business has not signed.

| Provider | Status |
|---|---|
| `mock` | Deterministic, offline, **moves no money**. Development and tests only. |
| `moyasar` | Reference real adapter (mada, Visa, Mastercard, Apple Pay, STC Pay). Real code; inert without credentials. |

Set `PAYMENT_PROVIDER` in `.env`. **The server refuses to start in production with `mock`.**

Payment status is established **only** by a cryptographically verified webhook — signature checked over the raw body before parsing, replay-blocked by a unique index, and amount/currency compared against the stored booking. A browser POSTing "I paid" changes nothing.

The mock checkout at `/api/payments/mock/checkout` emits a **properly HMAC-signed** webhook to the real endpoint, so the verification path under test is the production one.

---

## What is deliberately not implemented

Named here rather than buried, because pretending would be worse:

- **ZATCA Phase 2 e-invoicing clearance.** Requires CSID onboarding, a cryptographic stamp identity and ZATCA certification. The invoice model is complete and correct; invoices render a visible "not ZATCA-cleared" notice.
- **Live payment processing.** Requires a SAMA-licensed merchant account.
- **Legally binding e-signature.** Acceptance is recorded with version, timestamp and IP; the signature-provider boundary is reserved.
- **Real email/SMS delivery.** Interfaces defined, console transports built.
- **Malware scanning on uploads.** Interface defined, unimplemented.
- **Breached-password checking.** Requires an outbound k-anonymity API the business must accept.

Full list with recommended next steps: [`docs/FINAL_REVIEW.md`](docs/FINAL_REVIEW.md).

---

## Security

Full threat model and control mapping in [`docs/SECURITY.md`](docs/SECURITY.md). The invariants that have executable tests:

- A customer cannot reach another customer's booking, invoice or document
- A member of company A cannot reach company B's data through any route
- No company role — including `owner` — can grant platform-admin permissions
- A tampered price is rejected and audited, never adopted
- Ten concurrent reservations on one unit yield exactly one booking
- An unsigned or replayed webhook changes nothing and is logged for forensics
- The schema has no column capable of holding a PAN, CVV or expiry

**This is not a compliance claim.** Compliance is an audited state, not a property of code. An independent penetration test is required before production.

---

## License and status

Prototype built to a specification. Not production-deployed. Regulatory items (ZATCA, PDPL, NCA ECC, consumer law) require review by qualified Saudi professionals before launch — see [`docs/research.md`](docs/research.md) §12 for the open questions.
