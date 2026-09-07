import { z } from "zod";

/**
 * Server environment, validated once at startup.
 *
 * A missing ENCRYPTION_KEY should crash the process on boot, not surface as a
 * confusing runtime failure the first time someone enables MFA. Fail loudly and
 * early.
 *
 * This module must never be imported from a Client Component — it reads
 * secrets. Anything the browser legitimately needs goes through
 * `publicEnv` below, which contains only NEXT_PUBLIC_* values.
 */

const base64Key = z
  .string()
  .refine((v) => {
    try {
      return Buffer.from(v, "base64").length === 32;
    } catch {
      return false;
    }
  }, "must be a base64-encoded 32-byte key (generate: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\")");

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  ENCRYPTION_KEY: base64Key.optional(),
  APP_SECRET: z.string().min(16).optional(),

  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  SESSION_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().positive().default(7_776_000),

  PAYMENT_PROVIDER: z.enum(["mock", "moyasar"]).default("mock"),
  MOYASAR_PUBLISHABLE_KEY: z.string().optional(),
  MOYASAR_SECRET_KEY: z.string().optional(),
  MOYASAR_WEBHOOK_SECRET: z.string().optional(),

  CURRENCY: z.string().length(3).default("SAR"),
  VAT_RATE_PPM: z.coerce.number().int().min(0).max(1_000_000).default(150_000),

  TAX_INVOICE_PROVIDER: z.enum(["local", "zatca"]).default("local"),

  EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  EMAIL_FROM: z.string().default("Heavy Duty Rentals <no-reply@example.com>"),

  SMS_PROVIDER: z.enum(["console", "http"]).default("console"),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./storage"),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  RATE_LIMIT_BACKEND: z.enum(["memory", "redis"]).default("memory"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  INSTANT_BOOK_MAX_CAPACITY_KG: z.coerce.number().int().positive().default(150_000),
  CHECKOUT_HOLD_MINUTES: z.coerce.number().int().min(5).max(120).default(20),

  DEMO_MODE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

type ServerEnv = z.infer<typeof serverSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
  }

  return parsed.data;
}

/**
 * Production readiness assertions.
 *
 * Deliberately SEPARATE from schema parsing, and deliberately NOT run at module
 * load, because `next build` imports every route module to collect page data.
 * A build machine has no reason to hold production database credentials or a
 * live PSP secret key, and demanding them at build time would push teams toward
 * either weakening the checks or putting real secrets on build agents.
 *
 * These run once at SERVER STARTUP instead — see `src/instrumentation.ts` —
 * which is the moment the guarantee actually matters: the process is about to
 * accept traffic and touch real customer data.
 */
export function assertProductionReady(): void {
  if (env.NODE_ENV !== "production") return;

  const failures: string[] = [];

  if (!env.ENCRYPTION_KEY) {
    failures.push("ENCRYPTION_KEY is required: MFA secrets cannot be encrypted without it.");
  }
  if (!env.APP_SECRET) {
    failures.push("APP_SECRET is required: the audit hash chain and internal tokens depend on it.");
  }
  if (!env.DATABASE_URL.includes("sslmode=require")) {
    failures.push("DATABASE_URL must use sslmode=require: customer PII must not cross the network in the clear.");
  }
  // ZATCA Phase 2 is NOT implemented. `.env.example` said selecting it made the
  // adapter throw — but nothing called the adapter, so selecting it did nothing
  // at all: invoices were still issued locally and labelled "not cleared" while
  // whoever set the flag believed clearance was on. A silently ignored switch
  // on a legally required tax process is worse than one that either works or
  // fails, so it now refuses to start.
  if (env.TAX_INVOICE_PROVIDER === "zatca") {
    failures.push(
      "TAX_INVOICE_PROVIDER=zatca but ZATCA Phase 2 clearance is not implemented. " +
        "It needs CSID onboarding, a cryptographic stamp identity and sandbox certification. " +
        "Leave it as `local` until that work is done — see docs/research.md §6.",
    );
  }

  // The rest of the provider switches, checked in one place for one reason.
  //
  // Two of these were found silently doing nothing (ZATCA above, and Redis
  // below), so the whole family got the same question: if someone selects the
  // option that is not implemented, does anything tell them? For these three it
  // did not. Each is validated by the schema and then consumed by no code at
  // all, so `EMAIL_PROVIDER=smtp` on a production deploy sent exactly as much
  // mail as `console` did — none — while looking configured.
  //
  // The notification and object-storage layers are honest, documented gaps
  // (docs/FINAL_REVIEW.md §3). A gap is fine. A gap wearing a working switch is
  // not, because it is discovered by a customer not receiving something.
  const unimplemented: [string, boolean, string][] = [
    ["EMAIL_PROVIDER=smtp", env.EMAIL_PROVIDER === "smtp", "no mail transport is implemented"],
    ["SMS_PROVIDER=http", env.SMS_PROVIDER === "http", "no SMS transport is implemented"],
    ["STORAGE_PROVIDER=s3", env.STORAGE_PROVIDER === "s3", "no S3 driver is implemented"],
  ];
  for (const [setting, selected, why] of unimplemented) {
    if (selected) {
      failures.push(`${setting} but ${why}. Leave it at its default until that work is done.`);
    }
  }

  if (env.PAYMENT_PROVIDER === "mock") {
    failures.push(
      "PAYMENT_PROVIDER=mock moves no money and must never run in production. " +
        "Configure a real SAMA-licensed PSP.",
    );
  }
  if (env.RATE_LIMIT_BACKEND === "redis") {
    // Same shape as the ZATCA switch above: selected, unimplemented, and
    // silently ignored — while also suppressing the `memory` warning below,
    // so the operator lost the one signal that would have told them.
    failures.push(
      "RATE_LIMIT_BACKEND=redis but the Redis limiter is not implemented. " +
        "Use `memory` and accept a per-instance limit, or implement it first.",
    );
  }
  if (env.RATE_LIMIT_BACKEND === "memory") {
    // Not fatal — a single instance is legitimate — but silence here would let
    // a multi-instance deployment run with limits multiplied by the instance
    // count, which looks like a control while not being one.
    console.warn(
      "[startup] RATE_LIMIT_BACKEND=memory is per-process. With more than one " +
        "instance the effective limits are multiplied by the instance count. " +
        "See docs/SECURITY.md §2.",
    );
  }

  // Read straight from process.env: this one is consumed by Next.js itself,
  // not by our schema. Same shape of hazard as the rate limiter above — fine
  // on a single instance, broken across several, and silent either way.
  if (!process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) {
    console.warn(
      "[startup] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is unset, so Next.js generates " +
        "a per-instance key for Server Action closure encryption. With more than " +
        "one instance, a request served by a different instance than the one that " +
        "rendered the page fails to decrypt the action reference and the form " +
        "breaks. Set it to a stable base64 32-byte value across all instances.",
    );
  }

  if (failures.length > 0) {
    throw new Error(
      ["Refusing to start in production:", ...failures.map((f) => `  - ${f}`)].join("\n"),
    );
  }
}

export const env: ServerEnv = loadEnv();

/** Values that are safe to send to the browser. Nothing secret may go here. */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
