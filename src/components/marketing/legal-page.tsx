import { PageHeader } from "@/components/marketing/sections";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui";
import { BUSINESS } from "@/content/business";
import type { Localized } from "@/content/catalog";
import { LEGAL_UPDATED } from "@/content/legal";
import { t, type Dictionary } from "@/lib/i18n";
import { formatDate, type Locale } from "@/lib/i18n/config";
import { renderMarkdown } from "@/lib/markdown";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

export function LegalPage({
  locale,
  dict,
  title,
  path,
  body,
}: {
  locale: Locale;
  dict: Dictionary;
  title: string;
  path: string;
  body: Localized;
}) {
  const crumbs = [
    { name: dict.common.home, path: "/" },
    { name: title, path },
  ];
  // Placeholders are filled as plain text; the Markdown renderer escapes them.
  const text = body[locale]
    .replaceAll("{company}", BUSINESS.legalName ?? BUSINESS.name[locale])
    .replaceAll("{email}", BUSINESS.email);

  return (
    <>
      <PageHeader locale={locale} dict={dict} crumbs={crumbs} title={title}>
        <p className="mt-3 text-sm text-steel-600">
          {t(dict.legal.reviewNote, { date: formatDate(new Date(`${LEGAL_UPDATED}T00:00:00Z`), locale) })}
        </p>
      </PageHeader>
      <Container className="py-12 sm:py-16">
        <article className="prose-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
      </Container>
      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
    </>
  );
}
