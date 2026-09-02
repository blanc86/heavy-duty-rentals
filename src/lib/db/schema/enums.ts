import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Enums are Postgres ENUM types rather than TEXT + CHECK so that an invalid
 * state is rejected by the database itself. A booking cannot end up in a
 * status nobody wrote code for.
 */

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "pending_verification"]);

export const localeEnum = pgEnum("locale", ["en", "ar"]);

export const companyStatusEnum = pgEnum("company_status", ["active", "suspended", "pending_review"]);

/**
 * Company roles. `platform_admin` is deliberately NOT here — internal admin is
 * a separate axis on the user record, so no company-scoped operation can ever
 * grant platform access.
 */
export const companyRoleEnum = pgEnum("company_role", [
  "owner",
  "admin",
  "procurement",
  "finance",
  "project_manager",
  "viewer",
]);

export const memberStatusEnum = pgEnum("member_status", ["invited", "active", "suspended"]);

export const unitStatusEnum = pgEnum("unit_status", [
  "available",
  "reserved",
  "rented",
  "in_transit",
  "maintenance",
  "inspection",
  "out_of_service",
]);

export const blackoutReasonEnum = pgEnum("blackout_reason", [
  "maintenance",
  "inspection",
  "transport",
  "out_of_service",
  "other",
]);

export const rateTierEnum = pgEnum("rate_tier_name", ["daily", "weekly", "monthly"]);

export const fuelPolicyEnum = pgEnum("fuel_policy", ["wet", "dry"]);

export const addonPricingModelEnum = pgEnum("addon_pricing_model", [
  "per_day",
  "flat",
  "per_unit_per_day",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "draft",
  "pending_payment",
  "confirmed",
  "active",
  "completed",
  "cancelled",
  "expired",
]);

/**
 * Only `held`, `confirmed` and `active` participate in the no-overlap
 * exclusion constraint. Releasing a reservation frees the window with no
 * cleanup job (see docs/DATABASE.md §5).
 */
export const reservationStatusEnum = pgEnum("reservation_status", [
  "held",
  "confirmed",
  "active",
  "released",
  "expired",
  "cancelled",
]);

export const actorTypeEnum = pgEnum("actor_type", ["customer", "admin", "system", "webhook", "anonymous"]);

export const paymentKindEnum = pgEnum("payment_kind", [
  "rental_charge",
  "deposit_authorization",
  "extension_charge",
  "damage_charge",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "requires_action",
  "authorized",
  "captured",
  "failed",
  "voided",
  "refunded",
  "partially_refunded",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "mada",
  "visa",
  "mastercard",
  "apple_pay",
  "stc_pay",
  "credit_terms",
  "bank_transfer",
]);

export const invoiceTypeEnum = pgEnum("invoice_type", ["tax_invoice", "simplified", "credit_note"]);

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "issued", "paid", "void"]);

export const deliveryDirectionEnum = pgEnum("delivery_direction", ["outbound", "return"]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "scheduled",
  "assigned",
  "loading",
  "in_transit",
  "arrived",
  "delivered",
  "failed",
  "returned",
]);

export const inspectionPhaseEnum = pgEnum("inspection_phase", ["pre_hire", "on_return"]);

export const inspectionResultEnum = pgEnum("inspection_result", ["pass", "pass_with_notes", "fail"]);

export const reviewStatusEnum = pgEnum("review_status", ["pending", "published", "rejected"]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "requested",
  "in_review",
  "priced",
  "sent",
  "accepted",
  "rejected",
  "expired",
]);

export const documentKindEnum = pgEnum("document_kind", [
  "load_chart",
  "manual",
  "certificate",
  "insurance",
  "registration",
  "inspection_report",
  "other",
]);

/**
 * Document visibility is enforced server-side on every read. A load chart sells
 * the machine and is public; an insurance certificate is not.
 */
export const documentVisibilityEnum = pgEnum("document_visibility", [
  "public",
  "customer",
  "internal",
]);

export const auditOutcomeEnum = pgEnum("audit_outcome", ["success", "failure", "denied"]);

export const notificationChannelEnum = pgEnum("notification_channel", ["email", "sms", "in_app"]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "suppressed",
]);

export const articleStatusEnum = pgEnum("article_status", ["draft", "published", "archived"]);

export const discountTypeEnum = pgEnum("discount_type", ["percent", "fixed"]);
