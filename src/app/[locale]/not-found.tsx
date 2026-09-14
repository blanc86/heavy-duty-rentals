import Link from "next/link";
import { ButtonLink, Container } from "@/components/ui";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";

/**
 * 404 inside a locale.
 *
 * Next renders not-found without route params, so this page cannot know which
 * language the visitor was reading. Rather than guess, it speaks both, each
 * marked with its own lang and direction, and offers the routes most likely to
 * rescue a visit that arrived from an old link: the equipment list and contact.
 */
export default function LocaleNotFound() {
  return (
    <Container className="py-20 sm:py-28">
      <div className="grid gap-12 md:grid-cols-2">
        <section lang="en" dir="ltr" className="font-sans">
          <h1 className="text-h1">{en.notFound.title}</h1>
          <p className="mt-3 text-lg text-steel-700">{en.notFound.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/en/equipment">{en.cta.viewAllEquipment}</ButtonLink>
            <ButtonLink variant="outline" href="/en/contact">
              {en.nav.contact}
            </ButtonLink>
          </div>
          <p className="mt-5">
            <Link href="/en" className="font-semibold underline underline-offset-4">
              {en.notFound.home}
            </Link>
          </p>
        </section>
        <section lang="ar" dir="rtl" className="font-arabic">
          <h2 className="text-h1">{ar.notFound.title}</h2>
          <p className="mt-3 text-lg text-steel-700">{ar.notFound.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/ar/equipment">{ar.cta.viewAllEquipment}</ButtonLink>
            <ButtonLink variant="outline" href="/ar/contact">
              {ar.nav.contact}
            </ButtonLink>
          </div>
          <p className="mt-5">
            <Link href="/ar" className="font-semibold underline underline-offset-4">
              {ar.notFound.home}
            </Link>
          </p>
        </section>
      </div>
    </Container>
  );
}
