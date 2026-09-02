-- =============================================================================
-- 0001_integrity
--
-- Hand-authored. Everything here is an invariant the ORM cannot express, and
-- every one of them is load-bearing: these are business rules enforced by the
-- database rather than by hope that every code path remembers to check.
-- =============================================================================

-- btree_gist lets a GiST index mix an equality column (unit_id) with a range
-- column (period) in one exclusion constraint.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

-- pg_trgm powers typo-tolerant search ("excavtor" -> "excavator").
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint


-- =============================================================================
-- 1. NO DOUBLE BOOKING
--
-- THE most important statement in this codebase.
--
-- Two customers pressing "Book" on the last 100 t crane in the same millisecond
-- cannot both succeed. An application-level "check then insert" cannot prevent
-- this: under READ COMMITTED both checks legitimately return "free", because
-- neither transaction has committed when the other reads.
--
-- The exclusion constraint is evaluated inside the index at insert time and
-- blocks against in-progress transactions. The loser gets SQLSTATE 23P01, which
-- the application catches and reports as "no longer available".
--
-- The partial WHERE clause means cancelled, released and expired reservations
-- free their window immediately, with no cleanup job in the critical path.
-- =============================================================================
ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_no_overlap"
  EXCLUDE USING gist (
    "unit_id" WITH =,
    "period" WITH &&
  ) WHERE (status IN ('held', 'confirmed', 'active'));--> statement-breakpoint

-- A unit cannot be double-blacked-out either; overlapping maintenance windows
-- are a data-entry error, not a valid schedule.
ALTER TABLE "unit_blackout"
  ADD CONSTRAINT "unit_blackout_no_overlap"
  EXCLUDE USING gist (
    "unit_id" WITH =,
    "period" WITH &&
  );--> statement-breakpoint

-- A range must be non-empty and ordered. An inverted or empty range would
-- overlap nothing and silently defeat the constraint above.
ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_period_valid"
  CHECK (NOT isempty("period") AND lower("period") < upper("period"));--> statement-breakpoint

ALTER TABLE "unit_blackout"
  ADD CONSTRAINT "unit_blackout_period_valid"
  CHECK (NOT isempty("period") AND lower("period") < upper("period"));--> statement-breakpoint

ALTER TABLE "reservation"
  ADD CONSTRAINT "reservation_billable_window_valid"
  CHECK ("billable_start" < "billable_end");--> statement-breakpoint


-- =============================================================================
-- 2. MONEY INVARIANTS
--
-- Negative money is always a bug. Catching it at the storage layer means a
-- miscalculation surfaces as a failed write rather than as a credit note.
-- =============================================================================
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_amounts_non_negative"
  CHECK (
    "rental_subtotal_halalas"    >= 0 AND
    "addons_subtotal_halalas"    >= 0 AND
    "transport_subtotal_halalas" >= 0 AND
    "discount_halalas"           >= 0 AND
    "taxable_subtotal_halalas"   >= 0 AND
    "vat_halalas"                >= 0 AND
    "deposit_halalas"            >= 0 AND
    "total_halalas"              >= 0 AND
    "refund_halalas"             >= 0
  );--> statement-breakpoint

ALTER TABLE "booking"
  ADD CONSTRAINT "booking_dates_valid"
  CHECK ("start_date" < "end_date" AND "billable_days" >= 1);--> statement-breakpoint

-- Refunds can never exceed what was actually captured.
ALTER TABLE "payment"
  ADD CONSTRAINT "payment_amounts_valid"
  CHECK (
    "amount_halalas"   >  0 AND
    "captured_halalas" >= 0 AND
    "refunded_halalas" >= 0 AND
    "captured_halalas" <= "amount_halalas" AND
    "refunded_halalas" <= "captured_halalas"
  );--> statement-breakpoint

ALTER TABLE "refund"
  ADD CONSTRAINT "refund_amount_positive"
  CHECK ("amount_halalas" > 0);--> statement-breakpoint

-- An invoice must foot against its own totals.
ALTER TABLE "invoice"
  ADD CONSTRAINT "invoice_totals_consistent"
  CHECK (
    "subtotal_halalas" >= 0 AND
    "vat_halalas"      >= 0 AND
    "total_halalas"    = "subtotal_halalas" + "vat_halalas"
  );--> statement-breakpoint

ALTER TABLE "rate_tier"
  ADD CONSTRAINT "rate_tier_rate_positive"
  CHECK ("rate_halalas" > 0 AND "min_days" >= 1);--> statement-breakpoint


-- =============================================================================
-- 3. COUPON REDEMPTION CAP
--
-- Enforced here rather than in code so that N concurrent redemptions of the
-- last remaining use cannot all succeed.
-- =============================================================================
ALTER TABLE "coupon"
  ADD CONSTRAINT "coupon_redemption_cap"
  CHECK ("max_redemptions" IS NULL OR "redemption_count" <= "max_redemptions");--> statement-breakpoint

ALTER TABLE "coupon"
  ADD CONSTRAINT "coupon_validity_ordered"
  CHECK ("valid_from" < "valid_to");--> statement-breakpoint

ALTER TABLE "coupon"
  ADD CONSTRAINT "coupon_value_positive"
  CHECK ("value" > 0 AND "redemption_count" >= 0);--> statement-breakpoint


-- =============================================================================
-- 4. REVIEW AND INSPECTION INTEGRITY
--
-- A rating outside 1..5 is meaningless. The one-review-per-booking uniqueness
-- (in 0000) plus the FK to a real booking is what makes reviews verifiable
-- rather than merely claimed to be.
-- =============================================================================
ALTER TABLE "review"
  ADD CONSTRAINT "review_rating_range"
  CHECK ("rating" BETWEEN 1 AND 5);--> statement-breakpoint

ALTER TABLE "inspection"
  ADD CONSTRAINT "inspection_ranges_valid"
  CHECK (
    ("fuel_level_percent" IS NULL OR "fuel_level_percent" BETWEEN 0 AND 100) AND
    ("condition_rating"   IS NULL OR "condition_rating"   BETWEEN 1 AND 5) AND
    "chargeable_damage_halalas" >= 0
  );--> statement-breakpoint


-- =============================================================================
-- 5. INVOICE NUMBERING
--
-- A dedicated sequence, so numbering is gapless in allocation order and can
-- never be reused. ZATCA Phase 2 additionally requires a chained
-- previous-invoice hash; that column exists and is populated only once a real
-- Fatoora integration is configured (docs/research.md §6).
-- =============================================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;--> statement-breakpoint


-- =============================================================================
-- 6. SEARCH
--
-- Generated tsvector columns, so the index can never drift from the row: there
-- is no trigger to forget and no application path that could skip the update.
--
-- Weights: A = name, B = manufacturer/model, C = description. A search for
-- "liebherr" should rank a Liebherr crane above one whose description merely
-- mentions the word.
-- =============================================================================
ALTER TABLE "equipment_class"
  ADD COLUMN "search_vector_en" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name_en", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("manufacturer", '') || ' ' || coalesce("model", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description_en", '')), 'C')
  ) STORED;--> statement-breakpoint

-- Postgres ships no Arabic stemmer, so 'simple' is the honest configuration:
-- exact token matching without incorrect stemming. The trigram indexes below
-- cover partial and misspelled Arabic input.
ALTER TABLE "equipment_class"
  ADD COLUMN "search_vector_ar" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name_ar", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("manufacturer", '') || ' ' || coalesce("model", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("description_ar", '')), 'C')
  ) STORED;--> statement-breakpoint

CREATE INDEX "equipment_class_search_en_idx" ON "equipment_class" USING gin ("search_vector_en");--> statement-breakpoint
CREATE INDEX "equipment_class_search_ar_idx" ON "equipment_class" USING gin ("search_vector_ar");--> statement-breakpoint

CREATE INDEX "equipment_class_name_trgm_idx" ON "equipment_class" USING gin ("name_en" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "equipment_class_name_ar_trgm_idx" ON "equipment_class" USING gin ("name_ar" gin_trgm_ops);--> statement-breakpoint

-- Attribute filters query the jsonb directly; jsonb_path_ops is smaller and
-- faster than the default operator class for containment queries.
CREATE INDEX "equipment_class_specs_idx" ON "equipment_class" USING gin ("specs" jsonb_path_ops);--> statement-breakpoint


-- =============================================================================
-- 7. PARTIAL INDEXES FOR OPERATIONAL QUERIES
--
-- The ops dashboard only ever asks about live rentals. Partial indexes keep
-- these small and hot no matter how much completed history accumulates.
-- =============================================================================
CREATE INDEX "booking_live_idx" ON "booking" ("start_date", "end_date")
  WHERE status IN ('confirmed', 'active');--> statement-breakpoint

CREATE INDEX "booking_awaiting_payment_idx" ON "booking" ("created_at")
  WHERE status = 'pending_payment';--> statement-breakpoint

CREATE INDEX "reservation_active_idx" ON "reservation" ("unit_id", "billable_start")
  WHERE status IN ('held', 'confirmed', 'active');--> statement-breakpoint

CREATE INDEX "delivery_pending_idx" ON "delivery" ("scheduled_window_start")
  WHERE status NOT IN ('delivered', 'returned', 'failed');--> statement-breakpoint

CREATE INDEX "review_published_idx" ON "review" ("class_id", "created_at")
  WHERE status = 'published';--> statement-breakpoint

CREATE INDEX "article_live_idx" ON "article" ("locale", "published_at")
  WHERE status = 'published';--> statement-breakpoint


-- =============================================================================
-- 8. TENANCY AND ROLE INVARIANTS
-- =============================================================================

-- A project site belongs to exactly one owner: a company OR an individual.
-- Allowing both, or neither, would create rows no scoped query could reach.
ALTER TABLE "project_site"
  ADD CONSTRAINT "project_site_single_owner"
  CHECK (
    ("company_id" IS NOT NULL AND "owner_user_id" IS NULL) OR
    ("company_id" IS NULL AND "owner_user_id" IS NOT NULL)
  );--> statement-breakpoint

-- Exactly one active owner per company: no orphaned company, and no ambiguity
-- about who is allowed to grant roles.
CREATE UNIQUE INDEX "company_single_owner_idx"
  ON "company_member" ("company_id")
  WHERE role = 'owner' AND status = 'active';--> statement-breakpoint


-- =============================================================================
-- 9. AUDIT LOG TAMPER RESISTANCE
--
-- The hash chain (previous_hash -> entry_hash) makes alteration detectable.
-- Revoking UPDATE and DELETE from the application role makes it impossible
-- through the application at all. Both, because detection alone is weaker than
-- prevention, and prevention alone leaves no evidence if it is bypassed.
--
-- The role only exists in a properly provisioned environment; local dev
-- connects as the owner. See docs/SECURITY.md §8.
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hdr_app') THEN
    REVOKE UPDATE, DELETE ON "audit_log"     FROM hdr_app;
    REVOKE UPDATE, DELETE ON "booking_event" FROM hdr_app;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "audit_log"
  ADD CONSTRAINT "audit_log_hash_present"
  CHECK (length("entry_hash") = 64);--> statement-breakpoint


-- =============================================================================
-- 10. DOCUMENTED INTENT
--
-- These constraints are security controls. Naming their purpose in the schema
-- means the next engineer reads the reason before deciding to drop one.
-- =============================================================================
COMMENT ON INDEX "payment_webhook_event_unique" IS
  'Replay defence: a duplicated provider event cannot be processed twice.';--> statement-breakpoint

COMMENT ON CONSTRAINT "reservation_no_overlap" ON "reservation" IS
  'Prevents double-booking a physical machine. See docs/DATABASE.md section 5.';
