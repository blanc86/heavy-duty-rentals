# Final Review

**Date:** 2026-09-03 · **Status:** Working prototype, not production-deployed

This document states plainly what was built, what was not, and what must happen before this handles real money and real customer data. Where something is incomplete it is named here rather than left to be discovered.

---

## 1. What was implemented

### Verified working end to end

Everything below was exercised against a live PostgreSQL 17 instance and a running server, not merely compiled.

| Area | Evidence |
|---|---|
| **Database schema** | 40+ tables, 254 generated statements + 38 hand-written integrity statements, applied cleanly |
| **No double booking** | GiST exclusion constraint verified: overlapping rejected (`23P01`), adjacent allowed, cancellation frees the window |
| **Concurrency** | 10 simultaneous reservations on one unit → exactly 1 succeeds, 9 rejected with the specific SQLSTATE |
| **Booking service** | Creates with a server-computed price; a tampered total is rejected AND audited; retries are idempotent; overlaps are refused as `UnitNoLongerAvailableError` |
| **Pricing engine** | 41 unit assertions: tier selection, minimums, add-on models, transport, VAT rounding, deposit exclusion, coupon caps, determinism |
| **Pricing API** | Live quote returns correct itemised breakdown; weekly tier correctly beats daily at 14 days |
| **Catalog + search** | 14 categories, 18 classes, 74 serialised units seeded and browsable |
| **Availability calendar** | 60-day per-day view computed from real reservations and maintenance blackouts |
| **Bilingual AR/EN** | Both locales render; `dir="rtl"`, `lang="ar"`, genuine Arabic content, correct `hreflang` pairs |
| **Security headers** | CSP with per-request nonce, `frame-ancestors 'none'`, HSTS, `nosniff`, no `X-Powered-By` |
| **CSRF** | Cross-origin state-changing request rejected |
| **Mass assignment** | Unknown fields rejected by strict Zod schemas |
| **Input integrity** | Unknown add-on code rejected rather than silently priced at zero |
| **Webhook forgery** | Unsigned and wrongly-signed webhooks rejected **and recorded** for forensics |
| **Authorization** | Anonymous `/admin` access redirected; 38 RBAC/isolation assertions pass |
| **SEO** | `robots.txt`, `sitemap.xml`, JSON-LD (Organization, Product, LocalBusiness, FAQ, Article, Breadcrumb), canonicals |
| **Doorway-page guard** | `/locations/mecca` (no depot) returns **404** while `/locations/dammam` returns 200 |
| **Two-factor authentication** | TOTP enrolment, confirmation, recovery codes, disable, regenerate. Enrolling MFA instantly strips power from an existing session — verified live |
| **Equipment imagery** | Generated technical illustrations per category; real photographs take precedence automatically when supplied |
| **Production build** | 37 routes compile; `typecheck`, `lint` and 117 tests all clean |

### Test results

```
Test Files  5 passed (5)
     Tests  117 passed (117)
```

- `tests/unit/pricing-engine.test.ts` — 41 assertions
- `tests/integration/availability.test.ts` — 14 assertions (concurrency, blackouts, holds, range validity)
- `tests/integration/booking.test.ts` — 6 assertions (server-computed price, price-manipulation rejection + audit, idempotency, overlap rejection, pricing snapshot, occupancy buffers)
- `tests/security/isolation.test.ts` — 38 assertions (tenancy, IDOR, escalation, separation of duties, DB constraints, driver error unwrapping)
- `tests/integration/mfa.test.ts` — 18 assertions (secret encryption at rest, code replay rejection, drift tolerance, single-use recovery codes)

Plus two live suites, both passing: `scripts/verify-flow.mjs` (33 HTTP checks) and `scripts/verify-mfa.mjs` (12 checks on the MFA gate).

### Feature inventory

**Public:** homepage with working search widget · equipment listing with category-aware filters · equipment detail (specs, load-chart documents, inclusions/exclusions, availability calendar, live configurator) · category landing pages · location pages · guides with a safe Markdown renderer · FAQ · how-it-works · safety · about · contact · legal/policy pages.

**Transaction:** live server-priced configurator · checkout with site, procurement and terms steps · transactional booking with idempotency · payment intent + hosted-page handoff · signed webhook confirmation · confirmation page · VAT invoice · rental agreement.

**Customer:** account dashboard with scoped rental list, counts, and per-booking detail, invoice and agreement.

**Admin:** ops dashboard (revenue with period-over-period, utilization, active/overdue/returns-due, failed payments) · bookings with filters · serialised inventory · utilization report excluding maintenance windows · hash-chained audit log **with live chain verification**.

---

## 2. Four bugs found and fixed during the build

Recorded because all four were real defects, not cosmetic. Two of them would have broken every booking in production.

**Transport silently priced at zero.** When no branch was selected, `loadTransport` returned an empty result, so a delivery-required quote omitted mobilisation entirely. On a class where transport can be 20–40% of the job that is a serious underquote. Fixed: the servicing branch is now resolved from the units that actually stock the class, and if none can be determined the engine **refuses to price** and routes to a quote rather than returning zero.

**A cheaper longer rental was hidden.** A failing test exposed that 25 days bills as 4 weeks (24,000) while 28 days reaches the monthly tier (21,000) — the customer pays more for less. `minDays` is a genuine commercial constraint, so silently applying the monthly rate would misprice the supplier's side. Instead the engine now computes `cheaperIfExtended` and the UI tells the customer, with one tap to take it. Staying quiet would collect 3,000 today and lose the account the first time procurement checked.

**Every booking would have failed.** Writing the booking integration test surfaced that `createBooking` inserted the reservation *before* the booking row it references, violating `reservation.booking_id`'s foreign key. Nothing caught it earlier because the availability tests insert reservations directly and the HTTP verification does not drive the Server Action. The insert order is now booking → reservation, both inside the same transaction so an exclusion violation still rolls the whole thing back. **This is why the booking path needed a test rather than a manual click-through.**

**A lost booking race returned a 500.** Drizzle wraps driver errors and puts the original on `cause`, so `isExclusionViolation` — which checked `error.code` at the top level — never matched. The customer who lost the race for the last crane would have seen an internal error instead of "no longer available" plus alternatives, precisely under the contention where graceful handling matters most. `sqlState` now walks the cause chain (bounded against self-referential chains), with direct unit tests.

---

## 3. What was intentionally not implemented

Each of these needs something only the business can supply. In every case the integration boundary is real code and the gap is visible in the UI rather than disguised.

| # | Not implemented | Why | Next step |
|---|---|---|---|
| 1 | **ZATCA Phase 2 clearance** | Needs CSID onboarding, an ECDSA stamp identity and ZATCA sandbox certification | Engage a tax advisor; implement `ZatcaProvider`; invoices already carry `previousInvoiceHash`, `zatcaUuid`, `zatcaQrPayload` columns and render a visible "not ZATCA-cleared" notice |
| 2 | **Live payment processing** | Needs a SAMA-licensed merchant account | Contract a PSP; set `PAYMENT_PROVIDER=moyasar` + keys; verify request shapes against current API docs; test the webhook in their sandbox |
| 3 | **Deposit authorization holds** | mada hold semantics differ from Visa/MC and must be confirmed | Confirm with the PSP whether mada supports holds and for how long. If not, the deposit must become charge-then-refund — which changes the customer's cash position and **must be disclosed at checkout** |
| 4 | **Legally binding e-signature** | Needs a compliant provider contract | Wire an e-signature provider into `rentalAgreement.signatureProvider`. We record acceptance and explicitly say it is *not* presented as a certified signature |
| 5 | **Real email / SMS** | Needs provider accounts | Implement `NotificationChannel`; templates and consent gating already exist |
| 6 | **Malware scanning on uploads** | Needs a scanning service | Required before accepting customer document uploads in production |
| 7 | **Breached-password check** | Outbound k-anonymity API the business must accept | `isBreachedPassword` is a documented stub returning `false` — deliberately not a fake pass |
| 8 | **Redis rate limiting** | Single instance does not need it | **Required before running >1 instance**, otherwise limits multiply by instance count. Startup warns about this |
| 9 | ~~TOTP MFA enrolment UI~~ | **DONE** | Full flow built: QR enrolment, code confirmation, single-use recovery codes, disable-with-password, regenerate. 18 unit tests + 12 live gate checks |
| 10 | **Delivery dispatch, inspections, reviews, quotes admin, approval workflows, credit terms, CSV export, CMS admin** | T2 scope | Schema is complete for all of them; UI is not built |
| 11 | **Playwright E2E suite** | Time | `playwright.config.ts` is configured; `scripts/verify-flow.mjs` covers the same ground at HTTP level |
| 12 | **Recommendation wizard, telematics, marketplace, dynamic pricing** | T3 / YAGNI | Boundaries reserved (`supplierId`, `telematicsDeviceId`) |

---

## 4. Known limitations

1. **The browser click-through has not been executed.** `createBooking` is now covered directly by integration tests (price computation, tampering rejection, idempotency, overlap handling, snapshot, buffers) — and writing those found two bugs that would have broken every booking. What remains unverified is the thin Server Action wrapper and the React form around it: form submission, the redirect to the payment page, and the return leg. Click it once in a browser before trusting it.
2. **Invoices and agreements are print-optimised HTML, not generated PDFs.** Deliberate: Arabic shaping and bidi in a JS PDF library is a well-known source of broken output, and browsers do both correctly. A real PDF pipeline becomes necessary anyway for ZATCA's PDF/A-3 requirement.
3. **Imagery is generated, not photographed.** Each category renders a technical SVG silhouette (`lib/media/equipment-illustration.ts`), captioned "· illustration" in the page locale. This was a deliberate choice over stock photography: search-engine images are almost always copyrighted, the brief bans "generic stock imagery", and a photo of somebody else's crane on an equipment page implies it is ours. A `class_image` row takes precedence automatically, so commissioning real photography needs no code change — it is the single highest-impact visual improvement available.
4. **`generateStaticParams` returns empty for category pages** — they render dynamically. Fine at this scale; worth revisiting for cache efficiency.
5. **Rate limiting is in-memory.** Correct for one instance only (see gap #8).
6. **Arabic copy is engineer-written, not professionally translated.** Coherent and using correct industry vocabulary, but it needs review before launch. Flagged in the file header.
7. **Search is PostgreSQL full-text.** Correct at fleet scale (hundreds of units). Arabic uses the `simple` configuration because Postgres ships no Arabic stemmer; trigram indexes cover partial and misspelled input.
8. **`clientIpFrom` trusts `X-Forwarded-For`.** Only meaningful behind a proxy that overwrites it. Used for audit context, never for a security decision — but the deployment must terminate at such a proxy.

---

## 5. Security findings

### Controls verified working

Verified live, not merely asserted: CSP with per-request nonce · `frame-ancestors 'none'` · HSTS · `nosniff` · no version disclosure · CSRF origin checking · strict-schema mass-assignment blocking · unknown-add-on rejection · webhook signature verification with forensic logging · webhook replay prevention (unique index) · admin route gating · argon2id with dummy-hash timing equalisation · hashed session tokens · hash-chained audit log with live verification · the schema's structural inability to store card data.

### Remaining security work — in priority order

1. **Independent penetration test.** Non-negotiable before production. Automated tests prove the invariants I thought of; they do not substitute for an adversary who thinks of others.
2. ~~Build the MFA enrolment flow.~~ **Done** — see §1.
3. **Provision a least-privilege database role.** Migration 0001 revokes `UPDATE`/`DELETE` on `audit_log` and `booking_event` *from a role named `hdr_app` if it exists*. Local development connects as the owner, so **that revocation is currently a no-op**. Production must create the role.
4. **Wire monitoring.** Interfaces exist, no vendor connected. At minimum alert on: authentication failure spikes, authorization-denial patterns, `price_mismatch` events, webhook signature failures, and exclusion-violation rates above baseline.
5. **Redis rate limiting** before scaling past one instance.
6. **Malware scanning** before accepting document uploads.
7. **Dependency scanning in CI** — `npm audit` failing the build on high/critical.
8. **Test backup restore.** Backups are designed, restore is untested.

### Accepted residual risks

- `style-src 'unsafe-inline'` remains because React writes inline style attributes. It does **not** weaken `script-src`, which is where XSS lives.
- Guides render through a hand-written allowlist Markdown renderer that escapes before emitting, so a compromised admin account cannot produce stored XSS. A richer parser would need a sanitiser.

---

## 6. Regulatory items requiring professional review

**Nothing in this repository constitutes legal, tax or compliance advice, and no compliance is claimed.**

| Area | Status | Who must review |
|---|---|---|
| **ZATCA e-invoicing (Phase 2)** | Model correct; clearance not implemented; invoices labelled not-cleared | Saudi tax advisor |
| **PDPL** | Data minimisation, unbundled consent with evidence, retention table, in-Kingdom hosting recommendation implemented. No self-service export/delete UI | Legal counsel / SDAIA |
| **E-commerce law** | Maroof registration, identity disclosures and total-price-including-VAT display are addressed. **Whether consumer return rights apply to rental *services* is unresolved** — we implement a configurable business policy rather than assert a statutory window | Saudi counsel |
| **NCA ECC** | Technical controls mapped in `SECURITY.md` §14 as a self-assessment. Not audited, not claimed | Security consultant |
| **Insurance / liability** | Agreement drafts allocate responsibility but have not been reviewed | Legal + insurer |
| **Legal pages** | Operational drafts that visibly say so on every page | Saudi counsel |

---

## 7. Performance findings

- Production build: 34 routes, compiles in ~1.7s.
- Public pages are Server Components; the only client JavaScript is the configurator, checkout form, quote form, mobile drawer and locale switch. The header, footer, cards, calendar, spec tables and all content pages ship **zero** JS.
- Availability queries use the GiST index; catalog queries use targeted composite and partial indexes.
- The 60-day availability calendar is one `generate_series` query, not 60 queries.
- Listing availability resolves in parallel across cards.

**Not measured:** real Core Web Vitals. No Lighthouse run against a production deployment, no 4G throttled measurement, no image pipeline (there are no real images yet). LCP will be dominated by the hero image once real photography exists — it is already marked `fetchPriority="high"`.

---

## 8. SEO findings

**Implemented:** server-rendered content on every public page · per-page metadata with canonicals · `hreflang` pairs including `x-default` · accurate JSON-LD · sitemap covering only pages that genuinely exist · robots blocking transactional/private paths and filter permutations · category and location landing pages with their own copy · a bilingual content engine.

**Deliberate restraint:** filtered and paginated listings are `noindex, follow` — indexing every filter permutation turns a catalogue into thousands of near-duplicates. Location pages exist only for real depots, enforced by a 404. No `aggregateRating` is emitted because no verified reviews exist.

**Remaining:** real photography with descriptive bilingual alt text · more guides targeting the researched queries · capacity-cut landing pages (`/equipment/100-ton-cranes`) — the data supports them, the routes are not built · Google Search Console verification · Arabic keyword research by a native speaker.

---

## 9. Recommended next steps

**Before anything else (week 1)**
1. Click through the booking form once in a browser — the service beneath it is tested, the form wrapper is not.
2. Provision the least-privilege `hdr_app` database role.
3. Replace demo company details, then replace demo inventory with the real fleet.
4. Commission real equipment photography (see "Imagery" below).

**Before launch**
5. Contract a PSP; wire and sandbox-test the real adapter, including the deposit-hold question.
6. Engage a tax advisor on ZATCA; implement clearance.
7. Have Saudi counsel review every legal page.
8. Commission an independent penetration test.
9. Professional Arabic translation review.
10. Wire monitoring and alerting; move rate limiting to Redis.

**First quarter after launch**
11. Delivery dispatch and digital inspections (the biggest operational gaps).
12. Quotes admin — the quote request exists but has no admin response flow.
13. Reviews tied to completed rentals.
14. Notification providers.
15. CSV exports.

---

## 10. Honest summary

The transactional core — availability, pricing, booking, tenancy, audit — is real, tested and behaves correctly under concurrency. The double-booking guarantee is enforced by the database rather than hoped for in application code, and there is a test that proves it with ten simultaneous requests.

The things that are missing are missing because they need a merchant account, a tax advisor, a lawyer, a translator or a penetration tester — not because they were skipped. Every one is named above with a next step, and every one is visible in the running application rather than disguised: the mock provider says it moves no money, invoices say they are not ZATCA-cleared, legal pages say they are drafts, and demo equipment carries a "Demo data" badge.

The single largest gap between this and a production system is not code. It is that nobody qualified has yet reviewed the tax, privacy and consumer-law positions, and nobody adversarial has yet attacked it.
