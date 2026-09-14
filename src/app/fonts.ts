import { Barlow, Barlow_Condensed, IBM_Plex_Sans_Arabic } from "next/font/google";

/**
 * Typefaces.
 *
 * Barlow is a grotesk drawn from California highway signage — rational,
 * mechanical and very legible at a distance, which is the register of plant
 * data plates and site signs. The condensed width sets headings and long
 * machine names ("200 Tonne All-Terrain Crane") without wrapping on a phone.
 *
 * IBM Plex Sans Arabic is an engineered Arabic sans with the same technical
 * temperament, so the two languages read as one company.
 *
 * next/font downloads these at BUILD time and serves them from this origin:
 * no request to Google from a visitor's browser, no third-party host in the
 * CSP, and metric-matched fallbacks so text does not shift when they load.
 * Only the weights actually used are included.
 */
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-barlow-condensed",
});

export const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-barlow",
});

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-plex-arabic",
});
