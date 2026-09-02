import path from "node:path";

/**
 * Vitest setup.
 *
 * Loads `.env` so tests run against the same validated environment shape the
 * application uses. Without this, importing anything that touches `src/lib/env`
 * fails on a missing DATABASE_URL — and we would be tempted to weaken the env
 * validation to accommodate tests, which is exactly backwards.
 */
try {
  process.loadEnvFile(path.resolve(process.cwd(), ".env"));
} catch {
  // CI injects the environment directly; a missing .env file is fine there.
}

// Test defaults, applied only when nothing has been supplied.
// `NODE_ENV` is typed read-only by @types/node, so it is set through the
// index signature rather than the narrowed property.
const env = process.env as Record<string, string | undefined>;
env.NODE_ENV ??= "test";
env.DATABASE_URL ??= "postgresql://hdr:hdr_dev_password@localhost:5433/hdr";
env.PAYMENT_PROVIDER ??= "mock";
env.APP_SECRET ??= "test-app-secret-not-used-in-production";
