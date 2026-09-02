import Link from "next/link";
import { Container } from "@/components/ui";
import { en } from "@/lib/i18n/dictionaries/en";

/**
 * Locale-scoped 404.
 *
 * A Server Component that cannot read route params (Next renders not-found
 * outside the param context), so it uses the English dictionary and offers both
 * locales as escape routes rather than guessing wrong.
 *
 * It offers real onward paths — search and categories — because a 404 reached
 * from a stale search result should still be able to convert.
 */
export default function LocaleNotFound() {
  return (
    <Container className="py-16 text-center sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-600 numeric-latin">
        404
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-steel-950 sm:text-3xl">
        {en.errors.notFound}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-steel-600">{en.errors.notFoundBody}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/en/equipment"
          className="inline-flex min-h-[3rem] items-center rounded-[--radius-control] bg-amber-500 px-6 text-base font-semibold text-steel-950 hover:bg-amber-400"
        >
          {en.equipment.allEquipment}
        </Link>
        <Link
          href="/en"
          className="inline-flex min-h-[3rem] items-center rounded-[--radius-control] border border-steel-300 px-6 text-base font-semibold text-steel-800 hover:bg-steel-100"
        >
          {en.errors.goHome}
        </Link>
      </div>

      <p className="mt-6 text-sm text-steel-500">
        <Link href="/ar" className="underline underline-offset-2">
          العربية
        </Link>
      </p>
    </Container>
  );
}
