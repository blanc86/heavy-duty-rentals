import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/lib/db/schema/platform";

/**
 * Business configuration.
 *
 * Company name, VAT number, contact details, cancellation tiers and deposit
 * rules are DATA, editable by a non-technical admin — the brief's explicit
 * "do not bury these in code" requirement. Code only supplies the fallback
 * used before the first seed.
 *
 * Every default below is a clearly-marked DEMO PLACEHOLDER. Nothing here
 * asserts a real company detail, a real certification, or a real statistic.
 */

export interface BusinessSettings {
  companyNameEn: string;
  companyNameAr: string;
  vatNumber: string;
  crNumber: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  addressEn: string;
  addressAr: string;
  /** Cancellation tiers, evaluated most-notice-first. */
  cancellationTiers: { minHoursNotice: number; refundPercent: number }[];
  termsVersion: string;
  /** Displayed as "operating since"; a placeholder until the business sets it. */
  foundedYear: number | null;
}

const DEFAULTS: BusinessSettings = {
  companyNameEn: "Heavy Duty Rentals",
  companyNameAr: "هيفي ديوتي للتأجير",
  vatNumber: "300000000000003",
  crNumber: "1010000000",
  phone: "+966 50 000 0000",
  emergencyPhone: "+966 50 000 0000",
  email: "info@example.com",
  addressEn: "Demo address, Riyadh, Saudi Arabia",
  addressAr: "عنوان تجريبي، الرياض، المملكة العربية السعودية",
  cancellationTiers: [
    { minHoursNotice: 168, refundPercent: 100 },
    { minHoursNotice: 72, refundPercent: 75 },
    { minHoursNotice: 24, refundPercent: 50 },
    { minHoursNotice: 0, refundPercent: 0 },
  ],
  termsVersion: "1.0",
  foundedYear: null,
};

const SETTING_KEYS = Object.keys(DEFAULTS) as (keyof BusinessSettings)[];

/**
 * Cached for the process lifetime of a request batch. Settings change rarely
 * and are read on nearly every page; re-querying per component would be a
 * needless N+1 across the whole site.
 */
let cache: { value: BusinessSettings; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getBusinessSettings(): Promise<BusinessSettings> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.value;

  try {
    const rows = await db
      .select({ key: settings.key, valueJson: settings.valueJson, isSecret: settings.isSecret })
      .from(settings)
      .where(inArray(settings.key, SETTING_KEYS));

    const value = { ...DEFAULTS };
    for (const row of rows) {
      // A secret setting is never surfaced through this read path, even to an
      // admin UI. Secrets are consumed server-side by the module that needs them.
      if (row.isSecret) continue;
      if (SETTING_KEYS.includes(row.key as keyof BusinessSettings)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous settings map; keys are validated against SETTING_KEYS above
        (value as any)[row.key] = row.valueJson;
      }
    }

    cache = { value, loadedAt: Date.now() };
    return value;
  } catch {
    // A settings-table failure must not take the whole site down; the site
    // renders with documented placeholders instead.
    return DEFAULTS;
  }
}

export function invalidateSettingsCache(): void {
  cache = null;
}

/**
 * Refund percentage for a cancellation, given notice.
 *
 * Business-authored tiers rather than an asserted statutory window: Saudi
 * consumer return rules for GOODS do not map cleanly onto rental SERVICES, and
 * we are not going to invent a legal requirement (docs/research.md §7).
 */
export function refundPercentForNotice(
  tiers: BusinessSettings["cancellationTiers"],
  hoursNotice: number,
): number {
  const sorted = [...tiers].sort((a, b) => b.minHoursNotice - a.minHoursNotice);
  for (const tier of sorted) {
    if (hoursNotice >= tier.minHoursNotice) return tier.refundPercent;
  }
  return 0;
}

export { DEFAULTS as DEFAULT_BUSINESS_SETTINGS };
