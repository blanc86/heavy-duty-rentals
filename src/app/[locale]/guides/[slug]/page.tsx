import type { Metadata } from "next";
import { cspNonce } from "@/lib/seo/nonce";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { Alert, Container } from "@/components/ui";
import { renderMarkdown, markdownToPlainText } from "@/lib/content/markdown";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema/platform";
import { getDictionary } from "@/lib/i18n";
import { formatDate, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { decodeSlugParam } from "@/lib/routing";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { getBusinessSettings } from "@/lib/settings";

async function loadArticle(slug: string, locale: Locale) {
  const [article] = await db
    .select()
    .from(articles)
    .where(
      and(eq(articles.slug, slug), eq(articles.locale, locale), eq(articles.status, "published")),
    )
    .limit(1);
  return article ?? null;
}

/**
 * Resolve a slug belonging to the OTHER locale to its translation here.
 *
 * Articles are translated, not transliterated: the Arabic version of
 * "what-size-crane-do-i-need" lives at an Arabic slug. That is correct for SEO,
 * but it means the header's language switch — which only knows the pathname —
 * builds /ar/guides/what-size-crane-do-i-need, which matches nothing.
 *
 * Rather than teach the layout about every page's slug scheme, the article
 * route resolves it: an unknown slug that IS a published article in the other
 * locale redirects to its counterpart. This also rescues inbound links and
 * bookmarks that cross locales, and it keeps `notFound()` meaning "no such
 * article" instead of "right article, wrong language".
 */
async function findTranslatedSlug(slug: string, locale: Locale) {
  const [source] = await db
    .select({ translationGroupId: articles.translationGroupId })
    .from(articles)
    .where(and(eq(articles.slug, slug), ne(articles.locale, locale)))
    .limit(1);
  if (!source?.translationGroupId) return null;

  const [translation] = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(
      and(
        eq(articles.translationGroupId, source.translationGroupId),
        eq(articles.locale, locale),
        eq(articles.status, "published"),
      ),
    )
    .limit(1);
  return translation?.slug ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  if (!isLocale(locale)) return {};
  const slug = decodeSlugParam(rawSlug);

  const article = await loadArticle(slug, locale);
  if (!article) return {};

  const description =
    article.metaDescription ?? article.excerpt ?? markdownToPlainText(article.bodyMarkdown, 300);

  // The other-language version has its OWN slug, so the hreflang pair is
  // resolved through the translation group rather than assumed.
  const [translation] = await db
    .select({ slug: articles.slug, locale: articles.locale })
    .from(articles)
    .where(
      and(
        eq(articles.translationGroupId, article.translationGroupId),
        ne(articles.locale, locale),
        eq(articles.status, "published"),
      ),
    )
    .limit(1);

  return {
    title: article.metaTitle ?? article.title,
    description,
    alternates: {
      canonical: `/${locale}/guides/${slug}`,
      ...(translation
        ? {
            languages: {
              [locale]: `/${locale}/guides/${slug}`,
              [translation.locale]: `/${translation.locale}/guides/${translation.slug}`,
            },
          }
        : {}),
    },
    openGraph: {
      title: article.title,
      description,
      type: "article",
      ...(article.publishedAt ? { publishedTime: article.publishedAt.toISOString() } : {}),
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug: rawSlug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const slug = decodeSlugParam(rawSlug);
  const dict = getDictionary(locale);

  const article = await loadArticle(slug, locale);
  if (!article) {
    const translated = await findTranslatedSlug(slug, locale);
    // Arabic slugs are non-ASCII and a Location header must not carry raw
    // non-ASCII bytes, so the slug is percent-encoded on the way out.
    if (translated) redirect(localePath(locale, `/guides/${encodeURIComponent(translated)}`));
    notFound();
  }

  const business = await getBusinessSettings();
  const html = renderMarkdown(article.bodyMarkdown);

  return (
    <>
      <script
        type="application/ld+json"
        // CSP applies to every <script>, including a ld+json data block that
        // never executes. Without the nonce the block is refused and a crawler
        // rendering under CSP never sees the structured data — silently, since
        // the markup is still present in the HTML source.
        nonce={await cspNonce()}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            articleJsonLd({
              locale,
              title: article.title,
              description: article.excerpt,
              slug: article.slug,
              publishedAt: article.publishedAt,
              updatedAt: article.updatedAt,
              authorName: locale === "ar" ? business.companyNameAr : business.companyNameEn,
            }),
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.nav.guides, path: `/${locale}/guides` },
              { name: article.title, path: `/${locale}/guides/${slug}` },
            ]),
          ]),
        }}
      />

      <Container className="py-8 sm:py-12">
        <article className="mx-auto max-w-3xl">
          <nav aria-label={dict.a11y.breadcrumb} className="mb-4 text-sm">
            <ol className="flex flex-wrap items-center gap-1.5 text-steel-500">
              <li>
                <Link href={localePath(locale, "/")} className="hover:underline">
                  {dict.nav.home}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={localePath(locale, "/guides")} className="hover:underline">
                  {dict.nav.guides}
                </Link>
              </li>
            </ol>
          </nav>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-steel-950">
            {article.title}
          </h1>

          {article.publishedAt && (
            <p className="mt-2 text-sm text-steel-500 numeric-latin">
              {formatDate(article.publishedAt, locale)}
            </p>
          )}

          {article.excerpt && (
            <p className="mt-4 text-lg leading-relaxed text-steel-700">{article.excerpt}</p>
          )}

          {/*
            The body is escaped-then-rendered by our own allowlist renderer
            (see lib/content/markdown.ts): an admin account compromise cannot
            turn an article into stored XSS, because there is no path from
            input to raw HTML.
          */}
          <div
            className="mt-6 text-base"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <Alert tone="warning" title={dict.equipment.safetyNotice} className="mt-10">
            {dict.equipment.safetyBody}
          </Alert>

          <p className="mt-8 text-center">
            <Link
              href={localePath(locale, "/equipment")}
              className="inline-flex min-h-[3rem] items-center rounded-[--radius-control] bg-amber-500 px-6 text-base font-semibold text-steel-950 hover:bg-amber-400"
            >
              {dict.equipment.checkAvailability}
            </Link>
          </p>
        </article>
      </Container>
    </>
  );
}
