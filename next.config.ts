import type { NextConfig } from "next";
import { MACHINES } from "./src/content/catalog";

/**
 * Content-Security-Policy.
 *
 * This site is statically generated, and a per-request nonce needs a server
 * render for every page view — trading away the CDN delivery that makes the
 * site fast. So the policy is set here, without a nonce, which is the approach
 * the Next.js documentation gives for static pages.
 *
 * 'unsafe-inline' in script-src is required for Next's inline bootstrap
 * scripts. What limits the risk is what the site no longer has: no accounts,
 * no sessions, no forms posting to a server and no user-generated content
 * rendered back. Everything else stays locked down: no third-party script,
 * style or frame sources, no plugins, no framing by other sites, and form
 * submissions only to this origin.
 */
const isDev = process.env.NODE_ENV === "development";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * Old URLs that must keep working.
 *
 * The booking platform this site replaced had its own routes. Some were
 * shared, bookmarked or indexed, so each one lands somewhere useful instead of
 * a 404: booking and quote pages go to contact, accounts and admin to home, and
 * old equipment URLs to the machine's new address. Permanent (308) so search
 * engines transfer the old URL's standing to the new one.
 */
function legacyRedirects() {
  const locale = ":locale(en|ar)";
  return [
    ...MACHINES.map((machine) => ({
      source: `/${locale}/equipment/item/${machine.slug}`,
      destination: `/:locale/equipment/${machine.category}/${machine.slug}`,
      permanent: true,
    })),
    ...MACHINES.map((machine) => ({
      source: `/${locale}/book/${machine.slug}`,
      destination: `/:locale/equipment/${machine.category}/${machine.slug}`,
      permanent: true,
    })),
    // The boom lift's name was corrected from 28 m to its true 26 m class.
    {
      source: `/${locale}/equipment/item/boom-lift-28m`,
      destination: "/:locale/equipment/manlifts/boom-lift-26m",
      permanent: true,
    },
    { source: `/${locale}/booking/:path*`, destination: "/:locale/contact", permanent: true },
    { source: `/${locale}/booking`, destination: "/:locale/contact", permanent: true },
    { source: `/${locale}/quote`, destination: "/:locale/contact", permanent: true },
    { source: `/${locale}/book/:path*`, destination: "/:locale/equipment", permanent: true },
    { source: `/${locale}/compare`, destination: "/:locale/equipment", permanent: true },
    { source: `/${locale}/locations`, destination: "/:locale/service-areas", permanent: true },
    { source: `/${locale}/locations/:slug`, destination: "/:locale/service-areas/:slug", permanent: true },
    { source: `/${locale}/legal/privacy`, destination: "/:locale/privacy", permanent: true },
    { source: `/${locale}/legal/:doc`, destination: "/:locale/terms", permanent: true },
    { source: `/${locale}/how-it-works`, destination: "/:locale", permanent: true },
    { source: `/${locale}/for-contractors`, destination: "/:locale/about", permanent: true },
    { source: `/${locale}/safety`, destination: "/:locale/about", permanent: true },
    { source: `/${locale}/login/:path*`, destination: "/:locale", permanent: true },
    { source: `/${locale}/login`, destination: "/:locale", permanent: true },
    { source: `/${locale}/register`, destination: "/:locale", permanent: true },
    { source: `/${locale}/account/:path*`, destination: "/:locale", permanent: true },
    { source: `/${locale}/account`, destination: "/:locale", permanent: true },
    { source: `/${locale}/admin/:path*`, destination: "/:locale", permanent: true },
    { source: `/${locale}/admin`, destination: "/:locale", permanent: true },
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        // Processed images never change under the same name; let browsers and
        // the CDN keep them for a year.
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/og/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
  async redirects() {
    return legacyRedirects();
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Card, detail, hero and banner widths actually requested by `sizes`.
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2400],
    imageSizes: [80, 160, 240, 320, 480],
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;
