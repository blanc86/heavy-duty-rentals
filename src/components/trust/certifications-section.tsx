import Image from "next/image";
import { CERTIFICATIONS } from "@/content/certifications";
import { Container, SectionHeading, cn } from "@/components/ui";
import { t, type Dictionary } from "@/lib/i18n";
import { formatDate, type Locale } from "@/lib/i18n/config";
import { CertificateSpecimen } from "./certificate-specimen";
import { CertificateViewer } from "./certificate-viewer";
import { SampleBadge } from "./sample-badge";

/**
 * Certifications, as documents.
 *
 * Each one is shown as the certificate itself, portrait and on paper, because
 * that is what a procurement team asks for and files: a logo strip of standards
 * says "we have heard of ISO 9001", a certificate with a number and an expiry
 * date says "here it is". Selecting one opens it large, with its details.
 *
 * Content, including which entries are still samples, lives in
 * content/certifications.ts.
 */
export function CertificationsSection({
  locale,
  dict,
  id = "certifications",
  className,
}: {
  locale: Locale;
  dict: Dictionary;
  id?: string;
  className?: string;
}) {
  const c = dict.certifications;

  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20 py-20 sm:py-24", className)}>
      <Container>
        <SectionHeading id={`${id}-title`} title={c.title} intro={c.intro} />
        <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {CERTIFICATIONS.map((certification) => {
            const title = certification.title[locale];
            const standard = certification.standard[locale];
            const name = `${standard}${locale === "ar" ? "، " : ", "}${title}`;
            const validUntil = certification.validUntil ? formatDate(new Date(certification.validUntil), locale) : null;
            return (
              <li key={certification.slug} className="mx-auto flex w-full max-w-[15rem] flex-col min-[440px]:max-w-none">
                <CertificateViewer
                  certification={certification}
                  standard={standard}
                  name={title}
                  summary={certification.summary[locale]}
                  issuer={certification.issuer?.[locale] ?? null}
                  validUntilText={validUntil}
                  labels={{
                    view: c.view,
                    viewSuffix: t(c.viewSuffix, { name }),
                    close: c.close,
                    issuer: c.issuer,
                    number: c.number,
                    validUntil: c.validUntil,
                    pdf: c.pdf,
                    specimen: c.specimen,
                    sample: dict.common.sample,
                  }}
                >
                  {/* Paper on a surface: the one place on the site a shadow is literal. */}
                  <div className="overflow-hidden rounded-plate bg-white shadow-[0_1px_2px_rgb(18_25_32/0.08),0_14px_28px_-14px_rgb(18_25_32/0.35)] ring-1 ring-steel-200 transition-transform duration-200 ease-out group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
                    {certification.image ? (
                      <Image
                        src={certification.image.src}
                        width={certification.image.width}
                        height={certification.image.height}
                        alt=""
                        sizes="(min-width: 1024px) 210px, (min-width: 768px) 30vw, 45vw"
                        className="aspect-[420/594] h-auto w-full object-cover object-top"
                      />
                    ) : (
                      <CertificateSpecimen certification={certification} className="block h-auto w-full" />
                    )}
                  </div>
                </CertificateViewer>

                <div className="mt-5 flex flex-1 flex-col">
                  <h3 className="text-[1.3rem] leading-tight">
                    <bdi>{standard}</bdi>
                  </h3>
                  <p className="mt-1 font-semibold text-steel-800">{title}</p>
                  <p className="mt-2 text-[0.95rem] text-steel-600">{certification.summary[locale]}</p>
                  <div className="mt-auto pt-3">
                    {certification.sample ? (
                      <SampleBadge label={dict.common.sample} />
                    ) : (
                      validUntil && (
                        <p className="text-sm text-steel-600">
                          {c.validUntil} <span className="font-semibold text-steel-900">{validUntil}</span>
                        </p>
                      )
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
