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
| **Equipment imagery** | 17 real photographs under CC BY / CC BY-SA / public domain, with author and licence recorded and rendered; generated illustrations fill the gaps |
| **Trust content** | Testimonials, reference projects and credentials — consent and verification enforced by database CHECK constraints, not by an admin checkbox |
| **Persuasion landing page** | `/for-contractors` — narrative-led for cold traffic, distinct in structure from the transactional homepage |
| **Production build** | 37 routes compile; `typecheck`, `lint` and 117 tests all clean |

### Test results

```
Test Files  5 passed (5)
     Tests  123 passed (123)
```

- `tests/unit/pricing-engine.test.ts` — 41 assertions
- `tests/integration/availability.test.ts` — 14 assertions (concurrency, blackouts, holds, range validity)
- `tests/integration/booking.test.ts` — 6 assertions (server-computed price, price-manipulation rejection + audit, idempotency, overlap rejection, pricing snapshot, occupancy buffers)
- `tests/security/isolation.test.ts` — 38 assertions (tenancy, IDOR, escalation, separation of duties, DB constraints, driver error unwrapping)
- `tests/integration/mfa.test.ts` — 18 assertions (secret encryption at rest, code replay rejection, drift tolerance, single-use recovery codes)

The security suite additionally asserts that the database refuses to publish a testimonial or a named-client project without recorded consent, and refuses to publish an unverified credential.

Plus two live suites, both passing: `scripts/verify-flow.mjs` (33 HTTP checks) and `scripts/verify-mfa.mjs` (12 checks on the MFA gate).

### Feature inventory

**Public:** homepage with working search widget · equipment listing with category-aware filters · equipment detail (specs, load-chart documents, inclusions/exclusions, availability calendar, live configurator) · category landing pages · location pages · guides with a safe Markdown renderer · FAQ · how-it-works · safety · about · contact · legal/policy pages.

**Transaction:** live server-priced configurator · checkout with site, procurement and terms steps · transactional booking with idempotency · payment intent + hosted-page handoff · signed webhook confirmation · confirmation page · VAT invoice · rental agreement.

**Customer:** account dashboard with scoped rental list, counts, and per-booking detail, invoice and agreement.

**Admin:** ops dashboard (revenue with period-over-period, utilization, active/overdue/returns-due, failed payments) · bookings with filters · serialised inventory · utilization report excluding maintenance windows · hash-chained audit log **with live chain verification**.

---

## 2. Twenty bugs found and fixed during the build

Recorded because all twelve were real defects, not cosmetic. Two would have broken every booking in production. The rest were found by driving the application through a browser rather than asserting against it over HTTP — four from the booking form, four from sweeping every route and every remaining form, four more from following every link the site renders, three from measuring the layout at 375px and reading the browser console, and one from asking what the product promises and checking whether it could keep it.

**Transport silently priced at zero.** When no branch was selected, `loadTransport` returned an empty result, so a delivery-required quote omitted mobilisation entirely. On a class where transport can be 20–40% of the job that is a serious underquote. Fixed: the servicing branch is now resolved from the units that actually stock the class, and if none can be determined the engine **refuses to price** and routes to a quote rather than returning zero.

**A cheaper longer rental was hidden.** A failing test exposed that 25 days bills as 4 weeks (24,000) while 28 days reaches the monthly tier (21,000) — the customer pays more for less. `minDays` is a genuine commercial constraint, so silently applying the monthly rate would misprice the supplier's side. Instead the engine now computes `cheaperIfExtended` and the UI tells the customer, with one tap to take it. Staying quiet would collect 3,000 today and lose the account the first time procurement checked.

**Every booking would have failed.** Writing the booking integration test surfaced that `createBooking` inserted the reservation *before* the booking row it references, violating `reservation.booking_id`'s foreign key. Nothing caught it earlier because the availability tests insert reservations directly and the HTTP verification does not drive the Server Action. The insert order is now booking → reservation, both inside the same transaction so an exclusion violation still rolls the whole thing back. **This is why the booking path needed a test rather than a manual click-through.**

**A lost booking race returned a 500.** Drizzle wraps driver errors and puts the original on `cause`, so `isExclusionViolation` — which checked `error.code` at the top level — never matched. The customer who lost the race for the last crane would have seen an internal error instead of "no longer available" plus alternatives, precisely under the contention where graceful handling matters most. `sqlState` now walks the cause chain (bounded against self-referential chains), with direct unit tests.

### Found by the browser click-through

The four above came out of tests. These four came out of driving the real form, signed in, in a browser — and none of them could have been caught by the HTTP-level verification script, which is the argument for doing both.

**The account dashboard 500'd for every company customer.** `bookingCountsForActor` hand-wrote `company_id = ANY(${array}::uuid[])` in raw SQL. Drizzle expands an interpolated JS array into one bind parameter *per element*, so Postgres received a bare uuid where it expected an array literal and raised `22P02 malformed array literal`. The same file already had a correct `scopeFor()` helper using `inArray`; the fix was to use it. The lesson is narrower than "avoid raw SQL": it is that a predicate which already exists as a helper should never be re-expressed by hand.

**The admin dashboard 500'd as soon as one booking existed.** Raw `db.execute` runs through the driver's `unsafe()` path, which bypasses the type parsers the query builder relies on, so a `timestamptz` column arrives as a **string** — in Postgres's own rendering (`2026-09-08 00:00:00+00`), which is not valid ISO 8601. The row generic on `db.execute<T>` is an unchecked assertion, so `start_date: Date` compiled happily and then threw `Invalid time value` inside `Intl.DateTimeFormat` the first time a booking row was rendered. Fixed with `parseTimestamp`/`parseTimestampOrNull` at the repository boundary, the row generics corrected to `string` so the compiler now catches this class of mistake, and six unit tests covering microsecond truncation and non-UTC offsets. **Every seeded page rendered fine because there were zero bookings; the bug needed real data to appear.**

**The checkout overstated what the card is charged.** The summary labelled `subtotal + VAT + deposit` as "Total due now" — SAR 30,977 — while the payment provider was correctly charging only `subtotal + VAT`, SAR 22,977, and the tax invoice correctly showed 22,977. Three surfaces, two different numbers, and the most prominent one was wrong by the deposit. The pricing engine now returns `chargedNowHalalas` as the single authority on what is billed, the deposit is presented below it as authorised at handover, and a third line gives total exposure. Locked in by unit tests and by two assertions in `verify-flow`.

**Switching language mid-checkout discarded the configuration.** The language switch built its href from the pathname only, so `/en/book/x?start=…&end=…&branch=…&delivery=1&km=40` became `/ar/book/x` — dates, branch and transport gone, on the page where an Arabic-speaking customer is most likely to switch. The query string is now carried separately from the canonical pathname, so the switch preserves it while hreflang and canonical URLs stay query-free.

### Found by sweeping every route and every remaining form

Driving one form found four bugs, so the rest of the application got the same treatment: `npm run verify:routes` requests every page in both locales — anonymously, as an admin, and as the customer who owns a booking — and each remaining form was submitted by hand.

**Nobody could sign out.** `logoutAction` was written, `dict.nav.logout` was translated into both languages, `revokeAllSessions` existed — and no component rendered a control, so there was no way to leave an account. Sessions last thirty days and this is used from shared site-office and depot machines. Added a sign-out form (a POST, not a link: a GET that destroys a session can be fired by a prefetch or an image tag) to the header, the mobile drawer and the account page.

**Nor could anyone change their password.** The same shape of defect, and worse: `changePasswordAction` was written, guarded, rate-limited, audited, and revokes every *other* session on success — a password change is how a user evicts an attacker, and that only works if it kills the attacker's session. No component rendered a form, so the one control a compromised account needs was unreachable. Added it to the security page and verified both paths: the correct current password changes it and revokes the other live session while keeping the caller's own, and a wrong one is refused with "Your current password is incorrect." and recorded as `auth.password_change_failed`.

Two fully-implemented, fully-guarded server actions with no way to reach them is a pattern worth naming: the actions had tests and audit trails, so everything that looks at code looked healthy. Only opening the page shows that the button is missing.

**Every registration produced an account nobody could use.** `registerAction` created the user with status `pending_verification`; `resolveSession` grants no actor to a non-active user. So a new customer received a valid session, was redirected to `/account`, was bounced back to sign-in, and looped. Signing in again did not help — login only rejects `suspended`, so it issued another session that also resolved to nothing. There was no escape, because no email verification exists anywhere: `auth_token` is never written to, and there is no mail transport at all. Nothing failed loudly — the row was written, the audit said success, the redirect looked deliberate, every route returned its expected status. The only symptom was a customer who could never get in. Registration now creates the account `active` with `email_verified_at` left null, which is the truth: the account works, the address is unproven. Three integration tests pin the invariant that was violated.

**All three Arabic guides had never been reachable.** Next.js hands dynamic segments to the page **percent-encoded**, not decoded. ASCII kebab-case slugs encode to themselves, so this is invisible until a slug is non-ASCII — and article slugs are translated rather than transliterated, which is correct for SEO and fatal here. Every Arabic guide arrived as `%D9%85%D8%A7-…`, matched nothing, and 404'd, while the guides index linked to them happily. Fixed with `decodeSlugParam`. Separately, the language switch built `/ar/guides/<english-slug>`, which matches no article; the route now resolves a foreign-locale slug through the translation group and redirects to its counterpart.

**The admin console repeated the checkout's money error.** The dashboard showed "Revenue (30d) SAR 22,977" beside a booking "Total SAR 30,977" — a reconciliation trap, since the deposit in that total is never collected online. Both admin tables now show the charged amount, which agrees with the revenue tile and the tax invoice, with the deposit listed beneath rather than folded in.

### Found by following every link the site renders

The route sweep only checks URLs someone remembered to put in it, so it now also collects every internal `href` the public pages actually render — 120 distinct links — and follows each one.

**Two footer links 404'd on every page of the site.** `/account/support` pointed at a support console that does not exist (the contact page is the support surface, and it now points there), and `/compare` pointed at a feature that had never been built.

**Comparison was an unbuilt "Must".** PRD C5 — "Compare up to 4 classes side by side, with Book CTA per column" — is marked **M**, and the PRD's own scope line lists "comparison" as delivered. It was not: no page, no component, only a full set of unused dictionary keys and a footer link to a 404. Built it. The selection lives in `localStorage` (a disposable scratchpad) but the comparison itself is a URL, so an engineer can paste `/compare?items=…` to a procurement manager and it still works. The table takes the **union** of specs across the selected machines rather than the intersection — comparing only shared labels would silently drop the specification that decides the choice — and every column carries its own CTA, which correctly reads "Request a quote" for a class above the instant-book threshold and "Check availability" below it.

**Two seed-data errors the comparison table exposed.** A dewatering pump and an air compressor both advertised "Output: 0 kVA" — a machine that produces nothing, which is worse than saying nothing — and every sub-tonne machine rendered as "0.15 t" because capacity was divided by 1000 unconditionally. The seed no longer writes zero-valued specs at all, capacity is written in kilograms below a tonne, and a `formatCapacity` helper applies the same rule everywhere it is displayed. The fleet spans a 300 t crawler crane and a 150 kg pump; one divisor was never going to serve both.

### Found by testing at 375px and reading the console

**The equipment page scrolled sideways on a phone.** Measured at 375px, the page was 416px wide in both locales. The cause was not the table but the grid around it: a grid item defaults to `min-width: auto`, so the widest thing inside sets a floor for the column, and `ScrollX`'s `overflow-x` never got a chance to act. `min-w-0` on the column fixes it, and the table now scrolls inside its own box — which is the one thing that component exists to do. The tax invoice had the same defect from a bare unwrapped `<table>`; it now scrolls inside a container, with `print:overflow-visible` so a printer still gets the whole table. Every other page — home, catalog, item, checkout, account, booking, comparison, both locales — measures clean at 375px.

**Every JSON-LD block was being refused by our own CSP.** The policy is `script-src 'self' 'nonce-…' 'strict-dynamic'`, and CSP applies to *every* `<script>` element — including a `type="application/ld+json"` data block that never executes. Next.js nonces its own 18 script tags; the twelve structured-data blocks the application renders were not nonced, so a crawler rendering with CSP enforced would see none of them. This is the worst kind of silent: the markup is present in the HTML, so viewing source passes, and `verify-flow`'s existing check that `"@type":"Product"` appears in the body passed too. All twelve now go through a `cspNonce()` helper, and two new assertions check that the JSON-LD is nonced and that no script on the page is missing one.

**Hot reload had been dead the whole time.** `strict-dynamic` disables host-source expressions, so `'self'` stops applying — and Turbopack's hot-reload client, served from this origin but not nonced, was blocked. The server kept compiling while the browser kept showing the previous build, which presents as a caching bug and cost real time before the console explained it. Development now omits `strict-dynamic` (keeping the nonce, so the production path is still exercised); production is byte-identical.

### Found by asking what the product promises

**Nobody could cancel a booking.** The site sells "book online, no phone calls needed", and there was no way to un-book online. Everything underneath was already built: `transitionBooking` cancels and releases the reservation, the cancellation tiers live in settings, the policy page publishes the refund schedule from those tiers, and the rental agreement quotes the customer their own entitlement. What was missing was any way to act on it — and `provider.refund()` had no callers anywhere, so no refund had ever been issued by any code path.

The consequence was not only a broken promise. A machine held by a booking nobody could cancel stayed out of inventory until someone noticed by hand, which makes this a fleet-utilisation problem as well as a UX one.

Built the customer cancellation: the refund figure is computed from the *same* settings the policy page renders, and shown **before** the customer commits, behind a confirm step. Order is deliberate — release the machine first, refund second, so a failed payout cannot leave a cancelled customer holding a crane; the refund row survives as `pending` for an operator to retry, and the failure is audited. The refund is a percentage of what was **charged**, never of the total, because the total includes a deposit that was never collected online.

Verified end to end: a booking with 657 hours' notice landed in the 100% tier, refunded SAR 22,977 through the provider, moved the payment to `refunded`, released the reservation — and the availability API went from 0 to 1 for those dates, which is the only proof that "released" means anything. Eight unit tests pin the tier boundaries (167 hours is not "about a week"), the negative-notice case, and the fact that the refund arithmetic rounds *down* so a rounding error can never overpay.

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
3. **Imagery is licensed demo photography, not the real fleet.** 17 of 18 classes carry a real photograph from Wikimedia Commons under CC BY, CC BY-SA or public domain, with the author, licence and source stored in `image_attribution` and rendered beneath the image — those licences require attribution, and storing it in the database rather than a template means the obligation survives a redesign. The remaining class and every category card falls back to a generated technical illustration.

    **These are other companies' machines**, and some carry visible competitor branding. The caption says "Illustrative photo of a comparable machine, not this unit." Replacing them with the business's own photography needs no code change, removes the attribution requirement, and is still the single highest-impact visual improvement available.

4. **Trust content is demo placeholder.** Testimonials, reference projects and the operational stat bar are populated with clearly-flagged demo rows (`is_demo_data`, badged in the UI). The stat bar counts real database facts — fleet size, model count, depot count — rather than unverifiable claims like "years in business". Credentials are seeded **unpublished and unverified on purpose**: the database refuses to publish one without `verified_at`, because a certification badge that does not stand up costs more than no badge on a page read by procurement teams who check.
5. **`generateStaticParams` returns empty for category pages** — they render dynamically. Fine at this scale; worth revisiting for cache efficiency.
6. **Rate limiting is in-memory.** Correct for one instance only (see gap #8).
7. **Arabic copy is engineer-written, not professionally translated.** Coherent and using correct industry vocabulary, but it needs review before launch. Flagged in the file header.
8. **Search is PostgreSQL full-text.** Correct at fleet scale (hundreds of units). Arabic uses the `simple` configuration because Postgres ships no Arabic stemmer; trigram indexes cover partial and misspelled input.
9. **`clientIpFrom` trusts `X-Forwarded-For`.** Only meaningful behind a proxy that overwrites it. Used for audit context, never for a security decision — but the deployment must terminate at such a proxy.

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

**Done since the first review**
- ~~Click through the booking form once in a browser.~~ Done, signed in, end to end: configure → checkout → hosted payment → signed webhook → `confirmed` → tax invoice. It found four real bugs, all fixed and listed in §2.
- ~~Provision the least-privilege `hdr_app` database role.~~ Done: `db/roles/grant-app-role.sql`, run by `npm run db:grant`. Verified by connecting **as** the role: `UPDATE`/`DELETE` on `audit_log`, `booking_event` and `payment_webhook_event` are all refused, `INSERT` still works, `DROP TABLE` and `CREATE TABLE` are refused, ordinary business DML works. Migration 0001's revocation is no longer a no-op.

**Before anything else (week 1)**
1. Replace demo company details, then replace demo inventory with the real fleet.
2. Replace the demo testimonials and reference projects with real, consented ones — and record the consent, because the database will not publish them otherwise.
3. Commission real equipment photography (see "Imagery" above).
4. Decide where the refundable deposit is actually taken (see below). The UI now says "authorised at handover" — that has to be true operationally, or the wording changes.

**Before launch**
5. Contract a PSP; wire and sandbox-test the real adapter, **including the deposit hold**. This is the one place where the code deliberately stops short of what the interface allows: `PaymentProvider` supports `mode: "authorize"`, `capture()` and `void()`, but `startPayment` creates only the `rental_charge` intent. A hosted-page PSP can redirect the customer once per checkout, and authorising the deposit afterwards needs a stored card token — which needs tokenisation on a contract that does not exist yet. So the deposit is presented as authorised at handover and is not charged online. It is not faked: nothing claims to have collected it, the invoice states it is held separately and carries no VAT, and the charged figure excludes it.
6. Engage a tax advisor on ZATCA; implement clearance.
7. Have Saudi counsel review every legal page.
8. Commission an independent penetration test.
9. Professional Arabic translation review.
10. Wire monitoring and alerting; move rate limiting to Redis.

**First quarter after launch**
11. Delivery dispatch and digital inspections (the biggest operational gaps).
12. Quote **response** flow. The request form and a read-only `/admin/quotes` list now exist — until that list was added, requests landed in the database and no screen showed them, so the form's promise of "we will come back with an itemised quote" had nowhere to be kept. Pricing and sending a quote is still to build; above the instant-book threshold it needs a route survey and a lifting engineer, so it is a workflow, not a form.
13. Reviews tied to completed rentals.
14. Notification providers.
15. CSV exports.

---

## 10. Honest summary

The transactional core — availability, pricing, booking, tenancy, audit — is real, tested and behaves correctly under concurrency. The double-booking guarantee is enforced by the database rather than hoped for in application code, and there is a test that proves it with ten simultaneous requests.

The things that are missing are missing because they need a merchant account, a tax advisor, a lawyer, a translator or a penetration tester — not because they were skipped. Every one is named above with a next step, and every one is visible in the running application rather than disguised: the mock provider says it moves no money, invoices say they are not ZATCA-cleared, legal pages say they are drafts, and demo equipment carries a "Demo data" badge.

The single largest gap between this and a production system is not code. It is that nobody qualified has yet reviewed the tax, privacy and consumer-law positions, and nobody adversarial has yet attacked it.
