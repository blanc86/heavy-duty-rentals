# Deploying

The site is fully static: every page is generated at build time and served from
a CDN. There is no database, no API and no server-side secret. It is deployed on
Vercel, but any host that runs `next start` or serves a Next.js build will do.

---

## 1. Before the first public launch

1. **Fill in the business details.** `npm run content:check` lists every
   placeholder still in `src/content/business.ts`. Placeholders are visibly fake
   (`+966 5X XXX XXXX`, `info@example.com`) — do not launch with any of them.
2. **Set the real domain** in `NEXT_PUBLIC_SITE_URL` (§2).
3. **Have the privacy policy and terms reviewed** (`src/content/legal.ts`) by a
   Saudi lawyer.
4. **Replace the illustrative photographs** with the business's own — see
   [REDESIGN.md §6](REDESIGN.md#6-images).

---

## 2. Environment

One variable:

| Variable | Example | Used for |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.example.sa` | Canonical URLs, `hreflang`, the sitemap, Open Graph, structured data |

It is read **at build time**, so changing it needs a new deployment, not just a
restart. Unset, it falls back to `https://heavy-duty-rentals.vercel.app`.

Set it without a trailing slash, and set it to the domain visitors actually land
on. If `example.sa` redirects to `www.example.sa`, use the `www` form, or every
canonical tag points at a redirect.

### Left over from the booking platform

The Vercel project still has the booking platform's environment variables
(`DATABASE_URL` and the `EU_*` Neon variables, `ENCRYPTION_KEY`, `APP_SECRET`,
`PAYMENT_PROVIDER`, `DEMO_MODE`, `EMAIL_FROM` and so on) and the Neon database it
used. Nothing reads them any more. They can be deleted, along with the database,
once nobody needs the old platform's data — the code is preserved at the
`booking-platform-final` tag.

---

## 3. Deploy

```bash
npx vercel deploy --prod
```

`vercel.json` pins functions to Frankfurt (`fra1`). Pages are static and served
from the edge nearest the visitor regardless; the only code that runs in a
region is `src/proxy.ts`, which redirects the bare `/` to `/en` or `/ar`.

Automatic deploys from GitHub need the Vercel GitHub app installed on the
repository, which only the repository owner can do: Vercel dashboard → the
project → Settings → Git → Connect.

---

## 4. Verify the deployment, not just the build

A green build says the pages compiled. These say the site works:

```bash
APP_URL="https://<host>" npm run verify:routes
```

```bash
APP_URL="https://<host>" npm run verify:a11y
```

`verify:routes` crawls every URL in the sitemap and checks titles, descriptions,
canonicals, `hreflang`, structured data, every internal link and image, the
format of every `tel:`, WhatsApp and `mailto:` link, the legacy redirects and the
security headers.

`verify:a11y` runs axe (WCAG 2.2 A and AA) on each template in both languages at
desktop and phone sizes, and checks horizontal overflow, console errors, reduced
motion, the mobile menu's focus trap and the quote form.

`verify:a11y` needs Chromium: `npx playwright install chromium` once.

---

## 5. Headers and caching

Set in `next.config.ts`, so they travel with the code to any host:

- **Content-Security-Policy** without a nonce. A nonce would force every page to
  render per request, which is exactly what a static site avoids. So scripts are
  limited to the site's own origin plus inline scripts, which Next.js needs to
  hydrate a static page.
- **HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy,
  Permissions-Policy, COOP.**
- **`/images/*` is cached for a year, immutable.** That is safe only because
  every image file name carries a hash of its content; `npm run images:prepare`
  gives a changed photo a new name. Never replace a file in `public/images` by
  hand under the same name.

---

## 6. Old URLs

The booking platform's URLs (`/book`, `/booking/*`, `/login`, `/account`,
`/admin`, `/quote`, `/compare`, `/equipment/item/*` and others) permanently
redirect (308) to their nearest equivalent, so bookmarks and any indexed links
still land somewhere useful. The list is `legacyRedirects()` in `next.config.ts`;
`verify:routes` checks it.
