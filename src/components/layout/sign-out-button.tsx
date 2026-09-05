import { logoutAction } from "@/lib/auth/actions";
import type { Locale } from "@/lib/i18n/config";

/**
 * Sign out.
 *
 * A real <form> POST rather than a link, because a GET that destroys a session
 * can be fired by anything that fetches a URL — a prefetch, an image tag, a
 * link in an email — and would log people out without their asking. The POST
 * goes through a Server Action, so it carries the framework's origin check.
 *
 * `logoutAction` revokes the session server-side before clearing the cookie:
 * dropping the cookie alone would leave a valid token in circulation.
 *
 * This matters more here than on a typical consumer site. Sessions last thirty
 * days, and the people using this share site-office and depot machines — so
 * "how do I get out of this account" has to have an answer on every page.
 */
export function SignOutButton({
  locale,
  label,
  className,
}: {
  locale: Locale;
  label: string;
  className?: string;
}) {
  return (
    <form action={logoutAction.bind(null, locale)}>
      <button
        type="submit"
        className={
          className ??
          "rounded-[--radius-control] px-3 py-2 text-sm font-medium text-steel-700 transition-colors hover:bg-steel-100"
        }
      >
        {label}
      </button>
    </form>
  );
}
