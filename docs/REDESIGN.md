# Redesign — from booking platform to lead-generation site

**Date:** 2026-09-14
**Branch:** `marketing-redesign`
**Previous platform:** preserved at git tag `booking-platform-final`

The site no longer takes bookings, payments or sign-ins. It exists to turn a
visitor with a job into a phone call, a WhatsApp conversation or an emailed
quote request, and to rank for the searches that bring that visitor in.

This document records why the site looks and works the way it does: what the
competitor review found, what was adopted, what was deliberately done better,
and what the business still has to supply before launch.

---

## 1. Why the booking platform was replaced

Heavy equipment is not bought like a hotel room. A 100 t crane hire depends on
the lift plan, ground conditions, site access, permits and an operator's
availability — questions a person answers in a conversation. The earlier
research ([research.md](research.md)) bet that moving that transaction online
would be a differentiator. In practice it put a checkout between the buyer and
the conversation they wanted, and required online payments, e-invoicing and
account security the business did not need to take on to win work.

In the Saudi market specifically, WhatsApp is where contractors already talk to
suppliers. Over nine in ten Saudi internet users use it, and a message reaches a
person where a form submission reaches an inbox. So the site is built around
three actions — **call, WhatsApp, request a quote** — and every page ends in one
of them.

---

## 2. Competitor review

Sites were reviewed for patterns, not copied. No branding, copy, layout or
imagery was taken from any of them. The contact page screenshot supplied with
the brief (Reliant Rentalz, a Saudi competitor) was treated as a reference for what a contact page
needs, not as a design to reproduce.

| Site | Market | What works | What doesn't |
|---|---|---|---|
| **Reliant Rentalz** | KSA, Riyadh | Phone visible at the top; floating WhatsApp button; contact page leads with the methods rather than a form | Generic hero headline with no place or buyer; image carousel; "why choose us" claims with nothing behind them; no trust evidence |
| **Planet Sky Arabia** | KSA | Per-machine enquiry buttons | Headline could belong to any company anywhere; the only CTA is at the bottom of the page; no phone number in view; every machine's enquiry lands on the same generic contact page with no context; no city or region on the page |
| **Alshmoukh** | KSA, Arabic-first (ranks for تأجير معدات ثقيلة الرياض) | Uses the colloquial Arabic names buyers actually search (ونش, شيول, بوكلين); WhatsApp order button on every machine; commercial registration and VAT numbers shown; a page per city; FAQ | No structured data; statistics that cannot be checked; city pages that are the same text with the city name swapped |
| **Byrne Equipment Rental** | GCC | A clear rent-versus-buy framing; "Get a quote" as the primary action; regional phone numbers; named testimonials and industries served | Heavy corporate navigation before the buyer reaches a machine |
| **Kennards Hire** | Australia | Browse by category or by the job to be done; branches treated as a local asset; named, local testimonials; copy about outcomes rather than features | Built for a large branch network and e-commerce — not a model to copy wholesale |
| **Tamimi Rentals** | KSA, Eastern Province | Provenance and history; dedicated safety and quality pages; named crane models; an emergency number | English only; no specifications; no structured data |

General conversion research that shaped decisions:

- **The first mobile screen must say what, where and how to reach you.** A
  visitor who has to scroll to learn whether you serve their city leaves.
- **Sticky contact controls in the thumb zone convert** — but Baymard's testing
  shows floating elements that cover content cost more than they gain, so the
  bar must reserve its own space.
- **B2B hire has several stakeholders** (site engineer, procurement, project
  manager). Information has to be forwardable: specs, what is included, what
  the site must provide.
- **Every required form field is a reason to leave.**

---

## 3. What was adopted

| Pattern | Seen at | Where it is |
|---|---|---|
| WhatsApp on every machine, with a floating chat button | Reliant, Alshmoukh | Machine cards, machine pages, contact band, desktop floating button, mobile bar |
| Phone number always reachable | Reliant, Tamimi | Header (desktop), mobile bar, hero, footer, contact page |
| "Get a quote" as the primary CTA | Byrne | Header button on every page; hero; every contact band |
| Browse by category first | Kennards, Byrne | Home page categories; `/equipment` jump navigation |
| Colloquial Arabic equipment names | Alshmoukh | `alsoKnownAs` on every category, shown on its category page |
| A page per service city | Alshmoukh, Kennards | `/service-areas/*` |
| FAQ | Alshmoukh | `/faq`, plus a subset on the home, category and city pages |
| CR and VAT numbers as trust signals | Alshmoukh | Footer and About page — shown automatically once supplied |
| Named models | Tamimi | "Typical model … or equivalent" on each machine page |

---

## 4. What was done better, and why

**Every WhatsApp message arrives with context.** A floating chat button starts a
blank conversation, and Planet Sky Arabia's per-machine enquiries all land on
the same contact page. Here a machine page's button opens WhatsApp with *"Hello,
I'd like a quote for the 100 Tonne All-Terrain Crane"* already written, followed
by prompts for site location, start date, rental period and operator; the quote
form composes the whole request into one message. The business receives a qualified lead
instead of "hi, price?".

**The quote form has no backend, and says so.** There is nothing to receive a
submission, so rather than a form that pretends to send, it hands the composed
message to the visitor's own WhatsApp or email app. Only name and phone are
required.

**A quote checklist on every machine page.** It tells the buyer what to have
ready (site location, dates, duration, operator, and lift details for cranes).
That pre-qualifies the enquiry and makes the first call shorter.

**Specifications and responsibilities, not just photos.** Each machine lists its
key specs, what the hire includes and what it does not, and the About page sets
out what the site must provide. Competitors leave this to the phone call; a
procurement manager comparing suppliers can forward this page instead.

**City pages with real planning advice.** Instead of one paragraph with the city
name swapped, each city carries a note specific to working there — restricted
heavy-vehicle hours in central Riyadh, gate passes and permit-to-work systems on
Dammam's industrial and port sites, shutdown schedules in Jubail Industrial
City. Swapped-name pages are thin content in Google's terms and help nobody.

**Bilingual done properly.** Arabic is a full locale with its own URLs, translated
guide slugs, right-to-left layout, `hreflang` pairs and Arabic plurals — not an
English site with a translation widget. None of the English-only competitors can
rank for Arabic searches; the Arabic-only one cannot rank for English ones.

**Structured data.** Neither Saudi competitor checked for it (Alshmoukh, Tamimi)
had any. This site has
Organization (LocalBusiness once an address exists), WebSite, BreadcrumbList,
Service per machine, ItemList, FAQPage and Article. Placeholder contact details
are never emitted into it.

**No fabricated trust.** No invented client counts, years, reviews or
certifications — several competitors publish numbers that cannot be checked.
Why-choose-us points describe how the service works, which the business can
stand behind. The CR number, VAT number and founding year appear only once the
business supplies them. There is no testimonial section: one should be added
when real, permitted quotes exist, not before.

**Speed.** Every page is static HTML served from a CDN, with no database, no
client-side data fetching and three runtime dependencies. On a throttled mid-range
phone over slow 4G the home page's Largest Contentful Paint is about one second
with zero layout shift.

**Accessibility.** WCAG 2.2 AA in both languages, checked by axe on a page of
each main template at desktop and phone sizes, with Lighthouse accessibility at
100 on the pages audited.

---

## 5. Design direction

Industrial, not construction-site cliché. Steel greys with a single safety
yellow (`#F4B000`) used for the primary action and focus rings, and a WhatsApp
green dark enough for white text to pass contrast. Barlow Condensed for
headings — the narrow, sturdy letterforms of equipment plates and signage — with
Barlow for body text and IBM Plex Sans Arabic for Arabic.

The one distinctive element is the **rating plate**: each machine's headline
capacity (100 t, 26 m, 500 kVA) is shown as a stamped plate, the way it appears
on the machine itself. It makes a grid of very different machines comparable at
a glance.

The hero replaces the old black panel with a photograph under a steel scrim that
runs from the reading edge (left in English, right in Arabic), so the text stays
readable whatever the photo does. The old feature panel is now a slow,
continuously moving strip of the fleet. It pauses on hover and focus, and under
reduced motion becomes a still, scrollable row.

---

## 6. Images

Every image is licensed for commercial use — Unsplash License, CC0, CC BY-SA or
public domain — and credited on `/image-credits`. The manifest
(`src/content/images.json`) records source, author and licence for each one.
`npm run images:prepare` rebuilds them all, every equipment photo to the same
1600 × 1200 frame so a grid of cards reads as one set.

They are **illustrative**, and several show the livery of the company that owns
the machine — that is what real rental fleets look like, and free photography of
unbranded machines barely exists:

| Photo | Visible third-party name |
|---|---|
| 50 t all-terrain crane | Kanson Crane Service |
| 100 t all-terrain crane | HANYS |
| 200 t all-terrain crane | anipsotiki |
| 26 m boom lift | ALL |
| 15 t boom truck | RomeCrane |
| 60 t low-bed trailer | AZZONA |

Manufacturer names (Liebherr, Volvo, JCB, Cat and so on) are not a concern.
Where a photo also showed that company's **phone number, web address or
registration**, those are blurred out by the `redact` regions in the manifest —
a legible third-party number on a site whose job is "call us" is a wrong number
waiting to be dialled.

An earlier pick for the About and contact page banners showed another rental
company's name across a whole yard of machines — on the About page, right beside
the description of this business's own fleet. It was dropped: the About page now
shows the Riyadh skyline, and the contact page header the excavators at dusk.

All equipment photos should be replaced with photographs of the business's own
machines before launch.

---

## 7. Needed from the business before launch

Run `npm run content:check` for the live list. Placeholders are visibly fake
(`+966 5X XXX XXXX`, `info@example.com`) so none can be mistaken for real.

| Item | Where it appears |
|---|---|
| Phone number | Every Call button, header, footer, contact page, mobile bar |
| WhatsApp number | Every WhatsApp button and the floating chat button |
| Email address | Footer, contact page, quote form's email option |
| Office or yard address | Contact page; switches structured data to LocalBusiness |
| Google Maps link | "Get directions" on the contact page |
| Business hours | Contact page |
| Registered company name | Footer, legal pages |
| Commercial registration (CR) number | Footer, About page |
| VAT number | Footer, About page |
| Year operations began | About page, only if the business wants it shown |
| Confirmation of the machine list | `src/content/catalog.ts` — remove anything not actually rented |
| Confirmation of service cities | `SERVICE_AREAS` in `src/content/business.ts` |
| Customer testimonials or client logos | With written permission to publish |
| Photographs of the business's own machines | Replace the illustrative images |
| Logo | `src/components/layout/logo.tsx` is a placeholder mark |
| Domain | Set `NEXT_PUBLIC_SITE_URL` |

The privacy policy and terms (`src/content/legal.ts`) are a plain-language
starting point and **must be reviewed by a Saudi lawyer**, particularly against
the PDPL, before launch.
