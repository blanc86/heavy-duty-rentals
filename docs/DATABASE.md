# Database Design

**PostgreSQL 17** · Drizzle ORM · all money as `bigint` halalas · all timestamps `timestamptz` (UTC stored, `Asia/Riyadh` presented)

---

## 1. Conventions

| Rule | Reason |
|---|---|
| Primary keys are UUID v7 (`uuid` column) | Non-enumerable in URLs; time-ordered so index locality is preserved |
| Money is `bigint` halalas, never numeric/float | Exact arithmetic; VAT and invoices must be exact |
| Time is `timestamptz` | Riyadh is UTC+3 with no DST, but storing UTC keeps GCC expansion trivial |
| Enums are Postgres `ENUM` types | Invalid states are rejected by the database, not by hope |
| Every FK is declared with an explicit `ON DELETE` | Orphan rows in a booking system become billing disputes |
| Soft-delete only where audit requires it | Otherwise hard delete; PDPL data minimisation |
| `createdAt` / `updatedAt` on every mutable table | Auditability |

---

## 2. Entity map

```
                    company ──< company_member >── user ──< session
                       │                            │
                       ├──< project_site            ├──< mfa_credential
                       └──< company_credit          └──< audit_log

  equipment_category ──< equipment_class ──< equipment_unit >── branch
                              │    │              │   │
                              │    │              │   └──< unit_blackout
                              │    ├──< class_spec│
                              │    ├──< class_image
                              │    ├──< class_document
                              │    └──< rate_card ──< rate_tier
                              │
                              └──< addon_option

   booking ──< booking_item >── equipment_unit
      │            └──< reservation  (EXCLUDE gist: no overlap)
      ├──< booking_addon
      ├──< booking_event          (append-only state history)
      ├──< payment ──< refund
      ├──< invoice ──< invoice_line
      ├──< rental_agreement
      ├──< delivery
      ├──< inspection
      └──< review

   quote ──< quote_item          coupon        article
   notification                  audit_log     analytics_event
```

---

## 3. Core tables

### 3.1 Identity

**`user`** — `id`, `email` (citext unique), `emailVerifiedAt`, `phone`, `phoneVerifiedAt`, `passwordHash` (argon2id), `fullName`, `preferredLocale`, `isPlatformAdmin`, `status`, `failedLoginCount`, `lockedUntil`, `marketingConsentAt`, `marketingConsentSource`, timestamps.

> `passwordHash` is argon2id with per-user salt. `isPlatformAdmin` is a separate axis from company roles — a company owner is not a platform admin and must never be able to become one through company-scoped routes.

**`session`** — `id`, `userId`, `tokenHash` (SHA-256 of the opaque token; **the raw token is never stored**), `expiresAt`, `absoluteExpiresAt`, `ipAddress`, `userAgent`, `mfaSatisfiedAt`, `revokedAt`.

> Storing only the hash means a database read does not yield usable session tokens. Both a sliding (`expiresAt`) and an absolute (`absoluteExpiresAt`) lifetime are enforced so an active attacker cannot extend a stolen session indefinitely.

**`mfa_credential`** — `id`, `userId`, `type` (`totp`), `secretEncrypted`, `confirmedAt`, `lastUsedCounter`, `recoveryCodeHashes[]`.

> `lastUsedCounter` prevents replay of an intercepted TOTP code within its 30-second window.

**`password_reset_token`**, **`email_verification_token`** — hashed tokens, single-use, short TTL, `usedAt`.

### 3.2 Companies and RBAC

**`company`** — `id`, `nameEn`, `nameAr`, `vatNumber`, `commercialRegistrationNumber`, `billingAddress`, `status`, `creditLimitHalalas`, `creditTermsDays`, `approvalThresholdHalalas`.

**`company_member`** — `id`, `companyId`, `userId`, `role` (enum: `owner|admin|procurement|finance|project_manager|viewer`), `status`, `invitedBy`, `joinedAt`.
- **Unique `(companyId, userId)`.**

> This table *is* the tenancy boundary. Every company-scoped query joins through it. A user with no row here for company X can reach nothing belonging to company X, at any layer.

**`project_site`** — `id`, `companyId`, `name`, `city`, `addressLine`, `latitude`, `longitude`, `contactName`, `contactPhone`, `accessNotes`, `isActive`.

### 3.3 Catalog

**`equipment_category`** — `id`, `slug`, `nameEn`, `nameAr`, `descriptionEn/Ar`, `filterSchema` (jsonb), `sortOrder`, `isActive`.

> `filterSchema` drives category-aware filters (cranes get capacity/boom/reach; forklifts get capacity/fuel/mast). Adding a filter is data, not a deploy.

**`equipment_class`** — the rentable *model*: `id`, `categoryId`, `slug`, `nameEn/Ar`, `manufacturer`, `model`, `descriptionEn/Ar`, `specs` (jsonb, validated against the category schema), `capacityKg`, `minRentalDays`, `mobilisationBufferDays`, `demobilisationBufferDays`, `depositHalalas`, `requiresOperator`, `operatorIncluded`, `fuelPolicy` (`wet|dry`), `transportClass`, `requiresLowBed`, `requiresEscort`, `instantBookable`, `searchVectorEn`, `searchVectorAr`, `isActive`.

> `capacityKg` is promoted out of `specs` into a real indexed column because it is the single most-filtered and most-searched attribute ("100 ton crane"), and jsonb range filtering on it would not use an index efficiently.
> `instantBookable = false` routes the class to the quote flow — the honest handling of classes whose mobilisation cannot be priced without a route survey.

**`class_spec`** — ordered, localised spec rows for display (`labelEn/Ar`, `valueEn/Ar`, `unit`, `group`, `sortOrder`). Kept separate from `specs` jsonb: jsonb is for filtering, this is for presentation.

**`class_image`**, **`class_document`** — `storageKey`, `kind` (`load_chart|manual|certificate|insurance|registration`), `visibility` (`public|customer|internal`).

> `visibility` is enforced server-side on every document read. A load chart is public (it sells the machine); an insurance certificate is not.

**`branch`** — `id`, `slug`, `nameEn/Ar`, `city`, `region`, `addressEn/Ar`, `latitude`, `longitude`, `phone`, `email`, `workingHours` (jsonb), `isServiceArea`, `isActive`.

> `isServiceArea` gates location SEO pages. A location page cannot exist for a city where the business has no branch — this is the code-level guard that prevents the doorway-page spam the brief prohibits.

### 3.4 Inventory

**`equipment_unit`** — the *physical machine*: `id`, `classId`, `branchId`, `supplierId`, `assetCode` (unique, e.g. `CRN-00127`), `serialNumber`, `yearOfManufacture`, `engineHours`, `status` (enum: `available|reserved|rented|in_transit|maintenance|inspection|out_of_service`), `lastInspectionAt`, `nextInspectionDueAt`, `acquisitionDate`, `notes`, `isActive`.

> **This is the distinction the brief insists on.** `equipment_class` = "Liebherr LTM 1100". `equipment_unit` = "CRN-00127, serial 12345, in Dammam". Availability, maintenance, inspections and utilization are all properties of the *unit*. Modelling inventory only as "a 100 ton crane" makes the availability engine impossible.

> `supplierId` defaults to the house supplier and is the reserved marketplace boundary.

**`unit_blackout`** — `id`, `unitId`, `period` (`tstzrange`), `reason` (`maintenance|inspection|transport|out_of_service|other`), `notes`, `createdBy`.
- `EXCLUDE USING gist (unitId WITH =, period WITH &&)` — a unit cannot be double-blacked-out.
- Unioned into every availability query, so scheduling maintenance instantly removes the unit from sale.

**`maintenance_record`** — `id`, `unitId`, `blackoutId`, `type`, `description`, `costHalalas`, `performedBy`, `startedAt`, `completedAt`, `hoursAtService`, `nextDueAt`.

### 3.5 Pricing

**`rate_card`** — `id`, `classId`, `branchId` (nullable = applies to all branches), `currency`, `validFrom`, `validTo`, `isActive`.

**`rate_tier`** — `id`, `rateCardId`, `tier` (`daily|weekly|monthly`), `minDays`, `rateHalalas`.

> The engine evaluates every applicable tier and selects the one producing the **lowest total for the customer**. A 25-day rental should be billed at the monthly rate if that is cheaper — doing otherwise is the kind of quiet overcharge that destroys B2B trust.

**`addon_option`** — `id`, `classId` (nullable = global), `code` (`operator|fuel|rigger|slings|…`), `nameEn/Ar`, `pricingModel` (`per_day|flat|per_unit_per_day`), `rateHalalas`, `isTaxable`, `maxQuantity`, `isActive`.

**`transport_rate`** — `id`, `branchId`, `transportClass`, `distanceBandKmFrom/To`, `mobilisationHalalas`, `demobilisationHalalas`, `lowBedSurchargeHalalas`, `escortSurchargeHalalas`.

**`coupon`** — `id`, `code` (unique, citext), `discountType` (`percent|fixed`), `value`, `minSubtotalHalalas`, `maxDiscountHalalas`, `validFrom`, `validTo`, `maxRedemptions`, `redemptionCount`, `perCustomerLimit`, `appliesToCategoryIds[]`, `isActive`.
- `CHECK (redemptionCount <= maxRedemptions)` — over-redemption is rejected by the database even under concurrency.

**`tax_rate`** — `id`, `code`, `ratePpm` (parts per million; 15% = `150000`), `validFrom`, `validTo`.

> VAT is data with a validity window, not a constant in code. When a rate changes, historical invoices must keep recomputing at the rate that applied on their issue date.

### 3.6 Booking

**`booking`** — `id`, `reference` (unique, `RNT-XXXXXX`), `status` (enum: `draft|pending_payment|confirmed|active|completed|cancelled|expired`), `customerUserId`, `companyId` (nullable — individual bookings have none), `projectSiteId`, `locale`, `startDate`, `endDate`, `billableDays`, `deliveryRequired`, `deliveryWindow`, `siteContactName/Phone`, `siteAccessNotes`, `poNumber`, `costCentre`, `projectCode`, price columns (`rentalSubtotalHalalas`, `addonsSubtotalHalalas`, `transportSubtotalHalalas`, `discountHalalas`, `taxableSubtotalHalalas`, `vatHalalas`, `depositHalalas`, `totalHalalas`), `pricingSnapshot` (jsonb), `termsVersion`, `termsAcceptedAt`, `termsAcceptedIp`, `idempotencyKey` (unique), `couponId`, `supplierId`, `cancelledAt`, `cancellationReason`, `refundHalalas`.

> **`pricingSnapshot` is essential.** It stores the full computed breakdown — every rate, rule and input used at booking time. Rates change; a booking's price must never drift after the customer agreed to it, and a billing dispute two months later must be answerable from the record rather than by re-deriving from today's rate card.

> **`idempotencyKey` is `UNIQUE`.** A double-clicked submit or a retried request returns the existing booking instead of creating a second reservation on the same crane.

**`booking_item`** — `id`, `bookingId`, `classId`, `unitId`, `quantity`, `unitRateHalalas`, `tier`, `lineTotalHalalas`.

**`reservation`** — the occupancy record and **the concurrency arbiter**:
`id`, `unitId`, `bookingId` (nullable for pure holds), `status` (`held|confirmed|active|released|expired|cancelled`), `period` (`tstzrange` — the *occupied* window incl. buffers), `billableStart`, `billableEnd`, `expiresAt`, `heldBySessionId`.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE reservation ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (unit_id WITH =, period WITH &&)
  WHERE (status IN ('held','confirmed','active'));
```

**This one constraint is the load-bearing element of the entire system.** See §5.

**`booking_addon`** — `id`, `bookingId`, `addonOptionId`, `code`, `quantity`, `unitRateHalalas`, `pricingModel`, `lineTotalHalalas`, `isTaxable`.

**`booking_event`** — append-only lifecycle log: `id`, `bookingId`, `type`, `fromStatus`, `toStatus`, `actorUserId`, `actorType` (`customer|admin|system|webhook`), `metadata` (jsonb), `createdAt`. **No UPDATE or DELETE path exists in the application.**

**`checkout_hold`** — anonymous/abandoned checkout state: `id`, `sessionToken`, `classId`, `unitId`, `configuration` (jsonb), `contactEmail`, `contactPhone`, `expiresAt`, `recoveryEmailSentAt`, `consentedToRecovery`.

> `consentedToRecovery` gates abandoned-cart email. Under PDPL, sending marketing without consent is one of the violations SDAIA is actively penalising, so the gate is a column the send path must read — not a policy someone is supposed to remember.

### 3.7 Payments and invoicing

**`payment`** — `id`, `bookingId`, `kind` (`rental_charge|deposit_authorization|extension_charge|damage_charge`), `provider`, `providerIntentId`, `providerChargeId`, `status` (`created|requires_action|authorized|captured|failed|voided|refunded|partially_refunded`), `amountHalalas`, `capturedHalalas`, `currency`, `method` (`mada|visa|mastercard|apple_pay|stc_pay|credit_terms|bank_transfer`), `last4`, `failureCode`, `idempotencyKey` (unique), `authorizedAt`, `capturedAt`, `voidedAt`.

> **No card data is stored.** `last4` and `method` are display metadata returned by the PSP. There is no column that could hold a PAN, a CVV or a token secret — the schema itself makes storing them impossible.

**`payment_webhook_event`** — `id`, `provider`, `providerEventId` (**unique**), `eventType`, `signatureVerified`, `payloadHash`, `processedAt`, `processingResult`.

> The unique index on `providerEventId` is the replay defence: a replayed webhook violates the constraint and is discarded rather than double-crediting a payment.

**`refund`** — `id`, `paymentId`, `amountHalalas`, `reason`, `providerRefundId`, `status`, `requestedBy`, `approvedBy`, `createdAt`.

**`invoice`** — `id`, `bookingId`, `invoiceNumber` (**unique**, from a DB sequence), `type` (`tax_invoice|simplified|credit_note`), `status` (`draft|issued|paid|void`), seller identity snapshot, buyer identity snapshot, `subtotalHalalas`, `vatHalalas`, `totalHalalas`, `vatRatePpm`, `issuedAt`, `dueAt`, `paidAt`, `previousInvoiceHash`, `zatcaUuid`, `zatcaClearanceStatus`, `zatcaQrPayload`, `pdfStorageKey`.

> Seller and buyer identity are **snapshotted onto the invoice**, not joined. A company changing its billing address must not retroactively alter an issued tax invoice.
> `previousInvoiceHash`, `zatcaUuid`, `zatcaQrPayload` are reserved for ZATCA Phase 2 and are `NULL` until a real provider is configured. Invoices render a visible "not ZATCA-cleared" notice while they are null.

**`invoice_line`** — `id`, `invoiceId`, `descriptionEn/Ar`, `quantity`, `unitPriceHalalas`, `lineSubtotalHalalas`, `vatRatePpm`, `vatHalalas`, `lineTotalHalalas`, `sortOrder`.

**`rental_agreement`** — `id`, `bookingId`, `termsVersion`, `contentHash`, `storageKey`, `acceptedAt`, `acceptedByUserId`, `acceptedIp`, `acceptedUserAgent`, `signatureProvider`, `signatureReference`.

### 3.8 Operations

**`delivery`** — `id`, `bookingId`, `direction` (`outbound|return`), `status` (`scheduled|assigned|loading|in_transit|arrived|delivered|failed|returned`), `scheduledWindowStart/End`, `driverId`, `vehicleReference`, `requiresLowBed`, `requiresEscort`, `actualDepartedAt`, `actualArrivedAt`, `failureReason`, `proofStorageKey`, `gpsLastLat/Lng` *(reserved for telematics)*.

**`inspection`** — `id`, `bookingId`, `unitId`, `phase` (`pre_hire|on_return`), `inspectorUserId`, `engineHours`, `fuelLevelPercent`, `conditionRating`, `damageFound`, `damageNotes`, `missingAccessories`, `checklist` (jsonb), `photoKeys[]`, `result` (`pass|pass_with_notes|fail`), `completedAt`.

**`review`** — `id`, `bookingId` (**unique** — one review per completed rental), `userId`, `classId`, `rating` (1–5, CHECK), `title`, `body`, `status` (`pending|published|rejected`), `moderatedBy`, `publishedAt`.

> The unique FK to a *completed* `booking` is what makes reviews verifiable. There is no route to create a review without a completed rental, so fabricated reviews are structurally excluded.

**`quote`** / **`quote_item`** — for non-instant-bookable classes: `status` (`requested|in_review|priced|sent|accepted|rejected|expired`), requirement fields, `pricedTotalHalalas`, `validUntil`, `convertedBookingId`.

### 3.9 Platform

**`audit_log`** — `id`, `occurredAt`, `actorUserId`, `actorType`, `actorIp`, `actorUserAgent`, `action`, `resourceType`, `resourceId`, `companyId`, `outcome` (`success|failure|denied`), `metadata` (jsonb), `previousHash`, `entryHash`.

> **Append-only and hash-chained.** Each entry hashes `(previousHash || canonical(entry))`. Tampering with or deleting a historical row breaks the chain and is detectable by a verification job. The application exposes only an insert path; `UPDATE`/`DELETE` are revoked from the application database role.
> `metadata` must never carry passwords, tokens, card data or unnecessary PII — enforced by a redaction allowlist in the audit writer.

**`notification`** — `id`, `userId`, `channel`, `templateKey`, `locale`, `payload` (jsonb), `status`, `sentAt`, `readAt`, `providerMessageId`, `failureReason`.

**`analytics_event`** — `id`, `sessionId`, `userId` (nullable), `type`, `properties` (jsonb), `occurredAt`. Server-recorded for funnel-critical events.

**`article`** — CMS: `id`, `slug`, `locale`, `title`, `excerpt`, `bodyMarkdown`, `heroImageKey`, `metaTitle`, `metaDescription`, `ogImageKey`, `status`, `publishedAt`, `authorId`, `relatedClassIds[]`, `relatedBranchIds[]`.

**`setting`** — `key`, `valueJson`, `isSecret`, `updatedBy`. Business configuration (company name, VAT number, contact details, cancellation policy tiers, deposit rules) lives here, not in code.

---

## 4. Indexes

Chosen from actual query patterns, not speculatively:

| Index | Serves |
|---|---|
| `reservation` GiST `(unitId, period)` (partial, active statuses) | The exclusion constraint *and* every overlap query |
| `unit_blackout` GiST `(unitId, period)` | Blackout overlap |
| `equipment_unit (classId, branchId, status)` | "Which units of this class in this city are bookable?" |
| `equipment_class (categoryId, isActive)`, `(capacityKg)` | Category browse; capacity filters and capacity landing pages |
| GIN on `searchVectorEn`, `searchVectorAr` | Full-text search per locale |
| GIN on `equipment_class.specs` (jsonb_path_ops) | Attribute filters |
| `booking (customerUserId, createdAt DESC)`, `(companyId, createdAt DESC)` | Customer and company rental lists |
| `booking (status, startDate)` | Ops dashboard: upcoming, overdue, returns due |
| `session (tokenHash)` unique | Session lookup on every request — must be O(1) |
| `company_member (companyId, userId)` unique | The tenancy check on every scoped query |
| `payment_webhook_event (providerEventId)` unique | Replay prevention |
| `booking (idempotencyKey)` unique | Double-submit prevention |
| `audit_log (occurredAt DESC)`, `(actorUserId, occurredAt DESC)`, `(resourceType, resourceId)` | Investigation queries |

---

## 5. Concurrency model — how double-booking is actually prevented

### The race
```
T1: check unit U free for [Mar 14, Mar 28)  → yes
T2: check unit U free for [Mar 20, Apr 02)  → yes   (T1 has not committed)
T1: INSERT reservation                       → ok
T2: INSERT reservation                       → ??? 
```
Under `READ COMMITTED`, both checks legitimately return "free". No amount of application care fixes this; the check and the write are not atomic with respect to the other transaction.

### The fix
The exclusion constraint evaluates at **insert time, inside the index**, against uncommitted-but-in-progress rows. T2's insert blocks until T1 commits, then fails with SQLSTATE **`23P01`**. The application catches exactly that code:

```ts
try {
  await tx.insert(reservation).values({ unitId, period, status: 'held' });
} catch (e) {
  if (isExclusionViolation(e)) throw new UnitNoLongerAvailableError();
  throw e;
}
```

**The application does not try to win the race. It lets the database arbitrate and handles losing gracefully.** That is the only approach that is correct across multiple app instances, retries, and arbitrary interleaving.

### Buffers
`period` covers `[startDate − mobilisationBuffer, endDate + demobilisationBuffer)`, while `billableStart`/`billableEnd` cover what the customer pays for. A crane needs a day to travel and rig; making the occupied window wider than the billed window is what stops operations from being handed physically impossible schedules.

### Holds
Checkout inserts a `held` reservation with `expiresAt`. It participates in the constraint, so it genuinely blocks. Reads additionally filter `expiresAt > now()`, meaning a delayed sweeper cannot cause a stale hold to block a real booking — correctness does not depend on the job running on time.

---

## 6. Security model at the data layer

| Control | Implementation |
|---|---|
| **Tenant isolation** | Every company-scoped repository function requires `companyId` from the session. No unscoped variant is exported. |
| **Ownership** | Customer reads are filtered by `customerUserId` OR a verified `company_member` row — never by a client-supplied id. |
| **Least privilege** | The application role has no `DROP`, no `ALTER`, and no `UPDATE`/`DELETE` on `audit_log` or `booking_event`. Migrations run as a separate, higher-privileged role. |
| **Encryption in transit** | TLS-only connections (`sslmode=require` in production). |
| **Encryption at rest** | Managed-instance volume encryption plus application-level encryption for `mfa_credential.secretEncrypted`. |
| **No card data** | The schema has no column capable of holding a PAN, CVV or raw token. |
| **Constraint-enforced invariants** | Non-overlap, coupon redemption caps, rating range, unique invoice numbers, unique idempotency keys, unique webhook event ids. Business rules that matter are database constraints, not comments. |

---

## 7. Retention (PDPL data minimisation)

| Data | Retention | Rationale |
|---|---|---|
| Bookings, invoices, agreements | 10 years | Commercial/tax record-keeping — *confirm exact statutory period with a tax advisor* |
| Audit logs | 2 years minimum | Security investigation |
| Sessions | Deleted at expiry + 30 days | No operational need |
| Abandoned checkouts | 90 days | Recovery window, then purge |
| Analytics events | 24 months, then aggregate | Trend analysis does not need row-level PII |
| Marketing consent records | Life of account + 3 years | Must be able to evidence consent |
| Inspection photos | Life of booking + 3 years | Damage-dispute window |

A `retention.ts` job boundary implements the purge. **The exact periods are business/legal decisions and are configured, not hardcoded.**
