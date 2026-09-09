# How this code works

An orientation for someone about to change it. The other documents describe
what was decided and why; this one describes where things are, how a request
moves through them, and which parts will bite you.

- `PRD.md` — what the product is meant to do
- `ARCHITECTURE.md` — how it is deployed and why
- `DATABASE.md` — the schema and its constraints
- `SECURITY.md` — the threat model and controls
- `research.md` — the Saudi market and regulatory findings behind the decisions
- `FINAL_REVIEW.md` — what is real, what is not, and every bug found in review

---

## 1. The one-paragraph version

A customer searches equipment, picks dates, sees a real price and real
availability, and books and pays online. A depot operator then runs the rental
from an admin console: machine out, machine back, cancellations, taking a broken
crane off the market. Everything is bilingual English/Arabic with full RTL.

The two things the whole system is built around are that **a machine can never
be double-booked** and that **a price shown is a price honoured**. Both are
enforced in the database, not in application code, because application code is
where races and refactors live.

---

## 2. Request lifecycle

Every request passes through the same path:

```
Browser
  │
  ├─▶ proxy.ts ─────────── locale negotiation (/en, /ar) + CSP with a fresh nonce
  │                        sets x-nonce, x-pathname, x-search on the request
  │
  ├─▶ app/[locale]/…  ──── Server Components. Data is fetched HERE, not in the
  │      page.tsx          browser, so pages are crawlable and ship no query JS
  │
  ├─▶ lib/**/repository ── reads. Every one takes the ACTOR and applies
  │                        ownership in the same query that fetches the row
  │
  └─▶ lib/**/actions ───── writes. Every one goes through `guard`
```

`proxy.ts` is Next 16's renamed `middleware`. It runs on the Node runtime and
does exactly two jobs — locale and CSP — because anything else in a proxy runs on
every asset request.

### Writes always go through `guard`

`src/lib/server/guard.ts` is the trust boundary. Every Server Action wraps its
handler in it, and the order is deliberate:

```
1. CSRF          same-origin check (skipped only for provider webhooks,
                 which authenticate by signature instead)
2. Rate limit    BEFORE authentication, so flooding the login endpoint is
                 cheap for us and expensive for the attacker
3. Authenticate  resolve the actor from the session cookie
4. Authorize     requireAdmin / requireCompanyPermission / requireMfa
5. Validate      Zod, always `.strict()` so unknown keys are rejected
                 rather than ignored — that is what blocks mass assignment
6. Handle        your code
7. Audit         hash-chained, append-only
```

If you are adding a mutation and you find yourself not using `guard`, stop.

> **`"use server"` makes every export a public HTTP endpoint.** Not just the ones
> you import somewhere. A helper exported from an actions file is callable by
> anyone who can find its id. One such helper — an unguarded booking lookup —
> shipped in this codebase and was found by `npm run verify:reachable`.

---

## 3. Where the invariants actually live

### No double booking

Not a transaction, not a lock, not a check-then-insert. A Postgres exclusion
constraint:

```sql
ALTER TABLE reservation
  ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (unit_id WITH =, period WITH &&)
  WHERE (status IN ('held', 'confirmed', 'active'));
```

Two concurrent bookings for the same machine: one commits, the other gets
SQLSTATE `23P01` and the caller offers alternatives. The integration test fires
ten simultaneous inserts and asserts exactly one survives.

Because the guarantee is a constraint, it holds against code paths that do not
exist yet.

### Money is never a float

`bigint` halalas everywhere (1 SAR = 100 halalas), VAT as parts-per-million
(15% = `150000`), and rounding applied **once** on the taxable subtotal rather
than per line — rounding each of a dozen lines produces an invoice that does not
foot against its own total.

`src/lib/pricing/engine.ts` is pure: no I/O, no clock, no database. It takes
numbers and returns numbers, which is why it can be exhaustively tested.
`src/lib/pricing/repository.ts` does the I/O and no arithmetic. Keep that split.

`chargedNowHalalas` is what the card is billed (subtotal + VAT).
`totalHalalas` includes the refundable deposit and is **never** labelled "due
now" — the deposit is authorised at handover, not collected online.

### A price shown is a price honoured

The browser sends what it *believes* the total is. `createBooking` recomputes
from database rates, compares, and refuses on mismatch — writing an audit entry,
because a systematic attempt should be visible rather than merely blocked. The
client's figure is never written to the booking.

### The audit log cannot be rewritten

Hash-chained (`entryHash = SHA256(previousHash || canonicalJson(entry))`) so
tampering is *detectable*, and the application's database role has no
`UPDATE`/`DELETE` on it so tampering is *impossible through the app*. Both,
deliberately: detection alone is weaker than prevention, prevention alone leaves
no evidence if bypassed.

---

## 4. Module map

| Path | What lives there |
|---|---|
| `lib/db` | connection, schema, and the driver-quirk helpers (§6) |
| `lib/server/guard.ts` | the trust boundary every mutation passes through |
| `lib/server/audit.ts` | hash-chained append-only log |
| `lib/server/rate-limit.ts` | named buckets; see §6 on the two login limits |
| `lib/auth` | sessions, passwords, MFA, the post-login redirect rule |
| `lib/rbac.ts` | permissions. `admin:*` for staff, `booking:*` etc. for company members — they are **different sets** |
| `lib/availability` | who is free when; the expiry-aware read predicate |
| `lib/pricing` | pure engine + impure repository |
| `lib/booking` | `createBooking`, `transitionBooking`, customer actions |
| `lib/payments` | provider interface, mock + Moyasar adapters, webhook processing, refunds |
| `lib/invoicing` | VAT invoices; ZATCA is a boundary that refuses to pretend |
| `lib/catalog` | equipment search, filters, class detail |
| `lib/admin` | operator reads and the operational actions |
| `lib/i18n` | `en.ts` is the **type source**; a missing Arabic key is a compile error |
| `components/ui` | the primitives everything else is built from |

---

## 5. The booking lifecycle

```
                 checkout           verified webhook        depot          depot
 (none) ──────▶ pending_payment ──────▶ confirmed ──────▶ active ──────▶ completed
                    │                       │                │
                    │ hold lapses           │ customer or    │
                    ▼ (sweeper)             ▼ operator       ▼
                 expired               cancelled ◀───────────┘
```

Two things worth knowing:

**The reservation is written as a `held` row with an expiry**, before payment.
Payment hardens it to `confirmed` with a null expiry. If the customer abandons
the payment page, the hold lapses and the machine returns to the fleet. Writing
it as `confirmed` immediately — which it once did — removes the machine
permanently on every abandoned checkout.

**Only a verified webhook can confirm a booking.** A browser POSTing "I paid"
changes nothing, because the confirmation path starts from a signature the
browser cannot produce.

---

## 6. Things that will bite you

These are all real defects that shipped and were found in review. They are
listed because each one looked correct.

**Raw `db.execute` returns strings, not Dates.** Drizzle's postgres-js driver
runs raw SQL through `unsafe()`, which bypasses the type parsers. A
`timestamptz` arrives as `"2026-09-08 00:00:00+00"` — not valid ISO 8601. The
generic on `db.execute<T>` is an *unchecked assertion*, so declaring
`start_date: Date` compiles and then throws inside `Intl.DateTimeFormat`. Declare
these columns as `string` and convert with `parseTimestamp` from `lib/db`.

**Interpolating a JS array into raw SQL does not make a Postgres array.**
Drizzle expands it into one bind parameter per element, so
`ANY(${ids}::uuid[])` receives a bare uuid and fails with `22P02`. Use
`inArray()` from the query builder.

**Dynamic route params arrive percent-encoded.** Invisible for ASCII slugs,
fatal for the Arabic article slugs. Use `decodeSlugParam` from `lib/routing`.

**A grid item defaults to `min-width: auto`.** The widest child sets a floor for
the column, so an overflow container inside it never gets to scroll and the
whole page slides sideways on a phone. `min-w-0` on the column.

**CSP applies to every `<script>`, including `application/ld+json`.** Structured
data without the nonce is refused, and a crawler rendering with CSP sees none of
it — silently, because the markup is still in the source. Use `cspNonce()` from
`lib/seo/nonce`.

**Login needs two rate limits, not one.** Buckets are keyed
`name:identifier`, so limiting by email gives every account its own allowance and
does nothing against spraying one password across a thousand accounts. `login`
(per email) and `loginPerIp` (per caller) are both applied and neither
substitutes for the other.

**A config switch that is not read is not a setting.** `TAX_INVOICE_PROVIDER`,
`RATE_LIMIT_BACKEND` and three others once selected unimplemented backends and
silently did nothing. Every unimplemented option now refuses to start. If you
add a provider seam, make selecting the missing half fail loudly.

---

## 7. Running it

```bash
npm install
cp .env.example .env          # fill ENCRYPTION_KEY and APP_SECRET
npm run db:up                 # Postgres 17 in Docker
npm run db:migrate            # forward-only SQL, one transaction per file
npm run db:grant              # least-privilege hdr_app role — run after EVERY migrate
npm run db:seed               # demo fleet, admin + customer accounts
node scripts/fetch-demo-images.mjs   # optional: freely-licensed demo photography
npm run dev
```

Sign in with `admin@example.com` / `customer@example.com` and the seed password
from `.env`. All equipment is fictional demo data and is flagged as such in the
UI.

### Verification

| Command | What it proves |
|---|---|
| `npm run verify` | types, lint, 164 unit and integration tests |
| `npm run verify:routes` | every route in both locales, and every internal link |
| `npm run pentest` | 51 adversarial probes: IDOR, escalation, injection, traversal, XSS, redirects, headers |
| `npm run verify:a11y` | WCAG 2.2 A/AA in a real browser, both locales |
| `npm run verify:reachable` | exported capabilities nothing can reach |
| `node scripts/verify-flow.mjs` | the money path end to end against a running server |
| `node scripts/verify-mfa.mjs` | the second-factor gate |

The last three need `npm run dev` running. CI runs all of them
(`.github/workflows/verify.yml`).

`REQUIRE_DB=1` turns "database unreachable" from a skip into a failure. Tests
skip by default so `npm test` is useful on a laptop without Docker; CI sets it,
because a broken database silently skipping 48 tests is worse than a red build.

### Why CI runs the dev server

`next start` forces `NODE_ENV=production`, and `assertProductionReady` then
refuses to boot with `PAYMENT_PROVIDER=mock` and a database URL without
`sslmode=require`. That guard is correct — it exists to stop a deployment that
takes no real money — so CI runs the dev server rather than weakening it.

---

## 8. What is deliberately not built

Named here so nobody goes looking for it. The full list with reasoning is
`FINAL_REVIEW.md` §3.

- **Notifications.** No mail or SMS transport exists. Nobody receives anything.
- **ZATCA Phase 2 clearance.** Invoices are structurally correct and visibly
  labelled "not cleared". Selecting `zatca` refuses to start.
- **The deposit hold.** A hosted-page PSP redirects once per checkout, and
  authorising afterwards needs a stored card token that needs a signed contract.
  The deposit is presented as authorised at handover and is never charged online.
- **Password reset**, which needs the mail transport.
- **S3 storage, Redis rate limiting** — both refuse to start if selected.

The pattern to preserve: a gap is fine, a gap wearing a working switch is not.
