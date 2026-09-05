/**
 * Route parameter decoding.
 *
 * Next.js hands dynamic segments to the page **percent-encoded**, not decoded.
 * For an ASCII kebab-case slug that is invisible — "all-terrain-crane-50t"
 * encodes to itself — so it only surfaces once a slug contains non-ASCII.
 *
 * This platform has Arabic article slugs, which are translated rather than
 * transliterated (correct for SEO: an Arabic reader searches in Arabic). Every
 * one of them arrived as "%D9%85%D8%A7-..." and matched nothing, so all three
 * Arabic guides 404'd from the day they were seeded, while the guides index
 * happily linked to them.
 *
 * Apply this to any dynamic segment whose value comes from content — a slug an
 * editor can write, in a language that is not English.
 */
export function decodeSlugParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed sequence (a stray "%") throws URIError. The raw value cannot
    // match a real slug either, so hand it back and let the lookup 404 rather
    // than turning a bad URL into a 500.
    return value;
  }
}
