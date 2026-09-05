/**
 * Apply the least-privilege application role.
 *
 * Connects as the OWNER (DATABASE_URL) and runs db/roles/grant-app-role.sql,
 * which creates `hdr_app` if absent, grants it DML on current tables, and
 * revokes UPDATE/DELETE on the append-only tables.
 *
 * Run after every migration:  npm run db:migrate && npm run db:grant
 *
 * The role is created NOLOGIN. Give it a password out of band so the secret
 * never lands in git:
 *
 *     ALTER ROLE hdr_app WITH LOGIN PASSWORD '<from-secrets-manager>';
 *
 * then point the application's DATABASE_URL at hdr_app, leaving the owner
 * credential for migrations only.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = await readFile(path.join(root, ".env"), "utf8").catch(() => "");
  const match = envFile.match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error("DATABASE_URL is not set and was not found in .env");
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const sqlText = await readFile(path.join(root, "db", "roles", "grant-app-role.sql"), "utf8");
const sql = postgres(await loadDatabaseUrl(), { max: 1, onnotice: (n) => console.log(`  ${n.message}`) });

try {
  // One transaction: a partial application would leave the append-only
  // revocations off while the broad grants were already in place.
  await sql.begin(async (tx) => {
    await tx.unsafe(sqlText);
  });
  console.log("hdr_app role provisioned.");
} catch (error) {
  console.error("Failed to provision hdr_app:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
