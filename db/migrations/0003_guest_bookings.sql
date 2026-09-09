-- =============================================================================
-- GUEST BOOKINGS
--
-- Customers no longer create accounts. Requiring a signup before someone can
-- hire a machine costs bookings, and the account was never doing any work the
-- business needed: the identity that matters is verified at handover, and the
-- money is verified by the card.
--
-- Two changes make that possible without unpicking the ownership model that
-- every scoped read in the codebase depends on.
-- =============================================================================


-- =============================================================================
-- 1. PASSWORDLESS CUSTOMER RECORDS
--
-- A guest checkout still creates a `user` row, found or created by email. That
-- keeps `booking.customer_user_id` NOT NULL, keeps every existing scoped query
-- correct, and keeps repeat customers grouped under one identity in the
-- operations console — which is what makes "this contractor has hired from us
-- four times" answerable at all.
--
-- The row simply has no way to authenticate. `password_hash` holds a sentinel
-- that no password can ever produce, because argon2 verification of a non-hash
-- string fails rather than matching.
-- =============================================================================
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "is_guest" boolean NOT NULL DEFAULT FALSE;--> statement-breakpoint

COMMENT ON COLUMN "user"."is_guest" IS
  'Created by a guest checkout. Has no usable password and cannot sign in; '
  'reaches its own booking through a reference + email lookup instead.';--> statement-breakpoint

-- A guest record must never be usable as a login, and must never be an admin.
ALTER TABLE "user"
  ADD CONSTRAINT "user_guest_is_never_admin"
  CHECK ("is_guest" = FALSE OR "is_platform_admin" = FALSE);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "user_guest_idx" ON "user" ("is_guest") WHERE "is_guest" = TRUE;--> statement-breakpoint


-- =============================================================================
-- 2. BOOKING-SCOPED SESSIONS
--
-- A guest proves ownership of a booking with its reference AND the email it was
-- made with, and receives a session that can see THAT BOOKING AND NOTHING ELSE.
--
-- Scoping matters. Without it, one reference plus one email address would open
-- every booking ever made by that address. The reference is the secret; it
-- should unlock exactly what it names.
--
-- ON DELETE CASCADE: if the booking goes, so does any session that existed only
-- to view it.
-- =============================================================================
ALTER TABLE "session"
  ADD COLUMN IF NOT EXISTS "scoped_booking_id" uuid
  REFERENCES "booking"("id") ON DELETE CASCADE;--> statement-breakpoint

COMMENT ON COLUMN "session"."scoped_booking_id" IS
  'When set, this session may see only this one booking. Issued by the guest '
  'reference + email lookup. NULL for a normal staff session.';--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "session_scoped_booking_idx"
  ON "session" ("scoped_booking_id")
  WHERE "scoped_booking_id" IS NOT NULL;--> statement-breakpoint

-- A booking-scoped session is a guest viewing one rental. It must never also
-- carry a satisfied second factor, because MFA satisfaction is what admin
-- mutations check — and this session is not a person who can hold that.
ALTER TABLE "session"
  ADD CONSTRAINT "session_scoped_is_never_mfa_satisfied"
  CHECK ("scoped_booking_id" IS NULL OR "mfa_satisfied_at" IS NULL);
