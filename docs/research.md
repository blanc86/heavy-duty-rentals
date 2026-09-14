# Research Report — Heavy Equipment Rental Platform for Saudi Arabia

> **Superseded in part (2026-09-14).** This report argued for an online booking
> and payment platform, and that platform was built. It has since been replaced
> by a lead-generation site built around phone, WhatsApp and quote requests; see
> [REDESIGN.md](REDESIGN.md) for why. The market, taxonomy and competitor
> findings below still informed the redesign. The sections on payments,
> e-invoicing and booking architecture describe the previous platform, which is
> preserved at the git tag `booking-platform-final`, along with the documents
> this report refers to (`ARCHITECTURE.md`, `SECURITY.md`, `FINAL_REVIEW.md`).

**Date:** 2026-09-02
**Status:** Desk research. Every regulatory item below **must be verified with qualified Saudi legal, tax and cybersecurity advisors before production launch.** Nothing here is legal advice.

---

## 1. Reference Site Analysis — Tamimi Rentals

Source: <https://www.tamimirentals.com/> (fetched 2026-09-02)

### What the business actually is

Fahad S. Al-Tamimi Group, Eastern Province (Ras Tanura), established 1978. Heavy equipment rental is one division of a diversified group (real estate, contracting). Clients named include Saudi Aramco, SABIC and SEC — this is an industrial/petrochemical-corridor B2B rental operation, not general-contractor tool hire.

### Their equipment taxonomy (a useful category baseline)

| Division | Contents |
|---|---|
| Cranes | Mobile/all-terrain, 6 t – 1200 t (e.g. Terex AC700, Grove GMK7550) |
| Hydraulic trailers | Low-bed / modular hydraulic transport |
| Mobile equipment | Backhoe loaders, boom trucks |
| Stationary equipment | Air compressors, dewatering pumps |

This confirms the category list in the brief is realistic for KSA, plus the forklifts, telehandlers, MEWPs and generators that other competitors carry.

### What they do well

1. **Credible corporate provenance.** 45+ years, named blue-chip clients, group backing. In heavy lifting, "who else trusts you" is the dominant trust signal — a 1200 t crane job is not awarded on price alone.
2. **Explicit safety and quality positioning.** Dedicated Quality Policy and Safety Statement pages. Aramco/SABIC contractors are audited on HSE; publishing policy documents is a real procurement gate, not marketing decoration.
3. **Certifications page.** Another procurement gate — third-party inspection certificates are demanded for lifting gear.
4. **Emergency phone number published** (+966 54 215 0000). For a crane down during a shutdown, this beats any web feature.
5. **Named heavy-capacity assets.** Publishing "AC700" and "GMK7550" by model is genuinely useful — a lift engineer searches by model, not by "big crane".

### What is weak — and therefore our opportunity

| Weakness | Consequence | Our counter |
|---|---|---|
| **No pricing anywhere** | Buyer cannot budget without a phone call. Highest-friction funnel possible. | Transparent day/week/month rates, instant total with VAT. |
| **No availability** | "Do you have a 100 t free on the 14th?" needs a human. | Real availability calendar per physical unit. |
| **No online transaction of any kind** | 100% of demand routed through phone/email. Non-scalable; loses out-of-hours demand. | Full self-service book-and-pay. |
| **English only** | Excludes a large share of Saudi site engineers, foremen and procurement staff who work in Arabic. | Arabic-first bilingual, true RTL. |
| **No specification data** | Cannot compare; cannot verify a crane meets a lift plan (radius vs capacity). | Structured spec attributes, load-chart documents, comparison table. |
| **No inventory granularity** | "Cranes 6–1200 t" is a range, not a fleet. | Model-level catalog + serialized unit-level inventory. |
| **Static `.html` pages, no CMS** | No content engine, so no organic acquisition. | Article/guide engine with editable SEO metadata. |
| **Thin SEO** — no location pages, no class pages, no schema, no sitemap discipline | Loses "crane rental Jubail", "100 ton crane rental Riyadh". | Deliberate equipment × location matrix, limited to real service areas. |
| **No customer account** | Every repeat rental restarts from zero; no history, documents or invoices. | Customer + company portal. |
| **Group-first messaging** | A buyer looking for a crane must dig to find out what is rentable. | Homepage leads with the search/booking widget. |

**Verdict:** Tamimi is a credible operator with a brochure. The gap is not design — it is that *none of the transaction exists online*. That gap is the entire product thesis.

*Used only as market/category reference. No design, copy, imagery, branding or code is copied.*

---

## 2. Saudi & GCC Competitor Landscape

| Company | Position | Digital maturity |
|---|---|---|
| **AMHEC** | 300+ crane fleet; ordered 55 Liebherr mobile cranes Mar 2024 | Corporate site, no transactional layer |
| **ACT Cranes** (Jubail, est. 1986) | Mobile cranes 25–1200 t | Brochure |
| **Nama Jeddah** | 40+ yrs; cranes, forklifts, manlifts, transport | Brochure |
| **HEVEQ** | Riyadh/Jeddah crane rental, SEO-forward | Lead-gen focused (blocks scrapers) |
| **Reliant Rentalz** | Self-describes as an *online* KSA equipment rental platform | Closest thing to a digital competitor |
| **MAK-CON / Mithaq** | Crane + heavy equipment rental | Content marketing — they understand SEO |
| **saudi-equipment.com** | Classifieds marketplace (sale + rent) | Listings, not bookings |

### Read on the market

- **Nobody in KSA has shipped a real book-and-pay flow for heavy equipment.** The market is phone/WhatsApp mediated. Being first with genuine self-service is a durable differentiator, not a cosmetic one.
- **Demand tailwind is real.** NEOM/The Line, Diriyah, Qiddiya, Red Sea and the wider Vision 2030 pipeline drive crane demand; AMHEC's 55-unit Liebherr order is a hard signal. ([source](https://www.globenewswire.com/news-release/2025/08/13/3132753/28124/en/))
- **Competitors already market via content.** MAK-CON and Alhamdaan publish pricing guides that rank. A content engine is table stakes.
- **Geography is concentrated.** Riyadh, Jeddah, Dammam/Khobar, Jubail/Yanbu carry most demand. Location SEO should target *these*, not 200 invented city pages.

---

## 3. International Platforms — What to Adopt

### BigRentz — closest analogue to the target model
Aggregates ~6,000 suppliers across ~14,000 locations. Two ideas worth adopting:
1. **All-in upfront pricing** — hauling, fuel and fees in the displayed price rather than revealed at checkout. Marketed as ~20% savings, but the real win is *removing quote anxiety*.
2. **"Average rental booked in under a minute."** The whole funnel is engineered around one measurable: time-to-booked. That is the right north-star metric.

Note also that their architecture is inherently a **marketplace with a supplier-routing layer** — exactly the boundary the brief asks us to leave open for V2. ([source](https://www.bigrentz.com/marketplace))

### EquipmentShare
- **Online reserve + in-app instant off-rent.** Ending a rental is usually a phone call in this industry; one-tap off-rent is a real operational unlock and cuts billing disputes.
- **T3 telematics** — location/utilization/hours streamed from the machine. We should not build this, but the data model must not preclude it. ([source](https://www.equipmentshare.com/rent))

### United Rentals / Sunbelt / Herc / Boels / Riwal
Patterns worth adopting: category → class → unit taxonomy; per-class spec sheets and load charts as first-class downloads; "rates from" transparency on class pages; credit-account B2B checkout that bypasses card payment entirely.

### Ideas deliberately rejected
- **Auction/bidding on rates** — erodes margin, confuses B2B procurement, no evidence of demand.
- **Consumer urgency theatre** ("3 people viewing this crane!") — destroys credibility with professional buyers.
- **Deep telematics in V1** — large integration cost, no measurable effect on conversion.

---

## 4. Pricing Model Research (KSA)

Used to shape the **pricing engine**, not to set real prices. Seed values are clearly marked demo data.

**Indicative published ranges** (secondary sources, wide variance, order-of-magnitude only):

| Class | Indicative daily |
|---|---|
| Mobile crane 25–50 t | SAR 1,500 – 3,000 |
| Mobile crane 50–100 t | SAR 2,000 – 4,000 |
| Mobile crane 100–300 t | SAR 5,000 – 15,000 |
| Crawler crane 250 t+ | SAR 7,000 – 20,000+ |
| Tower crane | SAR 30,000 – 150,000 / month |

Sources: [Alhamdaan](https://alhamdaanlogistics.com/crane-rental-prices-in-saudi-arabia-cost-comparison-guide-50t-500t/), [MyCrane](https://my-crane.com/mycrane_world/crane-rental-for-saudi-mega-projects-a-complete-guide-to-equipment-planning-and-procurement/)

### Structural findings the engine MUST model

1. **Tiered duration rates.** Weekly/monthly contracts run 10–30% below daily. → duration-tier rate table, not day-rate × days.
2. **Mobilisation / demobilisation is a first-class cost, not "shipping."** SAR 5,000–50,000 for mobile cranes depending on capacity and distance; **20–40% of total project cost for 600 t+ crawlers** (counterweights, boom sections and tracks move as separate loads). → delivery modelled as distance × transport class with a low-bed/escort flag, *not* a flat fee.
3. **"Wet" vs "dry" rental.** Wet = operator + fuel included; dry = bare machine. The single most common source of quote disputes in the industry. → explicit, unmissable `operator` and `fuel` line items plus an inclusion badge on the equipment page.
4. **Minimum shift length.** Rates are commonly quoted per 8–10 hour shift with overtime beyond. → `minRentalDays`; hours-based overtime noted as future work.
5. **Crew beyond the operator.** Riggers/banksmen/signalmen are often separately chargeable. → a generic priced add-on service model, not a hardcoded "operator" boolean.

**Product consequence:** because mobilisation dominates cost for the largest classes and depends on route surveys and permits, **instant online pricing is only honest below a capacity threshold.** Above it, the correct product is a fast structured quote — not a fake instant price. This is the hybrid instant-book / quote split in the PRD.

---

## 5. Payments in Saudi Arabia

Taking card payments from Saudi customers with a Saudi CR requires a **SAMA-licensed PSP**.

| PSP | Notes |
|---|---|
| **Moyasar** | Saudi-built, SAMA licensed. Full mada + Apple Pay + STC Pay. Fast (T+1) mada settlement. Simple API. Setup SAR 0–1,500. |
| **HyperPay** | Enterprise depth, strongest operational tooling. Setup ~SAR 1,500. |
| **Tap Payments** | Best APIs, easiest GCC-wide expansion. Free setup. |
| **PayTabs** | One merchant account across the region. |

Sources: [gateway comparison](https://logiolegion.com/blogs/tap-payments-vs-hyperpay-vs-moyasar-saudi-arabia-2026), [developer guide](https://logiolegion.com/blogs/payment-gateway-integration-saudi-arabia-developer-guide)

### Method coverage that matters in KSA
**mada is non-negotiable** — the national debit scheme and the default card in most Saudi wallets. A checkout that only takes Visa/Mastercard will bleed conversion. Then Apple Pay (very high iOS penetration), then STC Pay. BNPL (Tabby/Tamara) is significant in retail but **wrong for B2B equipment rental with deposits**.

### Architectural decision
A **provider-agnostic `PaymentProvider` interface** with:
- `MockProvider` for development and tests (deterministic, no network), and
- `MoyasarProvider` as the reference real implementation — the recommended default for a Saudi-only V1: local, mada-first, cheapest to onboard.

Switching to HyperPay/Tap later is a new adapter, not a rewrite. **No PSP credentials are included; the integration is real code behind documented environment variables and is inert until configured.**

### Deposits — an important constraint
Deposits are best handled as a **card authorization (hold)** captured or released later, not charge-and-refund. Hold support and duration vary by PSP and by scheme (mada hold semantics differ from Visa/MC). **Confirm with the chosen PSP before launch.** The data model separates `authorize` / `capture` / `void` / `refund` so either mechanism can back it.

### Corporate credit
Large B2B customers will not pay a SAR 400,000 monthly crane rental by card. **Credit terms (invoice, net-30, PO-backed) is the primary enterprise payment path**, modelled as a first-class payment method that bypasses the PSP entirely, gated by an admin-approved credit limit.

---

## 6. Tax & Invoicing — ZATCA

- **VAT is 15%.** Registration required above SAR 375,000 annual turnover.
- **E-invoicing (Fatoora) is mandatory.** Phase 1 (generation) in force. **Phase 2 (Integration)** requires direct connection to the ZATCA Fatoora platform:
  - **UBL 2.1 XML**, Arabic content, PDF/A-3 with embedded XML
  - UUID, sequential counter, **previous-invoice hash (chained)**
  - **Cryptographic stamp** (ECDSA) and digital signature via CSID onboarding
  - **QR code** carrying seller name, VAT number, timestamp, total, VAT total, stamp, public key, signature
  - **Clearance model for B2B standard invoices** (cleared by ZATCA *before* issuing to the buyer)
  - **Reporting model for B2C simplified invoices** (within 24 hours)
  - Rollout by turnover waves; **Wave 24 (turnover > SAR 375,000) integrates by 30 June 2026**

Sources: [ClearTax KSA](https://www.cleartax.com/sa/ksa-einvoicing), [Phase 2 guide](https://qeemahcloud.com/en/blog/complete-zatca-phase-2-einvoicing-requirements-guide/)

### Decision
**We do not fake ZATCA compliance.** Clearance requires a real CSID, a real cryptographic stamp identity and ZATCA sandbox certification — none obtainable without the business's credentials and a tax advisor's sign-off.

What we build:
- A correct, complete **invoice domain model** — immutable numbering via a DB sequence counter, seller/buyer VAT identity, line items, 15% VAT computed server-side in integer halalas, `previousInvoiceHash` column reserved for the Phase-2 chain.
- A **`TaxInvoiceProvider` boundary** with a `LocalInvoiceProvider` (human-readable invoice) and a documented `ZatcaProvider` stub that throws unless configured.
- Invoices explicitly labelled **"Not ZATCA-cleared — demo"** until a real provider is wired.

Flagged in `FINAL_REVIEW.md` as requiring professional tax-advisor engagement.

---

## 7. E-Commerce Law & Consumer Protection

- Selling online in KSA requires **registration on Maroof** (Ministry of Commerce) and publication of trade name, working contact and CR number.
- **Total price including VAT and delivery must be displayed — no surprise fees at checkout.** A legal requirement that happens to be identical to our conversion strategy.
- **Return/refund and delivery terms must be published and shown before the order completes.**
- Consumer return-window rules exist for goods; **their application to equipment *rental services* is materially different and must be confirmed by counsel.** We therefore implement a configurable, business-authored **cancellation policy engine** (tiered refund by notice period) rather than asserting a statutory window.

Sources: [Origami](https://origami.sa/en/blog/saudi-ecommerce-law-2026-maroof-compliance/), [Watily](https://watily.com/blog/en/saudi-maroof-online-store-registration-2026/)

---

## 8. Privacy — PDPL

The Saudi **Personal Data Protection Law** (Royal Decree M/19, 2021; amended 2023) came into full force **14 September 2023**; the grace period ended **14 September 2024**. SDAIA is the active regulator and **is enforcing** — 48 violation decisions across 2025–2026.

Violations actually being penalised (these map directly onto our controls):
- processing without a valid legal basis
- unauthorised disclosure of personal data
- failure to implement technical/organisational safeguards
- **marketing communications without consent**

Implementing Regulations cover lawful bases, consent standards, **retention limits**, **breach notification** and **cross-border transfer restrictions** (separate Transfer Regulations).

Sources: [DLA Piper](https://www.dlapiperdataprotection.com/?c=SA), [Clyde & Co](https://www.clydeco.com/en/insights/2023/09/saudi-arabia-issues-implementing-regulations)

### Product consequences (built, not merely documented)
1. **Data minimisation by default.** No national ID / Iqama collected at booking. That is an *operational handover* requirement verified at machine release, not a checkout field.
2. **Explicit, separate, unbundled marketing consent** with stored timestamp, source and IP — never pre-ticked, never bundled into terms acceptance. Abandoned-cart email is gated on it.
3. **Retention is data, not folklore** — a documented retention table and a deletion job boundary.
4. **Cross-border transfer:** default deployment target is **in-Kingdom hosting**, sidestepping transfer restrictions entirely.
5. Breach-notification runbook in `SECURITY.md`.

---

## 9. Cybersecurity — NCA

The **NCA Essential Cybersecurity Controls (ECC-1:2018, updated ECC-2:2024)** define 114 controls across 5 domains (Governance, Defence, Resilience, Third-Party/Cloud, ICS), built on Strategy / People / Process / Technology and aligned to ISO 27001 and NIST CSF.

**Applicability:** ECC is mandatory for government bodies and for private-sector organisations that own, operate or host **Critical National Infrastructure**. A commercial equipment-rental company is **not automatically in scope** — but its customers (Aramco, SABIC, SEC) are, and **they push these requirements down through vendor security assessments.** Treating ECC as the target is a commercial decision as much as a regulatory one.

Also relevant: **CGESP-1:2019**, NCA Cybersecurity Guidelines for E-commerce Service Providers.

Sources: [NCA ECC](https://nca.gov.sa/en/regulatory-documents/controls-list/ecc/), [ECC PDF](https://nca.gov.sa/ecc-en.pdf)

Implemented controls are mapped to ECC domains in `SECURITY.md`. **We explicitly do not claim compliance** — compliance is an audited state, not a property of code.

---

## 10. UX & Conversion Findings

### The core insight
A construction buyer's real question is **not** "show me your fleet." It is:

> *Can you put a machine that can do **this lift**, at **this site**, on **this date**, for **this budget** — and can I stop worrying about it?*

Every screen is judged against that sentence.

### Findings that shaped the design

1. **Availability is the conversion event, not price.** "Is it free on the 14th?" gates everything. Availability must be visible *before* login and *before* any form.
2. **Buyers search by capability, not SKU.** "100 ton crane" is a capability. Capacity must be a first-class filterable, indexable attribute that anchors URLs.
3. **The inclusion question kills deals.** Wet vs dry, mobilisation, fuel, permits. Ambiguity here is the #1 abandonment cause. → a persistent, explicit **"What's included / not included"** block on every equipment page and in every price breakdown.
4. **Mobile is the site engineer's device.** Bookings start from a site, in the sun, one-handed. → sticky price/CTA bar, large targets, thumb-friendly calendar.
5. **Arabic is not a translation layer**; it is the primary language for a large share of users. Numerals, dates, currency position and full RTL mirroring must be right or the site reads as foreign and untrustworthy.
6. **Procurement needs artefacts, not a chat.** PO number, cost centre, project code, VAT invoice, signed agreement. Without those the deal moves offline no matter how good the funnel is.
7. **Never force login before value.** Search, filter, availability and the full price breakdown must all work anonymously. Account creation happens at checkout, where it is justified.

### SEO opportunity (concrete)
Competitors rank with thin listicles. A structured, genuinely useful matrix wins:
- **Class pages:** `/equipment/mobile-cranes`, plus capacity cuts (`50-ton`, `100-ton`, `200-ton`)
- **Location pages:** only for **real** service branches — Riyadh, Jeddah, Dammam, Khobar, Jubail
- **Class × location** only where the branch genuinely stocks that class (guarded in code — the page 404s otherwise, which is what stops this becoming doorway-page spam)
- **Guides** answering real queries: *what size crane do I need*, *mobile vs crawler*, *what's included in crane rental*, *how far ahead to book*
- **Bilingual with correct `hreflang`** — Arabic queries are under-served by every competitor.

---

## 11. Recommended Architecture (summary; detail in `ARCHITECTURE.md`)

**Modular monolith. Next.js 16 App Router + TypeScript + PostgreSQL + Drizzle.** Not microservices.

| Decision | Why |
|---|---|
| **Next.js 16 App Router, server-rendered** | SEO is a primary objective; equipment and location pages must be fully in HTML. Server Components keep the client bundle small on 4G. One deployable, one language. |
| **PostgreSQL** | The core correctness requirement — *never double-book a physical machine* — is solved natively by `tstzrange` + a **GiST exclusion constraint**. That is a storage-engine guarantee application code cannot provide under concurrency. That single capability justifies Postgres over anything else. |
| **Drizzle ORM** | We need raw DDL (range types, exclusion constraints, partial indexes, `SELECT … FOR UPDATE`) that heavier ORMs abstract away or cannot express. Near-zero runtime overhead, full SQL transparency. |
| **Custom session auth** | Lucia is deprecated; hosted auth vendors create a cross-border personal-data transfer problem under PDPL. Argon2id + opaque server-side sessions + TOTP is a small, auditable surface. |
| **Provider adapters** (payments / SMS / email / storage / tax) | Every external integration needs credentials the business owns. Clean interface + mock + one reference implementation = honest, testable, swappable. |
| **Postgres full-text search first** | Meilisearch/OpenSearch is premature at fleet scale (hundreds of units, not millions of SKUs). Revisit at real scale. |
| **Single-tenant now, supplier boundary reserved** | Every inventory row carries a `supplierId` from day one, defaulted to the house supplier. Marketplace V2 becomes a permissions change, not a migration. |

Source for the exclusion-constraint approach: [PostgreSQL Range Types](https://www.postgresql.org/docs/current/rangetypes.html)

---

## 12. Open Questions Requiring the Business / Professionals

| # | Question | Owner |
|---|---|---|
| 1 | Which PSP contract? Does it support authorization holds on **mada** for deposits, and for how long? | Business + PSP |
| 2 | ZATCA Phase 2 CSID onboarding and clearance certification | Tax advisor |
| 3 | Do consumer online-return rules apply to equipment rental services? | Legal counsel |
| 4 | PDPL registration obligation and DPO appointment | Legal / SDAIA |
| 5 | Is the company in ECC scope via CNI customer contracts? | Security consultant |
| 6 | Real fleet, real serial numbers, real rates, real branch addresses | Business |
| 7 | Insurance/liability terms; who carries risk for operator-caused damage | Legal + insurer |
| 8 | Capacity threshold above which instant booking is disabled in favour of quote | Operations |
| 9 | Arabic copy — professional translation, not machine output | Business |

---

## 13. Sources

- <https://www.tamimirentals.com/>
- <https://www.bigrentz.com/marketplace> · <https://www.equipmentshare.com/rent>
- <https://mak-con.com/blogs/top-10-crane-rental-companies-in-saudi-arabia>
- <https://alhamdaanlogistics.com/crane-rental-prices-in-saudi-arabia-cost-comparison-guide-50t-500t/>
- <https://my-crane.com/mycrane_world/crane-rental-for-saudi-mega-projects-a-complete-guide-to-equipment-planning-and-procurement/>
- <https://www.globenewswire.com/news-release/2025/08/13/3132753/28124/en/>
- <https://logiolegion.com/blogs/tap-payments-vs-hyperpay-vs-moyasar-saudi-arabia-2026>
- <https://logiolegion.com/blogs/payment-gateway-integration-saudi-arabia-developer-guide>
- <https://www.cleartax.com/sa/ksa-einvoicing> · <https://qeemahcloud.com/en/blog/complete-zatca-phase-2-einvoicing-requirements-guide/>
- <https://origami.sa/en/blog/saudi-ecommerce-law-2026-maroof-compliance/> · <https://watily.com/blog/en/saudi-maroof-online-store-registration-2026/>
- <https://www.dlapiperdataprotection.com/?c=SA> · <https://www.clydeco.com/en/insights/2023/09/saudi-arabia-issues-implementing-regulations>
- <https://nca.gov.sa/en/regulatory-documents/controls-list/ecc/> · <https://nca.gov.sa/ecc-en.pdf>
- <https://www.postgresql.org/docs/current/rangetypes.html>
