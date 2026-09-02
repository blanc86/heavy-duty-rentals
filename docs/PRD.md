# Product Requirements Document

**Product:** Heavy Equipment Rental Platform (KSA)
**Version:** 1.0 (MVP scope)
**Date:** 2026-09-02

---

## 1. Vision

> A construction company in Saudi Arabia can find the correct machine, trust the company, understand the price, and rent it online in minutes — at 11pm, in Arabic, from a phone, on a site.

The competitive landscape (see `research.md`) is uniformly brochure-ware: no pricing, no availability, no transaction. The product thesis is not "a nicer website." It is **moving the transaction online in a market where nobody has.**

### North-star metric
**Time-to-booked** — median elapsed seconds from landing to confirmed booking.
Everything else (bundle size, RTL correctness, filter design) is instrumental to it.

### Supporting metrics
| Metric | Why |
|---|---|
| Availability-check rate (sessions that check a date range) | The true top-of-funnel conversion event |
| Checkout completion rate | Where friction concentrates |
| Quote → booking conversion | Validates the hybrid instant/quote split |
| Fleet utilization % | The business's actual P&L driver |
| Repeat rental rate | Validates the account/portal investment |

---

## 2. Personas

### P1 — Site/Project Engineer ("Fahad") — *primary*
Needs a 100 t mobile crane in Riyadh for 14 days, starting the 14th. On site, on a phone, in the sun. Half-Arabic, half-English technical vocabulary.

- **Job:** confirm a machine that can make the lift is free on his dates, at a price he can put in a variation order.
- **Fails today when:** the site shows no price, no availability, no load chart; he has to call and wait.
- **Wins when:** he searches by capacity, sees green availability on his dates, gets a full price breakdown with VAT, and books.

### P2 — Procurement Manager ("Noura")
Runs multiple sites, multiple machines, monthly rentals. Needs PO numbers, cost centres, VAT invoices, approval before spend, and rental history for audit.

- **Job:** commit company money correctly and defensibly.
- **Fails today when:** every rental is a WhatsApp thread with no paper trail.
- **Wins when:** she can raise a rental request, route it for approval, attach a PO, and download a VAT invoice.

### P3 — Small Contractor ("Sami")
One backhoe for four days. Not procurement-literate. Easily overwhelmed.
- **Wins when:** the flow is short, the total is unambiguous, and nothing asks for a cost centre.

### P4 — Enterprise (Aramco/SABIC tier contractor)
Multiple users, roles, approval chains, credit terms, monthly consolidated invoicing, document access control, and a vendor security assessment.
- **Wins when:** the platform behaves like an ERP-adjacent system, not a shop.

### P5 — Rental Operations Admin ("Khalid") — *internal*
Runs the fleet. Must add equipment, set rates, block units for maintenance, dispatch deliveries, process returns, and see utilization — **without a developer**.

### P6 — Finance Admin — *internal*
Invoices, refunds, deposits, credit limits, reconciliation.

---

## 3. Core User Journeys

### J1 — Anonymous search to confirmed booking (the money path)
```
Google "100 ton crane rental riyadh"
  → SSR class page (price range + real availability visible, no login)
  → equipment detail page (specs, load chart, what's included/excluded)
  → pick dates + site location
  → LIVE server-priced breakdown (rental, operator, mobilisation, VAT, deposit, total)
  → configure (operator, fuel, accessories, delivery window)
  → account creation OR guest→account at checkout
  → review + explicit terms acceptance
  → payment (mada / card / Apple Pay, or corporate credit)
  → confirmation + agreement + invoice + email/SMS
```
**Hard requirement:** every step before account creation works anonymously. Availability and full price are never behind a login.

### J2 — Above-threshold / complex → structured quote
Large capacity, multi-machine, long-term, or complex logistics. Same discovery flow, but the CTA becomes **Request Quote** with a structured form pre-filled from the configuration. Admin responds with a priced quote the customer can accept online, which converts to a booking.

**This is not "contact us for everything."** It is a deliberate, threshold-driven fallback where instant pricing would be dishonest.

### J3 — Procurement with approval
Requester configures → submits for approval → approver receives notification → approves → booking is created and paid on company credit terms with the PO attached.

### J4 — Rental lifecycle management
View active rental → track delivery status → request extension (re-priced and availability-checked automatically) → off-rent → return inspection → final invoice → review.

### J5 — Admin operations
Add model → add serialized units → set rates → schedule maintenance (unit auto-unavailable) → receive booking → dispatch delivery → record pre-hire inspection → record return inspection → close rental.

---

## 4. Functional Requirements

Priority: **M** = MVP (must ship), **T2**, **T3**.

### 4.1 Catalog & Discovery
| ID | Requirement | Pri |
|---|---|---|
| C1 | Category → equipment class (model) → serialized unit taxonomy | M |
| C2 | Class detail page: specs, images, documents, inclusions, rates, availability, related | M |
| C3 | Full-text + attribute search ("100 ton crane riyadh") | M |
| C4 | Category-aware dynamic filters (crane: capacity/boom/reach; forklift: capacity/fuel/mast) | M |
| C5 | Compare up to 4 classes side by side, with Book CTA per column | M |
| C6 | Capacity-cut landing pages (50/100/200 ton) | M |
| C7 | Location pages for real branches only | M |
| C8 | Saved equipment / favourites | T2 |
| C9 | Recently viewed | T2 |
| C10 | Requirement-led recommendation wizard (weight/height/reach → suggested classes) | T3 |

### 4.2 Inventory & Availability
| ID | Requirement | Pri |
|---|---|---|
| A1 | Every physical machine is a distinct `equipment_unit` with serial, asset no., branch, status, hours | M |
| A2 | Statuses: available, reserved, rented, in_transit, maintenance, inspection, out_of_service | M |
| A3 | Availability = no overlapping active reservation AND no overlapping blackout (maintenance/inspection) | M |
| A4 | **Double-booking is impossible at the database level**, not the application level | M |
| A5 | Reservations include configurable mobilisation/demobilisation buffer days (a crane is not available the same morning it comes off another job) | M |
| A6 | Availability calendar on the class page showing units-free-per-day | M |
| A7 | Maintenance schedule; a unit in maintenance is automatically unbookable | M |
| A8 | Telematics hours ingestion | T3 |

### 4.3 Pricing
| ID | Requirement | Pri |
|---|---|---|
| P1 | Server-side pricing engine; **no price ever originates in the browser** | M |
| P2 | Duration-tiered rates (daily / weekly / monthly) chosen by best-value-for-customer | M |
| P3 | Priced add-ons: operator, fuel, accessories, extra crew | M |
| P4 | Distance/class-based mobilisation + demobilisation, low-bed and escort surcharges | M |
| P5 | 15% VAT computed server-side; totals in integer halalas (no floats) | M |
| P6 | Refundable security deposit, distinct from rental charge | M |
| P7 | Itemised breakdown shown before payment; no unexplained fees | M |
| P8 | Coupons/discounts with server-side validation | M |
| P9 | Admin-editable rates without a deploy | M |
| P10 | Seasonal / location / customer-tier pricing rules | T2 |
| P11 | Dynamic utilization-based pricing | T3 |

### 4.4 Booking & Checkout
| ID | Requirement | Pri |
|---|---|---|
| B1 | Multi-step flow: equipment → dates → site → configuration → details → review → terms → pay → confirm | M |
| B2 | Server revalidates availability **and** recomputes price at commit; client values are inputs, never authorities | M |
| B3 | Idempotent booking creation (idempotency key) | M |
| B4 | Explicit, logged terms acceptance (version, timestamp, IP) | M |
| B5 | Time-boxed reservation hold during checkout, auto-expiring | M |
| B6 | Booking reference (`RNT-XXXXXX`), confirmation page, email + SMS + in-app | M |
| B7 | Guest checkout that creates an account | M |
| B8 | Cancellation with a tiered, business-configured refund policy | M |
| B9 | Extension request: re-checks availability, re-prices the delta | T2 |
| B10 | Abandoned checkout capture + consented recovery email | T2 |

### 4.5 Accounts, Companies, RBAC
| ID | Requirement | Pri |
|---|---|---|
| U1 | Individual accounts: register, verify email, login, reset, sessions | M |
| U2 | TOTP MFA (mandatory for admin, optional for customers) | M |
| U3 | Company accounts with multiple members | M |
| U4 | Company roles: owner, admin, procurement, finance, project_manager, viewer | M |
| U5 | **Strict tenant isolation** — company A can never read company B's anything | M |
| U6 | Project sites (named, geocoded, reusable) | M |
| U7 | Spend-threshold approval workflow | T2 |
| U8 | Credit terms and credit limit, admin-approved | T2 |
| U9 | Passkeys / WebAuthn | T3 |

### 4.6 Payments
| ID | Requirement | Pri |
|---|---|---|
| Y1 | Provider-agnostic interface; mock provider for dev/test | M |
| Y2 | Moyasar reference adapter (mada / Visa / MC / Apple Pay) | M |
| Y3 | **Payment success is only ever established by a verified server-side webhook** | M |
| Y4 | Cryptographic webhook verification + replay protection | M |
| Y5 | Deposit authorize / capture / void modelled separately from the rental charge | M |
| Y6 | Refunds, partial refunds, full audit trail | M |
| Y7 | Corporate credit terms (bypasses PSP) | T2 |
| Y8 | Reconciliation report | T2 |

### 4.7 Operations (Admin)
| ID | Requirement | Pri |
|---|---|---|
| O1 | Equipment + unit CRUD with image/document upload | M |
| O2 | Rate management | M |
| O3 | Booking pipeline management | M |
| O4 | Maintenance scheduling / blackouts | M |
| O5 | Ops dashboard: revenue, utilization, upcoming returns, overdue, failed payments | M |
| O6 | Utilization reporting by unit / class / branch / month | M |
| O7 | Delivery dispatch with status lifecycle | T2 |
| O8 | Digital pre-hire and return inspections with photos | T2 |
| O9 | Customer/company management, credit approval | T2 |
| O10 | CSV export of every operational table | T2 |
| O11 | Review moderation | T2 |
| O12 | Content/article publishing with editable SEO metadata | T2 |

### 4.8 Documents
| ID | Requirement | Pri |
|---|---|---|
| D1 | Rental agreement generated per booking, versioned terms, downloadable | M |
| D2 | VAT invoice with correct structure (labelled non-ZATCA-cleared until integrated) | M |
| D3 | Private object storage; access only via short-lived signed URLs after an authorization check | M |
| D4 | E-signature provider boundary | T3 |
| D5 | ZATCA Phase 2 clearance | T3 (requires business credentials + tax advisor) |

---

## 5. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Performance** | LCP < 2.5s on 4G for equipment pages; JS < 150KB gzipped on public routes; catalog queries < 100ms p95 |
| **SEO** | All public content in server-rendered HTML. Sitemap, robots, canonicals, hreflang (ar/en), JSON-LD (Organization, LocalBusiness, Product, FAQ, Breadcrumb, Article) |
| **i18n** | Arabic + English, full RTL mirroring, localized dates/numbers/currency, `Asia/Riyadh`, SAR. All strings externalised — zero hardcoded UI copy |
| **Accessibility** | WCAG 2.2 AA target: semantic HTML, keyboard operability, visible focus, labelled forms, accessible dialogs and calendar, 4.5:1 contrast |
| **Availability** | Stateless app tier, horizontally scalable; DB is the only stateful component |
| **Backups** | Automated encrypted backups; PITR. RPO ≤ 5 min, RTO ≤ 1 hour (targets — must be tested) |
| **Observability** | Structured JSON logs with request IDs, no PII; error/perf/security monitoring boundaries |
| **Data residency** | Default in-Kingdom hosting to avoid PDPL cross-border transfer complexity |

---

## 6. Security Requirements (summary; full detail in `SECURITY.md`)

Non-negotiable invariants — each has an automated test:

1. A customer cannot read or modify another customer's booking, invoice, or document. (IDOR)
2. A member of company A cannot read company B's data through any route. (tenant isolation)
3. A non-admin cannot reach any admin route or action. (privilege escalation)
4. A price submitted by the browser is never trusted; the server recomputes and rejects mismatches.
5. Two concurrent requests cannot both reserve the same unit for overlapping dates.
6. A booking cannot be marked paid without a cryptographically verified provider event.
7. A webhook cannot be replayed to double-credit a payment.
8. Secrets never appear in the client bundle, in git, or in logs.
9. Every security-relevant action is written to an append-only audit log.

---

## 7. Analytics Requirements

Funnel events, all server-recorded where they matter (client events are advisory):

`page_view` → `equipment_search` → `filter_applied` → `equipment_viewed` → `equipment_compared` → **`availability_checked`** → `booking_started` → `checkout_started` → `payment_initiated` → `payment_completed` → `booking_completed` · plus `quote_requested`, `account_created`, `rental_extended`, `booking_abandoned`.

Dashboards: Traffic → Search → View → **Availability** → Checkout → Payment → Rental, with drop-off at each stage.

---

## 8. MVP Scope — In / Out

### In
Catalog · search · dynamic filters · class + capacity + location pages · comparison · serialized inventory · availability engine with DB-level double-booking prevention · pricing engine · booking flow · payment provider architecture with mock + Moyasar adapter · deposits · customer accounts · company accounts with RBAC · customer dashboard · admin dashboard, inventory, rates, bookings, maintenance, utilization · rental agreement · VAT invoice · AR/EN with RTL · SEO · security fundamentals · automated tests.

### Explicitly out of V1 (with reasons)
| Out | Reason |
|---|---|
| ZATCA Phase 2 clearance | Requires business CSID + tax advisor sign-off. Boundary built, provider stubbed. |
| Live payment processing | Requires a real merchant account. Adapter is real code; inert without credentials. |
| Legally-binding e-signature | Requires a compliant provider contract. Acceptance is recorded; signature boundary reserved. |
| Real SMS/email delivery | Requires provider accounts. Interfaces + console/mock transports built. |
| Telematics / GPS | High cost, no conversion effect. Schema fields reserved. |
| Supplier marketplace | YAGNI for V1. `supplierId` on inventory keeps the door open. |
| Malware scanning of uploads | Requires a scanning service. Interface defined; uploads otherwise hardened. |
| Recommendation wizard | T3. Also carries safety-disclaimer weight (see below). |

---

## 9. Safety Constraint (product-wide)

Equipment selection for lifting is a **safety-critical engineering decision**. The platform must never present an automated suggestion as an engineering determination.

- No copy may imply the system certifies suitability for a lift.
- Any recommendation surface must carry a prominent notice that final suitability must be confirmed by a qualified lifting engineer, and that a lift plan and site survey remain the customer's responsibility.
- Load charts are published as source documents, never as a computed "yes, this crane can do it."

---

## 10. Roadmap After MVP

**T2 (next 2 quarters):** delivery dispatch + driver assignment · digital inspections with photos · approval workflows · credit terms · quotes → booking conversion · reviews tied to completed rentals · notifications across channels · abandoned-booking recovery · content/CMS · CSV exports.

**T3:** recommendation wizard · dynamic pricing · telematics · supplier marketplace · financing · advanced fraud scoring · GCC expansion (UAE/QA/BH/KW/OM).
