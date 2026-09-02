import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Alert, Container } from "@/components/ui";
import { getActor } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getDictionary } from "@/lib/i18n";
import { isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { writeAudit } from "@/lib/server/audit";

/**
 * Admin console shell.
 *
 * The authorization gate for the WHOLE admin section lives here, so no admin
 * page can be reachable without passing it. Every admin Server Action
 * additionally re-checks through `guard` — a layout protects rendering, not
 * mutations, and relying on it alone would be a classic authorization gap.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const actor = await getActor();

  if (!actor) {
    redirect(localePath(locale, `/login?next=${encodeURIComponent(`/${locale}/admin`)}`));
  }

  if (!actor.isPlatformAdmin) {
    // Every denial is audited: a single 404 is noise, a pattern of them is
    // someone probing for the admin surface.
    await writeAudit({
      action: "admin.access_denied",
      actorUserId: actor.userId,
      actorType: "customer",
      resourceType: "admin",
      outcome: "denied",
    });
    // 404, not 403 — a non-admin should not learn that this section exists.
    notFound();
  }

  const nav = [
    { href: "/admin", label: dict.admin.dashboard },
    { href: "/admin/bookings", label: dict.admin.bookings },
    { href: "/admin/inventory", label: dict.admin.inventory },
    { href: "/admin/utilization", label: dict.admin.utilization },
    { href: "/admin/audit", label: dict.admin.auditLog },
  ];

  return (
    <div className="min-h-full bg-steel-100">
      <div className="border-b border-steel-300 bg-steel-950">
        <Container>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
            <p className="text-sm font-bold text-white">{dict.admin.title}</p>
            <nav aria-label={dict.admin.title}>
              <ul className="flex flex-wrap gap-1">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={localePath(locale, item.href)}
                      className="rounded-[--radius-control] px-3 py-1.5 text-sm font-medium text-steel-300 transition-colors hover:bg-steel-800 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="ms-auto text-xs text-steel-400">{actor.email}</p>
          </div>
        </Container>
      </div>

      <Container className="py-6 sm:py-8">
        {/*
          MFA is mandatory for admin actions in production (enforced in
          `guard`). Saying so here rather than silently letting an admin browse
          and then fail on their first mutation.
        */}
        {!actor.mfaSatisfied && env.NODE_ENV !== "production" && (
          <Alert tone="warning" className="mb-5" title={dict.auth.mfaTitle}>
            {locale === "ar"
              ? "لم يتم استيفاء التحقق بخطوتين لهذه الجلسة. في بيئة الإنتاج، تتطلب جميع إجراءات الإدارة تحققاً بخطوتين."
              : "Two-factor authentication has not been satisfied for this session. In production, every admin action requires it."}
          </Alert>
        )}

        {children}
      </Container>
    </div>
  );
}
