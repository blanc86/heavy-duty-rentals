import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE PRODUCTION BOOT GATE.
 *
 * `assertProductionReady` is the last thing standing between a misconfigured
 * deployment and real customers. It now carries one deliberate escape hatch —
 * DEMO_MODE, which permits the mock payment provider — and an escape hatch in a
 * refusal is exactly the kind of thing that quietly widens over time.
 *
 * So each branch is pinned here: what it still refuses, what the escape
 * permits, and what the escape must NOT reach.
 *
 * `env` is built once at module scope from process.env, so every case resets
 * the module registry and imports fresh.
 */

const BASE = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@host/db?sslmode=require",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  APP_SECRET: "0123456789abcdef0123456789abcdef",
} as const;

async function boot(
  overrides: Record<string, string | undefined>,
): Promise<string | null> {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...BASE, ...overrides })) {
    // `undefined` deletes the variable, which is what "not configured" means.
    // Blanking it instead fails Zod one layer earlier and would test the
    // schema rather than the gate.
    vi.stubEnv(key, value);
  }
  const { assertProductionReady } = await import("@/lib/env");
  try {
    assertProductionReady();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

beforeEach(() => {
  // Nothing from the developer's own .env may leak in and change a verdict.
  // DELETED rather than blanked: these are enums whose Zod defaults apply only
  // when the variable is absent, and "" is not a valid option for any of them.
  for (const key of [
    "PAYMENT_PROVIDER",
    "DEMO_MODE",
    "TAX_INVOICE_PROVIDER",
    "RATE_LIMIT_BACKEND",
    "EMAIL_PROVIDER",
    "SMS_PROVIDER",
    "STORAGE_PROVIDER",
  ]) {
    vi.stubEnv(key, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("what production still refuses", () => {
  it("refuses the mock payment provider when DEMO_MODE is off", async () => {
    const error = await boot({ PAYMENT_PROVIDER: "mock", DEMO_MODE: "false" });
    expect(error).toContain("PAYMENT_PROVIDER=mock");
  });

  it("refuses a database URL that is not TLS", async () => {
    const error = await boot({
      DATABASE_URL: "postgresql://u:p@host/db",
      PAYMENT_PROVIDER: "mock",
      DEMO_MODE: "true",
    });
    expect(error).toContain("sslmode=require");
  });

  it("refuses a missing encryption key", async () => {
    const error = await boot({
      ENCRYPTION_KEY: undefined,
      PAYMENT_PROVIDER: "mock",
      DEMO_MODE: "true",
    });
    expect(error).toContain("ENCRYPTION_KEY");
  });

  it("refuses ZATCA, which is not implemented", async () => {
    const error = await boot({
      TAX_INVOICE_PROVIDER: "zatca",
      PAYMENT_PROVIDER: "mock",
      DEMO_MODE: "true",
    });
    expect(error).toContain("ZATCA");
  });

  it("refuses the unimplemented redis limiter", async () => {
    const error = await boot({
      RATE_LIMIT_BACKEND: "redis",
      PAYMENT_PROVIDER: "mock",
      DEMO_MODE: "true",
    });
    expect(error).toContain("RATE_LIMIT_BACKEND=redis");
  });
});

describe("the DEMO_MODE escape", () => {
  it("permits the mock provider, and says so loudly", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = await boot({ PAYMENT_PROVIDER: "mock", DEMO_MODE: "true" });
    expect(error).toBeNull();
    // Silence would be the bug: an operator inheriting this deployment must
    // learn that no money moves from the logs, not from a customer.
    expect(warn.mock.calls.flat().join(" ")).toContain("NO real payments");
    warn.mockRestore();
  });

  it("does NOT excuse anything else — a demo still needs its secrets", async () => {
    const error = await boot({
      APP_SECRET: undefined,
      PAYMENT_PROVIDER: "mock",
      DEMO_MODE: "true",
    });
    expect(error).toContain("APP_SECRET");
  });

  it("refuses a REAL provider behind a demo banner", async () => {
    // The reverse mistake, and the more expensive one: every page would tell
    // visitors no real payment is taken while cards were genuinely charged.
    const error = await boot({ PAYMENT_PROVIDER: "moyasar", DEMO_MODE: "true" });
    expect(error).toContain("DEMO_MODE=true with PAYMENT_PROVIDER=moyasar");
  });

  it("is irrelevant outside production", async () => {
    const error = await boot({
      NODE_ENV: "development",
      PAYMENT_PROVIDER: "mock",
      DEMO_MODE: "false",
    });
    expect(error).toBeNull();
  });
});

describe("a correctly configured real deployment", () => {
  it("boots with a real provider and no demo banner", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = await boot({
      PAYMENT_PROVIDER: "moyasar",
      DEMO_MODE: "false",
      RATE_LIMIT_BACKEND: "postgres",
    });
    expect(error).toBeNull();
  });
});
