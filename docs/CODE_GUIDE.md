# How this code works

An orientation for someone about to change it: where things are, how to make the
common changes, and the parts that will bite you.

- [REDESIGN.md](REDESIGN.md) — why the site looks and works the way it does, and
  what the business still has to supply
- [DEPLOYMENT.md](DEPLOYMENT.md) — environment, deploying and verifying
- [research.md](research.md) — the original market research (the booking
  platform it argued for has since been replaced)

---

## 1. The one-paragraph version

A bilingual (English/Arabic) marketing site for an equipment-rental business. It
shows the fleet, answers the buyer's questions, and gets them to call, message on
WhatsApp or send a quote request. There is no database, no API, no login and no
form backend: every page is generated at build time from TypeScript content
files, and every "send" hands a prefilled message to the visitor's own phone,
WhatsApp or email app.

---

## 2. Where things are

```
src/
  content/              THE CONTENT. Most changes happen here.
    business.ts           phone, WhatsApp, email, address, CR/VAT, service areas
    catalog.ts            categories and machines, with specs
    specs.ts              spec labels, units and formatting
    certifications.ts     certificates (samples until real scans are supplied)
    projects.ts           completed projects (samples until real ones are supplied)
    faqs.ts  guides.ts  legal.ts
    images.json           every photo: source, author, licence, crop, alt text
    images.generated.ts   GENERATED from images.json — do not edit
  lib/
    i18n/dictionaries/    en.ts and ar.ts: every string in the interface
    catalog.ts            lookups and paths over the catalogue
    contact.ts            tel:, wa.me and mailto: links
    site.ts               SITE_URL, localized hrefs, canonical + hreflang
    seo/json-ld.ts        structured data builders
  app/
    [locale]/             every page, once per language
    sitemap.ts robots.ts
  components/
    layout/               header, footer, mobile menu, mobile contact bar
    equipment/            machine card, rating plate, spec table, fleet strip
    marketing/sections.tsx  how it works, why us, FAQ list, contact band…
    trust/                certifications section and viewer, project card
    contact/enquiry-form.tsx  the quote form
    ui/index.tsx          buttons, container, icons
  proxy.ts                redirects bare "/" to /en or /ar
public/
  brand/                  the TechSteps logo, extracted from the supplied artwork
scripts/                  image build, content check, route and a11y audits
tests/                    content integrity, contact links, SEO
```

---

## 3. Common changes

### Put in the real contact details

Edit `BUSINESS` in `src/content/business.ts`, then remove each filled field from
`PLACEHOLDER_FIELDS` in the same file. `npm run content:check` lists what is
left.

Phone and WhatsApp each have a `display` form (what people read) and `digits`
(international format, no `+`, used in `tel:` and `wa.me` links). Set both.

Some details switch features on: an `address` turns the structured data into a
`LocalBusiness`; `mapsUrl` adds "Get directions" to the contact page; `hours`,
`crNumber`, `vatNumber` and `foundedYear` each appear once set. Placeholder
values are never written into structured data.

### Add or remove a machine

1. Add an entry to `MACHINES` in `src/content/catalog.ts`, with its category,
   bilingual name and description, specs, and what the hire includes.
2. Add an `equipment/<slug>` entry to `src/content/images.json` with the photo's
   source, author, licence and alt text in both languages.
3. `npm run images:prepare`, then `npm test`.

The machine page, card, category listing, fleet strip, sitemap entry, quote-form
option and structured data all follow from the catalogue. A test fails if a
machine has no photo.

Removing a machine that was ever live: also add a redirect from its old URL in
`legacyRedirects()` in `next.config.ts`, so indexed links do not 404.

### Change a photo

Edit its entry in `images.json` and run `npm run images:prepare`. The script
downloads the source (cached in `.image-cache/`), crops it to the standard frame,
blurs any `redact` regions, writes a content-hashed file, removes the old one and
regenerates `images.generated.ts` and the social sharing image.

- `position`: `"attention"` lets sharp find the subject; or a keyword such as
  `"center"`.
- `extract`: a region of the source as fractions (0–1), when the automatic crop
  frames sky instead of the machine.
- `redact`: rectangles, in pixels of the finished frame, to blur — for another
  company's phone number or web address painted on a machine.

Only use photos whose licence allows commercial use, and record the author and
licence: `/image-credits` is generated from the manifest and the tests check it.

### Replace a sample certificate or project

Both files explain the steps at the top: `src/content/certifications.ts` and
`src/content/projects.ts`. In short, fill in the real details, add the scan or
photograph, and set `sample: false`. The "Sample" label and the specimen
watermark disappear by themselves, and the tests check that a real certificate
has its issuer, number, expiry date and file.

Only mark an entry `sample: false` when it describes something real.

### The logo

`public/brand/` holds the logo in each form the site uses: `logo-en` and
`logo-ar` (each language's half), `-on-dark` versions with white ink, `mark`,
and `logo-full` (bilingual, used for the sharing image and `logo.png`). They
are vector extractions of the supplied artwork; to change the logo, replace
these files and run `npm run images:prepare` to rebuild the sharing image. The
favicon is `src/app/icon.svg`.

### Change wording

Interface strings are in `src/lib/i18n/dictionaries/en.ts` and `ar.ts`. The
English file is the type: a key missing from the Arabic file is a compile error,
not an English string on an Arabic page. Content (machines, FAQs, guides) carries
both languages side by side in `src/content`.

Claims must be ones the business can stand behind. `tests/content.test.ts` fails
if the interface copy uses phrases that tend to creep in unsupported ("best
price", "guarantee", "within 24 hours" and similar). If a claim becomes true,
change the test deliberately.

### Add a service city

Add it to `SERVICE_AREAS` in `src/content/business.ts`, with a `planning` note
in both languages that is genuinely specific to working there. A test rejects a
note that is another city's note with only the name changed.

---

## 4. Rendering

Every page is static. `[locale]` pages export `generateStaticParams` and
`dynamicParams = false`, so an unknown slug is a 404 at the edge rather than a
server render. Keep it that way:

- **Do not read `searchParams`, `cookies()` or `headers()` in a page.** Any of
  them opts the page out of static generation. The quote form reads
  `?equipment=` in a client effect after hydration for exactly this reason.
- **Do not add a CSP nonce.** Nonces force per-request rendering. The CSP in
  `next.config.ts` allows inline scripts instead.
- `proxy.ts` (Next 16's name for middleware) matches only `/`. Widening its
  matcher runs it on every page and asset request.

---

## 5. Things that will bite you

**Arabic slugs arrive percent-encoded.** Guide slugs are translated, and Next.js
passes dynamic segments to the page still encoded. Decode with
`decodeSlugParam` from `src/lib/routing.ts` before looking up content. The
language switch maps each guide's English slug to its Arabic one; a new guide
needs both.

**Tailwind v4 syntax.** Design tokens live in `@theme` in `globals.css` and
become utilities directly: `rounded-control`, `bg-machine-500`, `text-h1`.
The v3 form `rounded-[--radius-control]` silently does nothing.

**Conflicting utilities do not merge.** `cn()` only joins class names. Passing
`inline-flex` to a component that already has `hidden` leaves both, and whichever
comes later in the stylesheet wins — which is why the header's quote button hides
on a wrapper `div` rather than on the button.

**Arabic heading fonts are unlayered CSS.** `:lang(ar) .font-display` sits
outside `@layer` so it beats the `font-display` utility. Moving it into a layer
brings back Latin letterforms on Arabic headings.

**Numbers inside Arabic text.** Wrap phone numbers, measurements and years in
`.ltr-nums`, or bidi reordering turns `+966 5…` into `966 5…+`.

**Image loading.** In Next 16 `priority` is deprecated. Use `preload` on the one
image that is the page's Largest Contentful Paint (`SiteImage preload`) and
`eager` for other images visible on arrival. Everything else lazy-loads.

**Never hand-replace a file in `public/images`.** Images are cached for a year as
immutable; a changed photo needs a new file name, which the image script gives it.

**No filter, transform or backdrop-filter on the header.** Any of them makes
the header the containing block for `position: fixed` descendants, and the
full-screen mobile menu inside it shrinks to the header's height.

**The mobile contact bar reserves its own space.** `<body>` has bottom padding
below the `md` breakpoint so the fixed bar never covers the footer. A new fixed
element at the bottom needs the same.

**The fleet strip is duplicated for the loop.** The second copy is `aria-hidden`
and `inert` so screen readers and keyboard users meet each machine once. Under
`prefers-reduced-motion` it stops, hides the copy and becomes a scrollable row.

---

## 6. Checks

```bash
npm run verify
```

Typecheck, lint and unit tests. Then, against a running build (`npm run build`
then `npm run start`):

```bash
APP_URL=http://localhost:3000 npm run verify:routes
```

```bash
APP_URL=http://localhost:3000 npm run verify:a11y
```

`npm run verify:reachable` lists exports nothing imports — informational, for
spotting dead code.
