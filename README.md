# TechSteps — تكستيب

The bilingual (English/Arabic) website of Technical Steps for Equipment Rental
Est. (مؤسسة خطوات التقنية لتأجير المعدات), a heavy-equipment rental business in
Saudi Arabia: cranes, excavators, forklifts, access platforms, generators and
low-bed transport. It shows the fleet with specifications and turns visitors
into phone calls, WhatsApp conversations and quote requests.

**Live demo:** <https://heavy-duty-rentals.vercel.app>

> **Not ready for launch yet.** Contact details are placeholders
> (`+966 5X XXX XXXX`, `info@example.com`), the equipment photos are licensed
> stock rather than the business's own machines, and the certificates and
> completed projects are clearly labelled samples. Run `npm run content:check` for the
> list of what is still needed, and see
> [docs/REDESIGN.md §7](docs/REDESIGN.md#7-needed-from-the-business-before-launch).

---

## What it does

- **Every page leads to a conversation.** Call, WhatsApp and Get a quote buttons
  in the header, on every machine, in a contact band at the end of each page, and
  in a fixed bar on phones.
- **WhatsApp messages arrive with context.** A machine page's WhatsApp button
  opens a message already naming the machine; the quote form composes the whole
  request (machine, site, dates, operator) for the visitor to send.
- **The fleet, properly specified.** 18 machines in 14 categories, each with key
  specifications, a typical model, and what the hire does and does not include.
- **Trust, shown rather than claimed.** Certificates presented as documents a
  procurement team can open, and completed projects with the client sector,
  location, figures and machines used. Both are samples until the business
  supplies its own — see [docs/REDESIGN.md §8](docs/REDESIGN.md#8-brand-certifications-and-projects-2026-09-15).
- **Local SEO in both languages.** Arabic is a full locale with its own URLs,
  translated slugs and right-to-left layout. City pages, buying guides, FAQs,
  structured data, `hreflang`, a sitemap.
- **Fast.** Every page is static HTML on a CDN, with three runtime dependencies.

It deliberately has no online booking, payments, accounts or admin area. The
booking platform this replaced is preserved at the git tag
`booking-platform-final`; [docs/REDESIGN.md](docs/REDESIGN.md) explains why it
was replaced and what the competitor review found.

---

## Quick start

Requires Node.js 22 or later. No database, no Docker, no secrets.

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. You are redirected to `/en` or `/ar` based on your
browser's language.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (every page is generated here) |
| `npm run start` | Serve the production build |
| `npm run verify` | Typecheck, lint and unit tests |
| `npm run content:check` | List the business details still missing |
| `npm run images:prepare` | Rebuild every photo from `src/content/images.json` |
| `npm run verify:routes` | Crawl every page: SEO tags, links, images, redirects, headers |
| `npm run verify:a11y` | WCAG 2.2 AA audit in both languages, plus menu, motion and form checks |
| `npm run verify:reachable` | List exports nothing imports |

`verify:routes` and `verify:a11y` run against a running server — set `APP_URL`
to point them at a deployment. `verify:a11y` needs Chromium once:
`npx playwright install chromium`.

---

## Stack

Next.js 16 (App Router, fully static) · React 19 · TypeScript strict ·
Tailwind CSS v4 · Vitest · Playwright + axe-core for audits · sharp for images.

---

## Documentation

- [docs/CODE_GUIDE.md](docs/CODE_GUIDE.md) — where things are, how to make common
  changes (contact details, machines, photos, wording), and the pitfalls
- [docs/REDESIGN.md](docs/REDESIGN.md) — competitor review, what was adopted and
  improved, design direction, image notes, and what the business must supply
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — environment, deploying, verifying a
  deployment
- [docs/research.md](docs/research.md) — the original Saudi market research

---

## Before launch

1. Real contact details, address, hours, CR and VAT numbers in
   `src/content/business.ts`.
2. Confirm the machine list and service cities match what the business offers.
3. Photographs of the business's own machines.
4. Real certificates and completed projects, replacing the samples.
5. `NEXT_PUBLIC_SITE_URL` set to the real domain.
6. Privacy policy and terms reviewed by a Saudi lawyer.
