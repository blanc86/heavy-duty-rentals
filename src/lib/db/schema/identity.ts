import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  companyRoleEnum,
  companyStatusEnum,
  localeEnum,
  memberStatusEnum,
  userStatusEnum,
} from "./enums";

const now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "user",
  {
    id: uuid("id").primaryKey(),
    /** Always stored lower-cased and trimmed; the unique index is the enforcement. */
    email: varchar("email", { length: 320 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phone: varchar("phone", { length: 32 }),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    /** argon2id. Never returned by any DTO; see docs/SECURITY.md §6. */
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 200 }).notNull(),
    preferredLocale: localeEnum("preferred_locale").notNull().default("en"),
    /**
     * Internal operations access. Deliberately separate from company roles so
     * that no company-scoped route can escalate a customer to platform admin.
     */
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    /**
     * Created by a guest checkout. Has no usable password and cannot sign in;
     * reaches its own booking through a reference + email lookup instead.
     */
    isGuest: boolean("is_guest").notNull().default(false),
    status: userStatusEnum("status").notNull().default("pending_verification"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /**
     * PDPL: marketing consent is separate and unbundled from terms acceptance,
     * and we retain evidence of when and how it was given. Null means no
     * consent — the notification dispatcher refuses marketing sends on null.
     */
    marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
    marketingConsentSource: varchar("marketing_consent_source", { length: 64 }),
    marketingConsentIp: varchar("marketing_consent_ip", { length: 45 }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_email_unique").on(sql`lower(${t.email})`),
    index("user_status_idx").on(t.status),
  ],
);

export const sessions = pgTable(
  "session",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /**
     * SHA-256 of the opaque bearer token. The raw token is returned to the
     * client once and never persisted, so a database dump yields no usable
     * sessions.
     */
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    /** Sliding expiry, extended on use. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Hard ceiling. A stolen session cannot be renewed indefinitely. */
    absoluteExpiresAt: timestamp("absolute_expires_at", { withTimezone: true }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    /** Set when MFA was satisfied for this session; admin routes require it. */
    mfaSatisfiedAt: timestamp("mfa_satisfied_at", { withTimezone: true }),
    /**
     * When set, this session may see only this one booking. Issued by the guest
     * reference + email lookup; NULL for a normal staff session.
     */
    scopedBookingId: uuid("scoped_booking_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("session_token_hash_unique").on(t.tokenHash),
    index("session_user_idx").on(t.userId),
    index("session_expires_idx").on(t.expiresAt),
  ],
);

export const mfaCredentials = pgTable(
  "mfa_credential",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 16 }).notNull().default("totp"),
    /** AES-256-GCM ciphertext. The key lives in ENCRYPTION_KEY, not the database. */
    secretEncrypted: text("secret_encrypted").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /**
     * Highest TOTP counter already accepted. Rejecting counters <= this value
     * prevents replay of a code intercepted inside its own 30s window.
     */
    lastUsedCounter: bigint("last_used_counter", { mode: "bigint" }),
    recoveryCodeHashes: jsonb("recovery_code_hashes").$type<string[]>().notNull().default([]),
    createdAt: now(),
  },
  (t) => [index("mfa_user_idx").on(t.userId)],
);

/** Password reset and email verification tokens. Hashed, single-use, short TTL. */
export const authTokens = pgTable(
  "auth_token",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", { length: 32 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("auth_token_hash_unique").on(t.tokenHash),
    index("auth_token_user_purpose_idx").on(t.userId, t.purpose),
  ],
);

export const companies = pgTable(
  "company",
  {
    id: uuid("id").primaryKey(),
    nameEn: varchar("name_en", { length: 240 }).notNull(),
    nameAr: varchar("name_ar", { length: 240 }),
    vatNumber: varchar("vat_number", { length: 20 }),
    commercialRegistrationNumber: varchar("cr_number", { length: 20 }),
    billingAddressEn: text("billing_address_en"),
    billingAddressAr: text("billing_address_ar"),
    billingCity: varchar("billing_city", { length: 80 }),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    status: companyStatusEnum("status").notNull().default("pending_review"),
    /** Credit terms are admin-granted, never self-serve. 0 = card payment only. */
    creditLimitHalalas: bigint("credit_limit_halalas", { mode: "bigint" }).notNull().default(sql`0`),
    creditTermsDays: integer("credit_terms_days").notNull().default(0),
    /** Bookings above this total require an approver. 0 disables approvals. */
    approvalThresholdHalalas: bigint("approval_threshold_halalas", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("company_status_idx").on(t.status)],
);

/**
 * THE tenancy boundary. Every company-scoped query joins through this table.
 * A user with no active row here for company X can reach nothing of company X.
 */
export const companyMembers = pgTable(
  "company_member",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: companyRoleEnum("role").notNull().default("viewer"),
    status: memberStatusEnum("status").notNull().default("invited"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("company_member_unique").on(t.companyId, t.userId),
    index("company_member_user_idx").on(t.userId),
  ],
);

export const projectSites = pgTable(
  "project_site",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    /** Individual customers own sites directly; company sites are shared. */
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    addressLine: text("address_line").notNull(),
    latitude: varchar("latitude", { length: 32 }),
    longitude: varchar("longitude", { length: 32 }),
    contactName: varchar("contact_name", { length: 160 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    /** Free text: gate restrictions, ground conditions, overhead lines, permits. */
    accessNotes: text("access_notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: now(),
  },
  (t) => [
    index("project_site_company_idx").on(t.companyId),
    index("project_site_owner_idx").on(t.ownerUserId),
  ],
);
