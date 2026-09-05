# Architecture

**Version:** 1.0 · **Date:** 2026-09-02

---

## 1. Shape: modular monolith

One deployable Next.js application with hard internal module boundaries, backed by one PostgreSQL database.

**Why not microservices.** The dominant correctness requirement is *transactional*: reserve a unit, price it, take payment, and issue an invoice as one consistent story. Splitting that across services replaces a database transaction with a distributed saga — enormously more code, more failure modes, and more ways to double-book a crane — to solve a scale problem this business does not have. A rental fleet is hundreds of units and thousands of bookings a year, not millions of events a second.

The modules below have explicit interfaces and no cross-imports of internals. If a module ever genuinely needs to scale independently, it is already isolated enough to extract.

```
                    ┌─────────────────────────────────────────┐
   Browser  ───────▶│  Next.js 16 (App Router)                │
   (SSR HTML,       │                                          │
    minimal JS)     │  ┌────────────┐  ┌────────────────────┐ │
                    │  │ Public web │  │ Customer portal    │ │
                    │  │ (RSC, SEO) │  │ Admin console      │ │
                    │  └─────┬──────┘  └─────────┬──────────┘ │
                    │        │  Server Actions / Route Handlers│
                    │  ══════╪═══════════ trust boundary ═════ │
                    │  ┌─────▼───────────────────────────────┐ │
                    │  │ Domain modules                       │ │
                    │  │  auth · rbac · catalog · inventory   │ │
                    │  │  availability · pricing · booking    │ │
                    │  │  payments · invoicing · documents    │ │
                    │  │  notifications · audit · analytics   │ │
                    │  └─────┬───────────────────┬───────────┘ │
                    └────────┼───────────────────┼─────────────┘
                             │                   │
                    ┌────────▼────────┐   ┌──────▼─────────────┐
                    │  PostgreSQL 17  │   │ Provider adapters  │
                    │  (Drizzle)      │   │ payment · email    │
                    │  range types +  │   │ sms · storage      │
                    │  exclusion      │   │ tax · esign        │
                    │  constraints    │   └────────────────────┘
                    └─────────────────┘
```

---

## 2. Trust boundary — the single most important rule

**Everything above the trust boundary is attacker-controlled.** The browser, form fields, hidden inputs, JSON bodies, cookies, headers, and any price/ID/quantity in them are *inputs*, never authorities.

Every server entry point does, in this order:

1. **Parse and validate** with a Zod schema. Unknown keys are stripped (`.strict()`), which structurally prevents mass assignment.
2. **Authenticate** — resolve the session server-side from an opaque `HttpOnly` cookie.
3. **Authorize** — RBAC check *and* resource-ownership/tenant check. Never one without the other.
4. **Rate-limit** by identity and IP.
5. **Recompute** anything that matters — price, tax, availability, totals — from database state. Client-supplied values are compared for a mismatch, never adopted.
6. **Audit** the outcome.

`src/lib/server/guard.ts` implements this as a single composable helper so no route can silently skip a step.

---

## 3. Frontend

**Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4.**

### Server-first rendering
Public pages are React Server Components. Equipment specs, prices, availability summaries and content are in the initial HTML — required both for SEO (a primary business objective) and for 4G performance.

Client components are used only where interaction genuinely requires them: the date-range picker, the filter panel, the comparison tray, the booking configurator, and admin tables. Each is a leaf; none wraps a page.

### Routing and i18n
```
/[locale]/...                    locale ∈ { en, ar }
```
`ar` is not a suffix or an afterthought — it is a peer segment with its own metadata, canonical, and `hreflang` pair. `<html lang dir>` is set per locale; `dir="rtl"` for Arabic drives Tailwind's logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) so the entire layout mirrors without duplicated CSS.

Dictionaries live in `src/lib/i18n/dictionaries/{en,ar}.ts` as typed objects. The English dictionary is the type source; the Arabic dictionary must satisfy the same type, so **a missing translation is a compile error, not a silent English string in an Arabic page.** Arabic seed copy is marked for professional replacement.

### Design system
`src/components/ui/*` — tokens (color/spacing/type scale) in CSS custom properties, components composed from them. Industrial palette: high-contrast neutrals with a single safety-amber accent for primary actions. No decorative animation; motion is limited to state feedback and respects `prefers-reduced-motion`.

---

## 4. Domain modules

| Module | Responsibility | Key invariant |
|---|---|---|
| `auth` | Registration, login, sessions, password reset, TOTP | Sessions are opaque server-side records; tokens are stored hashed |
| `rbac` | Role and permission resolution | Authorization is a pure function of (actor, action, resource) |
| `catalog` | Categories, classes, specs, search, filters | Read-mostly; heavily cached |
| `inventory` | Serialized units, status, maintenance | A unit's bookability is derived, never manually set |
| `availability` | Overlap queries, holds, blackouts | Enforced by the database, not by application logic |
| `pricing` | Rate resolution, add-ons, transport, VAT, deposit | Pure, deterministic, integer-only, fully unit-tested |
| `booking` | Reservation lifecycle, transitions, idempotency | One transaction from availability check to persisted booking |
| `payments` | Intents, webhooks, refunds, deposits | Payment state changes only from verified provider events |
| `invoicing` | Numbering, VAT invoices, credit notes | Numbers come from a DB sequence; issued invoices are immutable |
| `documents` | Private storage, signed URLs, access control | No object is ever publicly readable |
| `notifications` | Channel-agnostic dispatch | Marketing sends are gated on stored consent |
| `audit` | Append-only security/operations log | Insert-only; no update or delete path exists |

---

## 5. Availability — the correctness core

### The problem
Two engineers hit "Book" on the last 100 t crane at the same millisecond. An application-level "check then insert" cannot prevent both from succeeding — between the check and the insert, the other transaction commits.

### The solution: let PostgreSQL enforce it
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservation ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (
    unit_id WITH =,
    period  WITH &&
  ) WHERE (status IN ('held','confirmed','active'));
```

`period` is a `tstzrange` covering the **occupied window**, not the billed window — it includes mobilisation and demobilisation buffer days, because a crane returning at 6pm is not available at 8am the next morning.

This is a storage-engine guarantee. Under any concurrency, on any number of app instances, with any interleaving, the second overlapping insert fails with `23P01 exclusion_violation`. The application catches that specific SQLSTATE and returns "no longer available" — it does not attempt to prevent the race itself.

The partial `WHERE` clause means cancelled and expired reservations release their window automatically, with no cleanup job.

### Holds during checkout
A checkout creates a `held` reservation with `expiresAt`. Held rows participate in the same exclusion constraint, so a hold genuinely blocks other customers. Expired holds are swept by a job, and are additionally treated as inactive by every read query — so a late sweep can never leak a stale hold into a booking decision.

### Maintenance blackouts
`unit_blackout` rows (maintenance, inspection, transport, out-of-service) carry the same range shape and are unioned into every availability query. Scheduling maintenance therefore makes a unit unbookable immediately, with no separate flag to forget to flip.

---

## 6. Pricing — the trust core

Implemented in `src/lib/pricing/` as **pure functions over plain data**. No I/O, no clock, no randomness — the caller supplies rates, rules, and the current time. This makes the engine exhaustively unit-testable, which matters because it is the component most directly attached to money.

### Money representation
**All money is `bigint` halalas (1 SAR = 100 halalas).** No floats anywhere — `0.1 + 0.2` problems on an invoice are unacceptable and legally consequential. Formatting to `SAR 1,234.56` happens only at the display edge.

### Computation order
```
1. Resolve duration tier (daily / weekly / monthly), choosing the tier
   that yields the LOWEST total for the customer.
2. Rental subtotal   = tier rate × billable units, floor-ed at minRentalDays
3. Operator          = operator day rate × days (if selected)
4. Fuel              = policy-dependent line (wet/dry made explicit)
5. Accessories       = Σ (unit rate × qty × days | flat)
6. Transport         = mobilisation + demobilisation
                       f(distance band, transport class, low-bed, escort)
7. Discounts         = server-validated coupon, applied to eligible lines only
8. Taxable subtotal  = (2..7)
9. VAT               = round(taxable × 15%)          ← half-up, on the total
10. Deposit          = class deposit (NOT taxed, NOT revenue)
11. Total due now    = taxable + VAT + deposit
```

**Rounding is applied once, to the VAT on the taxable subtotal** — not per line — to avoid accumulating sub-halala drift across a 12-line quote.

The deposit is deliberately outside the tax base and outside revenue. Conflating a refundable deposit with a charge is both a tax error and the thing that makes customers distrust a checkout.

### Server authority
The browser calls a quote endpoint and *displays* the result. At booking commit the server recomputes the entire breakdown from the database and compares it to the client's claimed total. A mismatch aborts the booking and writes a `price_mismatch` audit event — that signature is how price-manipulation attempts get detected, not just blocked.

---

## 7. Booking transaction

```
BEGIN;
  -- 1. Lock and re-read the unit
  SELECT ... FROM equipment_unit WHERE id = $1 FOR UPDATE;
  -- 2. Re-verify the unit is bookable (status, blackouts)
  -- 3. Recompute the price from DB rates  →  compare to client total
  -- 4. INSERT reservation  →  exclusion constraint arbitrates the race
  -- 5. INSERT booking, booking_items, booking_addons
  -- 6. INSERT booking_event('created')
  -- 7. INSERT audit_log
COMMIT;
```

Idempotency: the client sends an `Idempotency-Key`. A unique index on `(idempotency_key)` means a retried or double-clicked submission returns the original booking instead of creating a second one.

Payment is *not* inside this transaction. The booking is created `pending_payment`; it becomes `confirmed` only when a verified webhook arrives. Holding a database transaction open across a network call to a payment provider is how systems deadlock under load.

---

## 8. Payments

### Interface
```ts
interface PaymentProvider {
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  authorize(input: AuthorizeInput): Promise<PaymentResult>;   // deposit hold
  capture(intentId: string, amount: Halalas): Promise<PaymentResult>;
  void(intentId: string): Promise<PaymentResult>;             // release hold
  refund(input: RefundInput): Promise<RefundResult>;
  verifyWebhook(raw: string, headers: Headers): WebhookEvent; // throws if invalid
}
```

Implementations: `MockPaymentProvider` (deterministic, offline, used by tests and dev) and `MoyasarProvider` (reference real adapter). Selected by `PAYMENT_PROVIDER`. **No credentials ship with this repository; the real adapter refuses to initialise without them.**

### The webhook is the only source of truth
```
Client "payment succeeded"  →  ignored entirely
Provider webhook            →  signature verified (HMAC, constant-time)
                            →  replay-checked (event id unique index)
                            →  amount + currency compared to the booking
                            →  booking transitions to confirmed
```
A forged success POST changes nothing, because the endpoint verifies a signature over the raw body before parsing it. Amount and currency are re-compared against the stored booking so a tampered-but-signed event still cannot underpay a rental.

### Deposits
Modelled as a separate `payment` row with `kind = 'deposit_authorization'`, transitioning `authorized → captured | voided | partially_captured`. Rental charge and deposit are never the same row, never the same intent, and are shown separately to the customer.

---

## 9. Documents and storage

Private, S3-compatible object storage. No bucket is public.

Access path: request → authenticate → authorize *this actor for this document* → generate a short-lived (5 min) signed URL → redirect. Object keys are random UUIDs with no user-controlled component, so key enumeration and path traversal are both structurally impossible.

Uploads: extension and MIME allowlist, magic-byte sniffing (not trusting the declared `Content-Type`), size caps, stored under a random key, never served from the app origin, never executable. A malware-scanning hook is defined in the interface and unimplemented — noted honestly in `FINAL_REVIEW.md`.

---

## 10. Search

PostgreSQL full-text (`tsvector`, GIN index) over class name, model, manufacturer, category and synonyms, combined with structured attribute filters and trigram matching for typos. Bilingual: separate `tsvector` columns per locale with the appropriate configuration.

This handles "100 ton crane riyadh" by parsing the numeric capacity into a range filter and the city into a branch filter before the text search runs. A dedicated search engine is unjustified at fleet scale; the boundary (`catalog/search.ts`) is narrow enough to swap later.

---

## 11. Notifications

```ts
interface NotificationChannel {
  send(msg: OutboundMessage): Promise<DeliveryResult>;
}
```
`ConsoleChannel` (dev), `EmailChannel`, `SmsChannel`. Templates are locale-aware and rendered server-side. **Transactional messages** (booking confirmed, delivery scheduled) send on legitimate-interest grounds; **marketing messages** (abandoned cart, promotions) check stored, unbundled consent and refuse to send without it — a PDPL requirement that is enforced in code rather than in policy.

---

## 12. Deployment

**Recommended: in-Kingdom hosting.** Keeping personal data inside Saudi Arabia sidesteps the PDPL cross-border transfer regime entirely, and matches what enterprise customers ask for in vendor assessments. Options include a Saudi cloud region (AWS Bahrain/KSA, Oracle Jeddah/Riyadh, Google Dammam) or a local provider.

| Component | Choice |
|---|---|
| App | Containerised Next.js, ≥2 instances behind a load balancer |
| Database | Managed PostgreSQL 17, private subnet, TLS-only, automated backups + PITR |
| Storage | S3-compatible, private, SSE at rest |
| CDN | Static assets and images only; HTML is not cached with personalised content |
| Secrets | Cloud secrets manager, injected at runtime — never in the image, never in git |
| CI/CD | typecheck → lint → unit → integration → build → e2e → dependency audit → migrate → deploy |
| Migrations | Forward-only SQL, run as a separate step before the new app version starts |
| Database roles | Migrations run as the **owner**; the application connects as **`hdr_app`**, which cannot create or drop objects and cannot `UPDATE`/`DELETE` the append-only tables |

`docker-compose.yml` provides Postgres for local development only. It is not a production deployment.

### Two database roles, not one

The deploy runs migrations as the owner and then `npm run db:grant`, which applies `db/roles/grant-app-role.sql`. The application's own `DATABASE_URL` points at `hdr_app`.

The grant script is part of the deploy, not a one-off, because it grants on the tables that exist at the time it runs. There is deliberately no `ALTER DEFAULT PRIVILEGES`: a table added by a future migration should be a decision someone makes in that file, not one that happens to them — most of all a future append-only table, which would otherwise arrive writable.

The role is created `NOLOGIN`. Give it a password out of band from the secrets manager (`ALTER ROLE hdr_app WITH LOGIN PASSWORD '…'`) so the credential never enters a file that lives in git.

### Multi-instance requirements

The table above specifies **≥2 instances**, which makes two settings mandatory rather than advisory:

- **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** — Next.js encrypts the values captured in Server Action closures. Unset, each instance generates its own key, so a request served by a different instance than the one that rendered the page cannot decrypt the action reference and the form breaks. Set one stable base64 32-byte value (`openssl rand -base64 32`) across every instance, and keep it stable across deploys. Four modules in this codebase use Server Actions, so this is not hypothetical. Startup warns when it is unset in production.
- **`RATE_LIMIT_BACKEND=redis`** — the in-memory limiter is per-process, so N instances multiply every limit by N. Startup warns about this too.

---

## 13. Third-party services

| Service | Purpose | Status in this repo |
|---|---|---|
| Payment PSP (Moyasar / HyperPay / Tap) | Cards, mada, Apple Pay | Adapter written; inert without credentials |
| Email provider | Transactional mail | Interface + console transport |
| SMS provider | OTP, rental alerts | Interface + console transport |
| Object storage | Documents, images | Interface + local filesystem driver for dev |
| ZATCA Fatoora | E-invoice clearance | Boundary + stub; requires CSID |
| E-signature | Agreement signing | Boundary only |
| Error/APM monitoring | Observability | Boundary only |
| Maps/geocoding | Site coordinates | Manual lat/lng entry in V1 |

Every one is a documented environment variable in `.env.example`. Nothing pretends to work.

---

## 14. Multi-tenancy and the marketplace boundary

Company data isolation is enforced in the **query layer**, not in the UI: every company-scoped read takes a `companyId` derived from the authenticated session and applies it as a mandatory `WHERE` clause. Repository functions do not expose an unscoped variant, so a caller cannot forget.

For the future marketplace: `equipment_unit.supplierId` and `booking.supplierId` exist from day one, defaulted to the house supplier. V2 adds supplier accounts, a payout ledger, and supplier-scoped admin permissions — an additive change, not a migration of the transactional core.

---

## 15. Decision record

| # | Decision | Alternative rejected | Reason |
|---|---|---|---|
| 1 | Modular monolith | Microservices | The core requirement is transactional consistency, not independent scaling |
| 2 | PostgreSQL exclusion constraints | App-level locking, Redis locks | Only the database can guarantee no-overlap under concurrency |
| 3 | Drizzle | Prisma | Needs range types, exclusion constraints, `FOR UPDATE` — Prisma cannot express them well |
| 4 | Custom session auth | Auth0/Clerk/Supabase | PDPL cross-border transfer of personal data; also cost and lock-in |
| 5 | `bigint` halalas | Decimal/float | Exact money arithmetic; VAT and invoices must be exact |
| 6 | Server Components by default | SPA | SEO is a primary objective and mobile bundles must stay small |
| 7 | Custom typed i18n dictionaries | i18n library | Missing translations become compile errors; zero runtime cost |
| 8 | Postgres FTS | Meilisearch/OpenSearch | Premature at fleet scale; narrow boundary allows a later swap |
| 9 | Hybrid instant-book / quote | Instant price on everything | Mobilisation on 600 t+ classes cannot be honestly priced without a route survey |
