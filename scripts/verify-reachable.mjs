#!/usr/bin/env node
/**
 * Unreachable-export scan.
 *
 * Finds exported symbols in `src/lib` and `src/components` that nothing
 * references — anywhere, including their own module.
 *
 * This exists because the same defect turned up five separate times in review:
 * a capability fully built, guarded, audited and tested, with nothing wired to
 * reach it. Sign-out, change-password, booking cancellation, the booking
 * lifecycle transitions, and taking a machine out of service were each complete
 * underneath and had no caller. One of them — `getBookingReference` — was worse
 * than unused: it sat in a `"use server"` module, which makes every export a
 * callable HTTP endpoint, and it had no authorization check at all despite a
 * comment claiming it was scoped to the actor.
 *
 * All of them were invisible to the things that normally catch problems. Types
 * checked, lint passed, tests passed, routes returned 200 — because an exported
 * function nobody calls is not *wrong*, it is merely absent from the product.
 *
 * The scan distinguishes two cases, because reporting them together is what
 * makes a check like this cry wolf until people stop reading it:
 *
 *   ----  referenced nowhere at all — unreachable capability, or dead code
 *   note  used only inside its own module — reachable; the `export` is spare
 *
 * It reports and exits 0 rather than gating a build. An unreferenced export is
 * a question, not a defect, and only a person can answer whether it is a
 * missing button or a helper to delete.
 *
 * A dead export is not automatically a bug: it can be a deliberate seam or an
 * interface method a provider must implement. The point is that each one is a
 * decision someone looked at. Accepted ones go in ALLOWED, with a reason.
 *
 * Usage:  node scripts/verify-reachable.mjs
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["src/lib", "src/components", "src/content"];
const SEARCH_DIRS = ["src", "scripts", "tests"];

/**
 * Exports that are legitimately referenced by nothing.
 *
 * Each needs a reason. "It might be useful later" is not one — that is what
 * version control is for.
 */
const ALLOWED = new Map([
  ["proxy", "Next.js proxy entry point, invoked by the framework"],
  ["config", "Next.js proxy matcher, read by the framework"],
]);

const SKIP_FILES = [/\/app\//, /\.d\.ts$/];

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(path.join(root, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(rel)));
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

function exportedNames(source) {
  const found = [];
  const patterns = [
    /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+const\s+([A-Za-z_$][\w$]*)\s*[:=]/gm,
    /^export\s+class\s+([A-Za-z_$][\w$]*)/gm,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      found.push({ name: match[1], line: source.slice(0, match.index).split("\n").length });
    }
  }
  return found;
}

function countMentions(text, name) {
  const escaped = name.replace(/[$]/g, "\\$");
  return (text.match(new RegExp(`\\b${escaped}\\b`, "g")) ?? []).length;
}

async function main() {
  const scanFiles = (await Promise.all(SCAN_DIRS.map(walk)))
    .flat()
    .filter((f) => !SKIP_FILES.some((re) => re.test(f.replace(/\\/g, "/"))));

  const searchFiles = (await Promise.all(SEARCH_DIRS.map(walk))).flat();

  const contents = new Map();
  for (const file of searchFiles) {
    contents.set(file, await readFile(path.join(root, file), "utf8"));
  }

  const dead = [];
  const internalOnly = [];
  let scanned = 0;

  for (const file of scanFiles) {
    const source = contents.get(file) ?? (await readFile(path.join(root, file), "utf8"));

    for (const { name, line } of exportedNames(source)) {
      scanned += 1;
      if (ALLOWED.has(name)) continue;

      // Referenced by another module? Then it is reachable; nothing to say.
      let usedElsewhere = false;
      for (const [other, text] of contents) {
        if (other === file) continue;
        if (countMentions(text, name) > 0) {
          usedElsewhere = true;
          break;
        }
      }
      if (usedElsewhere) continue;

      // Used only inside its own module is a different finding: the capability
      // is reachable and the `export` is merely unnecessary. More than one
      // mention means the declaration plus at least one internal use.
      const entry = { file: file.replace(/\\/g, "/"), line, name };
      if (countMentions(source, name) > 1) internalOnly.push(entry);
      else dead.push(entry);
    }
  }

  console.log(`Scanned ${scanned} exported symbols across ${scanFiles.length} files.`);
  console.log("");

  if (internalOnly.length > 0) {
    console.log(`${internalOnly.length} exported but used only inside their own module:`);
    for (const d of internalOnly) console.log(`  note  ${d.file}:${d.line}  ${d.name}`);
    console.log("  (reachable — the export keyword is spare. Not a failure.)");
    console.log("");
  }

  if (dead.length === 0) {
    console.log("PASS  every exported symbol is reachable.");
    return;
  }

  console.log(`${dead.length} exported symbol(s) referenced NOWHERE:`);
  for (const d of dead) console.log(`  ----  ${d.file}:${d.line}  ${d.name}`);
  console.log("");
  console.log("Each is either a capability with no way to reach it, or dead code.");
  console.log("Wire it up, delete it, or add it to ALLOWED with a reason.");
  console.log("");
  console.log("Exit code stays 0: this is a review tool, not a gate. Nothing here");
  console.log("is broken — an unreferenced export is a question, and only a person");
  console.log("can answer whether it is a missing button or a helper to delete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
