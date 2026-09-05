import Link from "next/link";
import type { AuthenticatedActor } from "@/lib/auth/session";
import type { Dictionary } from "@/lib/i18n";
import { localePath, otherLocale, type Locale } from "@/lib/i18n/config";
import { LocaleSwitch } from "./locale-switch";
import { SignOutButton } from "./sign-out-button";
import { MobileNav } from "./mobile-nav";

/**
 * Site header.
 *
 * A Server Component: the navigation, the sign-in state and the language
 * switch are all rendered on the server, so the header costs no JavaScript.
 * Only the mobile drawer is a client island.
 */
export function SiteHeader({
  locale,
  dict,
  actor,
  pathname,
  search = "",
}: {
  locale: Locale;
  dict: Dictionary;
  actor: AuthenticatedActor | null;
  pathname: string;
  /** Current query string, including the leading "?". Preserved across the
      language switch so a configured booking survives the change. */
  search?: string;
}) {
  const nav = [
    { href: localePath(locale, "/equipment"), label: dict.nav.equipment },
    { href: localePath(locale, "/locations"), label: dict.nav.locations },
    { href: localePath(locale, "/how-it-works"), label: dict.nav.howItWorks },
    { href: localePath(locale, "/safety"), label: dict.nav.safety },
    { href: localePath(locale, "/guides"), label: dict.nav.guides },
  ];

  // The language switch must land on the SAME page in the other locale, not
  // dump the user on the homepage — the single most common i18n failure.
  const target = otherLocale(locale);
  // The query string rides along: /en/book/x?start=...&branch=... must not
  // become /ar/book/x, which would throw away the customer's configuration.
  const switchPath = pathname.startsWith(`/${locale}`)
    ? `/${target}${pathname.slice(locale.length + 1)}`
    : `/${target}`;
  const switchHref = `${switchPath}${search}`;

  return (
    <header className="sticky top-0 z-40 border-b border-steel-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <Link
          href={localePath(locale, "/")}
          className="flex shrink-0 items-center gap-2"
          aria-label={dict.meta.siteName}
        >
          <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded bg-amber-500">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 20h18M6 20V9l6-5v16M12 9h7v11" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="hidden text-sm font-bold leading-tight text-steel-950 sm:block">
            {dict.meta.siteName}
          </span>
        </Link>

        <nav aria-label={dict.a11y.mainNavigation} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-[--radius-control] px-3 py-2 text-sm font-medium text-steel-700 transition-colors hover:bg-steel-100 hover:text-steel-950"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitch href={switchHref} label={dict.nav.switchLanguage} targetLocale={target} />

          {actor ? (
            <>
              {actor.isPlatformAdmin && (
                <Link
                  href={localePath(locale, "/admin")}
                  className="hidden rounded-[--radius-control] px-3 py-2 text-sm font-medium text-steel-700 hover:bg-steel-100 sm:block"
                >
                  {dict.nav.admin}
                </Link>
              )}
              <Link
                href={localePath(locale, "/account")}
                className="hidden rounded-[--radius-control] border border-steel-300 px-3 py-2 text-sm font-medium text-steel-800 hover:bg-steel-100 sm:block"
              >
                {dict.nav.dashboard}
              </Link>
              <div className="hidden sm:block">
                <SignOutButton locale={locale} label={dict.nav.logout} />
              </div>
            </>
          ) : (
            <Link
              href={localePath(locale, "/login")}
              className="hidden rounded-[--radius-control] px-3 py-2 text-sm font-medium text-steel-700 hover:bg-steel-100 sm:block"
            >
              {dict.nav.login}
            </Link>
          )}

          {/* The primary CTA is present in the header on every page: the most
              common entry point is a Google landing on a deep equipment page,
              and the next action must never be more than one tap away. */}
          <Link
            href={localePath(locale, "/equipment")}
            className="inline-flex min-h-[2.5rem] items-center rounded-[--radius-control] bg-amber-500 px-3 text-sm font-semibold text-steel-950 transition-colors hover:bg-amber-400 sm:px-4"
          >
            {dict.equipment.checkAvailability}
          </Link>

          <MobileNav
            locale={locale}
            items={nav}
            accountLabel={actor ? dict.nav.dashboard : dict.nav.login}
            accountHref={localePath(locale, actor ? "/account" : "/login")}
            openLabel={dict.a11y.openMenu}
            closeLabel={dict.common.close}
            menuLabel={dict.nav.menu}
            signOut={
              actor ? (
                <SignOutButton
                  locale={locale}
                  label={dict.nav.logout}
                  className="w-full rounded-[--radius-control] px-3 py-3 text-center text-sm font-medium text-steel-700 hover:bg-steel-100"
                />
              ) : undefined
            }
          />
        </div>
      </div>
    </header>
  );
}
