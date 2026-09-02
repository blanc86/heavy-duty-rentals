#!/usr/bin/env node
/** Block until Postgres accepts connections, so `db:up && db:migrate` is safe to chain. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(here, "..", ".env"));
} catch {
  /* environment may be injected by the platform */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const deadline = Date.now() + 60_000;
process.stdout.write("waiting for postgres ");

while (Date.now() < deadline) {
  const sql = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await sql`SELECT 1`;
    await sql.end();
    process.stdout.write(" ready\n");
    process.exit(0);
  } catch {
    await sql.end({ timeout: 1 }).catch(() => {});
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

process.stdout.write("\n");
console.error("Postgres did not become ready within 60s. Is `docker compose up -d db` running?");
process.exit(1);
