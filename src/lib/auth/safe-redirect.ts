import type { Locale } from "@/lib/i18n/config";

/**
 * Where a user may be sent after signing in.
 *
 * The destination arrives from `?next=` in the URL, so it is attacker-supplied:
 * a phishing link can put anything there, and the victim sees a genuine login
 * on the real domain before being handed onward. The rule is that only a
 * same-origin, locale-prefixed path is ever honoured; anything else falls back
 * to the account page.
 *
 * This was an inline expression inside `loginAction`, which meant the one rule
 * standing between a legitimate login and an open redirect could not be
 * asserted on by anything. It is a named function with its own tests now, so a
 * bypass is a failing test rather than a discovery.
 *
 * What each guard is for:
 *   - the leading `/` and locale segment reject absolute URLs outright, so
 *     `https://evil.example` never matches
 *   - the explicit `//` check rejects protocol-relative URLs, which a browser
 *     resolves as off-site even though they look like paths
 *   - the backslash check rejects `/\evil.example`, which some browsers
 *     normalise to `//evil.example`
 *   - a control character cannot appear in a path and is a smuggling attempt
 */
export function safeLoginRedirect(target: string | undefined, locale: Locale): string {
  const fallback = `/${locale}/account`;
  if (!target) return fallback;

  if (target.startsWith("//")) return fallback;
  if (target.includes("\\")) return fallback;
  // A control character cannot legitimately appear in a path; its presence
  // is a header- or path-smuggling attempt. Checked by code point rather
  // than a regex literal, which is easy to mangle and hard to read.
  for (const ch of target) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  if (!/^\/[a-z]{2}(\/|$)/.test(target)) return fallback;

  return target;
}
