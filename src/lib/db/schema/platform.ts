import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { branches, equipmentClasses } from "./catalog";
import {
  actorTypeEnum,
  articleStatusEnum,
  auditOutcomeEnum,
  localeEnum,
  notificationChannelEnum,
  notificationStatusEnum,
} from "./enums";
import { companies, users } from "./identity";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/**
 * Append-only, hash-chained security and operations log.
 *
 * `entryHash = SHA256(previousHash || canonicalJson(entry))`. Altering or
 * deleting a historical row breaks the chain and is detectable by a
 * verification job. The application database role holds no UPDATE or DELETE
 * privilege on this table — tamper-resistance is enforced by grants, not by
 * the absence of code that would do it.
 *
 * `metadata` passes through a redaction allowlist before it is written, so
 * passwords, tokens, card data and unnecessary PII cannot land here by
 * accident at a call site.
 */
export const auditLogs = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorIp: varchar("actor_ip", { length: 45 }),
    actorUserAgent: varchar("actor_user_agent", { length: 512 }),
    action: varchar("action", { length: 80 }).notNull(),
    resourceType: varchar("resource_type", { length: 60 }),
    resourceId: varchar("resource_id", { length: 64 }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    outcome: auditOutcomeEnum("outcome").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    previousHash: varchar("previous_hash", { length: 64 }),
    entryHash: varchar("entry_hash", { length: 64 }).notNull(),
  },
  (t) => [
    index("audit_log_occurred_idx").on(t.occurredAt),
    index("audit_log_actor_idx").on(t.actorUserId, t.occurredAt),
    index("audit_log_resource_idx").on(t.resourceType, t.resourceId),
    index("audit_log_action_idx").on(t.action, t.occurredAt),
    index("audit_log_company_idx").on(t.companyId, t.occurredAt),
  ],
);

export const notifications = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** For pre-account transactional sends (guest checkout confirmation). */
    toAddress: varchar("to_address", { length: 320 }),
    channel: notificationChannelEnum("channel").notNull(),
    templateKey: varchar("template_key", { length: 80 }).notNull(),
    locale: localeEnum("locale").notNull().default("en"),
    /** Template variables. Never the rendered body — that could carry PII into logs. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** True for marketing sends, which require stored consent to dispatch. */
    isMarketing: boolean("is_marketing").notNull().default(false),
    status: notificationStatusEnum("status").notNull().default("queued"),
    providerMessageId: varchar("provider_message_id", { length: 200 }),
    failureReason: varchar("failure_reason", { length: 400 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("notification_user_idx").on(t.userId, t.createdAt),
    index("notification_status_idx").on(t.status, t.createdAt),
  ],
);

/**
 * Funnel events. Recorded server-side for the stages that matter, because
 * client-side analytics is blocked, sampled and spoofable — and this data
 * drives pricing and inventory decisions, not just a marketing dashboard.
 */
export const analyticsEvents = pgTable(
  "analytics_event",
  {
    id: uuid("id").primaryKey(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: varchar("type", { length: 60 }).notNull(),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
    locale: localeEnum("locale"),
    path: varchar("path", { length: 400 }),
    referrer: varchar("referrer", { length: 400 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("analytics_event_type_idx").on(t.type, t.occurredAt),
    index("analytics_event_session_idx").on(t.sessionId, t.occurredAt),
  ],
);

/** Content engine. SEO metadata is editable per article by a non-technical admin. */
export const articles = pgTable(
  "article",
  {
    id: uuid("id").primaryKey(),
    slug: varchar("slug", { length: 160 }).notNull(),
    locale: localeEnum("locale").notNull(),
    /** Links the en/ar versions of the same article so hreflang can pair them. */
    translationGroupId: uuid("translation_group_id").notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    excerpt: varchar("excerpt", { length: 500 }),
    bodyMarkdown: text("body_markdown").notNull(),
    heroImageKey: varchar("hero_image_key", { length: 200 }),
    metaTitle: varchar("meta_title", { length: 200 }),
    metaDescription: varchar("meta_description", { length: 320 }),
    ogImageKey: varchar("og_image_key", { length: 200 }),
    status: articleStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Drives internal linking from guides to the equipment they discuss. */
    relatedClassIds: jsonb("related_class_ids").$type<string[]>().notNull().default([]),
    relatedBranchIds: jsonb("related_branch_ids").$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("article_slug_locale_unique").on(t.slug, t.locale),
    index("article_status_published_idx").on(t.status, t.publishedAt),
    index("article_translation_group_idx").on(t.translationGroupId),
  ],
);

/** FAQ entries, surfaced on relevant pages and emitted as FAQPage JSON-LD. */
export const faqs = pgTable(
  "faq",
  {
    id: uuid("id").primaryKey(),
    questionEn: varchar("question_en", { length: 400 }).notNull(),
    questionAr: varchar("question_ar", { length: 400 }).notNull(),
    answerEn: text("answer_en").notNull(),
    answerAr: text("answer_ar").notNull(),
    /** Null = general. Otherwise scoped to a category, class or branch page. */
    categoryId: uuid("category_id"),
    classId: uuid("class_id").references(() => equipmentClasses.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    sortOrder: varchar("sort_order", { length: 8 }).notNull().default("0"),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("faq_scope_idx").on(t.classId, t.branchId, t.isPublished)],
);

/**
 * Business configuration. Company name, VAT number, contact details,
 * cancellation tiers and deposit rules live here so a non-technical admin can
 * change them — the brief's "do not bury these in code" requirement.
 */
export const settings = pgTable(
  "setting",
  {
    key: varchar("key", { length: 80 }).primaryKey(),
    valueJson: jsonb("value_json").$type<unknown>().notNull(),
    descriptionEn: varchar("description_en", { length: 400 }),
    /** Secret settings are never returned to any client, admin included. */
    isSecret: boolean("is_secret").notNull().default(false),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/** Persisted rate-limit counters when RATE_LIMIT_BACKEND is not in-memory. */
export const rateLimitBuckets = pgTable(
  "rate_limit_bucket",
  {
    key: varchar("key", { length: 200 }).primaryKey(),
    count: varchar("count", { length: 12 }).notNull().default("0"),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limit_expires_idx").on(t.expiresAt)],
);
