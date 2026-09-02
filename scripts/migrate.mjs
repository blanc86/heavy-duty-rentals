#!/usr/bin/env node
/**
 * Forward-only SQL migrator.
 *
 * Deliberately not drizzle-kit's migrator: several migrations are hand-authored
 * (exclusion constraints, generated columns, CHECK constraints, GRANTs) that
 * drizzle-kit cannot express, and mixing generated and hand-written files in
 * its journal is fragile. A plain ordered-file runner is easier to reason
 * about and easier to audit, which matters for a schema whose constraints are
 * the security model.
 *
 * Each file runs inside ONE transaction: a migration either fully applies or
 * does not apply at all.
 */
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "db", "migrations");

try {
  process.loadEnvFile(path.join(here, "..", ".env"));
} catch {
  // Environment may be injected by the platform instead of a .env file.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS "_migration" (
      "name"       text PRIMARY KEY,
      "checksum"   text NOT NULL,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )
  `;

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = await sql`SELECT name, checksum FROM "_migration"`;
  const appliedMap = new Map(applied.map((r) => [r.name, r.checksum]));

  let ran = 0;

  for (const file of files) {
    const raw = await readFile(path.join(migrationsDir, file), "utf8");
    const checksum = createHash("sha256").update(raw).digest("hex");

    const previous = appliedMap.get(file);
    if (previous) {
      // An edited migration means the database and the repository disagree
      // about history. Fail loudly rather than silently diverging.
      if (previous !== checksum) {
        console.error(
          `\nMigration ${file} has changed since it was applied.\n` +
            `Migrations are immutable once applied — add a new migration instead.\n`,
        );
        process.exit(1);
      }
      continue;
    }

    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !/^(--[^\n]*\n?)*$/.test(s));

    process.stdout.write(`  applying ${file} (${statements.length} statements) ... `);

    try {
      await sql.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement);
        }
        await tx`
          INSERT INTO "_migration" (name, checksum) VALUES (${file}, ${checksum})
        `;
      });
      process.stdout.write("ok\n");
      ran += 1;
    } catch (error) {
      process.stdout.write("FAILED\n");
      console.error(`\n${error.message}\n`);
      if (error.position) console.error(`  at character position ${error.position}`);
      process.exit(1);
    }
  }

  console.log(ran === 0 ? "Database is up to date." : `Applied ${ran} migration(s).`);
}

main()
  .then(() => sql.end())
  .catch(async (error) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });
