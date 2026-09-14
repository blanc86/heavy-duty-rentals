#!/usr/bin/env node
/**
 * Accessibility and interaction audit, in a real browser.
 *
 *   node scripts/verify-a11y.mjs              # against http://localhost:3000
 *   APP_URL=https://… node scripts/verify-a11y.mjs
 *
 * For one page of every template, in both languages, at desktop and phone
 * sizes:
 *
 *   - axe-core against WCAG 2.2 A and AA
 *   - no horizontal scrolling — the page is never wider than the screen
 *   - no console errors
 *
 * And behaviours axe cannot see:
 *
 *   - reduced motion stops the fleet strip and leaves it scrollable
 *   - the mobile menu opens, traps focus, and closes on Escape
 *   - the quote form refuses an empty submit and focuses its error summary
 *   - a machine page's quote link preselects that machine in the form
 *   - a certificate opens in a modal dialog that closes on Escape and returns
 *     focus to the certificate
 *
 * axe is injected with page.evaluate rather than addScriptTag: the site's CSP
 * blocks injected <script> tags, which is the policy working as intended.
 */
/* global document, window, getComputedStyle -- used inside page.evaluate(), which runs in the browser */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const TEMPLATES = [
  "",
  "/equipment",
  "/equipment/mobile-cranes",
  "/equipment/mobile-cranes/all-terrain-crane-100t",
  "/projects",
  "/contact",
  "/about",
  "/service-areas",
  "/service-areas/jubail",
  "/faq",
  "/guides",
  "/privacy",
];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 375, height: 812 },
];

const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

async function main() {
  const axeSource = await readFile(path.join(root, "node_modules/axe-core/axe.min.js"), "utf8");
  const browser = await chromium.launch();
  let audited = 0;

  for (const viewport of VIEWPORTS) {
    for (const locale of ["en", "ar"]) {
      for (const template of TEMPLATES) {
        const url = `${BASE}/${locale}${template}`;
        const where = `${viewport.name} /${locale}${template}`;
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        page.on("pageerror", (e) => errors.push(String(e)));

        await page.goto(url, { waitUntil: "load" });
        await page.waitForTimeout(400);
        await page.evaluate((src) => {
          (0, eval)(src);
        }, axeSource);
        const result = await page.evaluate(async (tags) => {
          // @ts-expect-error injected
          const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
          return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(" "), help: v.help }));
        }, TAGS);
        for (const v of result) fail(where, `[${v.impact}] ${v.id} x${v.nodes} — ${v.help} (${v.target})`);

        const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
        if (widths[0] > widths[1]) fail(where, `page is ${widths[0]}px wide on a ${widths[1]}px screen`);
        for (const e of errors) fail(where, `console error: ${e.slice(0, 160)}`);

        audited += 1;
        await page.close();
      }
    }
  }

  // Reduced motion: the strip must stop and stay usable.
  {
    const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/en`);
    const state = await page.evaluate(() => {
      const track = document.querySelector(".fleet-track");
      const strip = document.querySelector(".fleet-strip");
      return {
        animation: track ? getComputedStyle(track).animationName : "missing",
        overflow: strip ? getComputedStyle(strip).overflowX : "missing",
      };
    });
    if (state.animation !== "none") fail("reduced motion", `fleet strip still animates (${state.animation})`);
    if (state.overflow !== "auto") fail("reduced motion", `fleet strip not scrollable (${state.overflow})`);
    await context.close();
  }

  // Motion allowed: the strip does animate, and the duplicate is hidden from AT.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/en`);
    const state = await page.evaluate(() => ({
      animation: getComputedStyle(document.querySelector(".fleet-track")).animationName,
      duplicateHidden: document.querySelector(".fleet-duplicate")?.getAttribute("aria-hidden") === "true",
      duplicateInert: document.querySelector(".fleet-duplicate")?.hasAttribute("inert") ?? false,
    }));
    if (state.animation === "none") fail("fleet strip", "does not animate when motion is allowed");
    if (!state.duplicateHidden || !state.duplicateInert) fail("fleet strip", "duplicate list is exposed to assistive technology or keyboard");
    await page.close();
  }

  // Mobile menu: opens, traps focus, closes on Escape and returns focus.
  {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.goto(`${BASE}/en`);
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.click();
    const dialog = page.getByRole("dialog");
    if (!(await dialog.isVisible())) fail("mobile menu", "does not open");
    // "Visible" is not enough: an ancestor with a filter or transform confines
    // a fixed panel to its own box, leaving a menu one header-bar tall.
    const panel = await page.evaluate(() => [document.querySelector("[role=dialog]")?.getBoundingClientRect().height ?? 0, window.innerHeight]);
    if (panel[0] < panel[1] - 1) fail("mobile menu", `panel is ${Math.round(panel[0])}px tall on a ${panel[1]}px screen`);
    for (let i = 0; i < 12; i += 1) await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]")));
    if (!inside) fail("mobile menu", "focus escaped the open menu");
    await page.keyboard.press("Escape");
    if (await dialog.isVisible()) fail("mobile menu", "does not close on Escape");
    const back = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    if (back !== "Open menu") fail("mobile menu", `focus did not return to the menu button (${back})`);
    await page.close();
  }

  // Certificate viewer: opens as a modal, is audited open, closes on Escape.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/en/about`);
    const trigger = page.locator("#certifications button[aria-haspopup=dialog]").first();
    await trigger.click();
    const dialog = page.locator("dialog[open]");
    if (!(await dialog.isVisible())) fail("certificate viewer", "does not open");
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")));
    if (!inside) fail("certificate viewer", "focus is not inside the open dialog");
    await page.evaluate((src) => {
      (0, eval)(src);
    }, axeSource);
    const violations = await page.evaluate(async (tags) => {
      // @ts-expect-error injected
      const r = await window.axe.run(document.querySelector("dialog[open]"), { runOnly: { type: "tag", values: tags } });
      return r.violations.map((v) => `${v.id} x${v.nodes.length}`);
    }, TAGS);
    for (const v of violations) fail("certificate viewer", `axe: ${v}`);
    await page.keyboard.press("Escape");
    if ((await page.locator("dialog[open]").count()) > 0) fail("certificate viewer", "does not close on Escape");
    const back = await page.evaluate(() => document.activeElement?.getAttribute("aria-haspopup"));
    if (back !== "dialog") fail("certificate viewer", "focus did not return to the certificate");
    await page.close();
  }

  // Quote form: validation and machine preselection.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/en/equipment/mobile-cranes/all-terrain-crane-100t`);
    await page.getByRole("link", { name: "Get a quote for this machine" }).click();
    await page.waitForURL(/\/en\/contact/);
    await page.waitForTimeout(300);
    const selected = await page.locator("select[name=equipment]").inputValue();
    if (selected !== "all-terrain-crane-100t") fail("quote form", `machine not preselected (got "${selected}")`);

    const popups = [];
    page.on("popup", (p) => popups.push(p));
    await page.getByRole("button", { name: "Send on WhatsApp" }).click();
    // Scoped to the form: Next.js adds its own role="alert" route announcer to
    // every page, so an unscoped query matches two elements.
    const alertText = await page.locator("form [role=alert]").textContent({ timeout: 3000 }).catch(() => null);
    if (!alertText) fail("quote form", "empty submit shows no error summary");
    const focusedAlert = await page
      .waitForFunction(() => document.activeElement?.closest("form")?.querySelector("[role=alert]") === document.activeElement, null, { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (!focusedAlert) fail("quote form", "error summary is not focused");
    if (popups.length > 0) fail("quote form", "opened WhatsApp despite missing required fields");

    await page.getByLabel("Your name").fill("Faisal Al-Otaibi");
    await page.getByLabel("Phone number").fill("055 123 4567");
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByRole("button", { name: "Send on WhatsApp" }).click()]);
    const target = popup.url();
    const text = new URL(target).searchParams.get("text") ?? "";
    if (!/^https:\/\/(wa\.me|api\.whatsapp\.com)/.test(target)) fail("quote form", `WhatsApp opened ${target.slice(0, 60)}`);
    if (!text.includes("Faisal Al-Otaibi") || !text.includes("100 Tonne All-Terrain Crane")) fail("quote form", "message does not carry the name and machine");
    await page.close();
  }

  await browser.close();

  console.log(`Audited ${audited} page renders (WCAG 2.2 A + AA, EN and AR, desktop and phone) plus motion, menu and form behaviour.`);
  if (failures.length) {
    console.log(`\n${failures.length} problem(s):`);
    for (const f of failures) console.log(`  FAIL  ${f}`);
    process.exitCode = 1;
  } else {
    console.log("PASS  no violations");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
