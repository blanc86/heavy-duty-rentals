import type { Metadata } from "next";
import { cspNonce } from "@/lib/seo/nonce";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Card, CardBody, Container, EmptyState, SectionHeading } from "@/components/ui";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema/platform";
import { getDictionary } from "@/lib/i18n";
import { formatDate, isLocale, localePath, type Locale } from "@/lib/i18n/config";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    title: dict.home.guidesTitle,
    description: dict.home.guidesSubtitle,
    alternates: {
      canonical: `/${locale}/guides`,
      languages: { en: "/en/guides", ar: "/ar/guides", "x-default": "/en/guides" },
    },
  };
}

/**
 * Guides index.
 *
 * The content engine that answers the questions buyers actually search —
 * "what size crane do I need", "what is included in crane rental". Competitors
 * rank with thin listicles; a genuinely useful answer is both better content
 * and better acquisition.
 */
export default async function GuidesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const dict = getDictionary(locale);

  const published = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(and(eq(articles.status, "published"), eq(articles.locale, locale)))
    .orderBy(desc(articles.publishedAt));

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
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: dict.nav.home, path: `/${locale}` },
              { name: dict.nav.guides, path: `/${locale}/guides` },
            ]),
          ),
        }}
      />

      <Container className="py-8 sm:py-12">
        <SectionHeading
          level={1}
          title={dict.home.guidesTitle}
          description={dict.home.guidesSubtitle}
        />

        {published.length === 0 ? (
          <EmptyState title={dict.common.noResults} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {published.map((article) => (
              <li key={article.id}>
                <Card className="h-full transition-shadow hover:shadow-[--shadow-raised]">
                  <CardBody>
                    <h2 className="text-lg font-bold leading-snug text-steel-950">
                      <Link
                        href={localePath(locale, `/guides/${article.slug}`)}
                        className="hover:underline"
                      >
                        {article.title}
                      </Link>
                    </h2>
                    {article.excerpt && (
                      <p className="mt-2 text-sm leading-relaxed text-steel-600">
                        {article.excerpt}
                      </p>
                    )}
                    {article.publishedAt && (
                      <p className="mt-3 text-xs text-steel-500 numeric-latin">
                        {formatDate(article.publishedAt, locale)}
                      </p>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
