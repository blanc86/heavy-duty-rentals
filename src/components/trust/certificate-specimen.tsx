import { BUSINESS } from "@/content/business";
import type { Certification, CertificationKind } from "@/content/certifications";

/**
 * A generic specimen certificate, drawn in SVG, standing in until the business
 * supplies a scan of the real one.
 *
 * It looks like a certificate — paper, ruled border, seal, signature line — so
 * the section reads as intended, but it cannot be mistaken for one: a SPECIMEN
 * watermark crosses it, the number and dates are placeholders, and the issuer
 * is "Certification body" rather than any real body's name or mark.
 *
 * Certificates in the Kingdom are issued in English, so the artwork is English
 * on both language versions of the site; the card around it is translated.
 * Direction is pinned to LTR, or an Arabic page would anchor the left-aligned
 * lines from the right and push them off the paper.
 */
const WORDING: Record<CertificationKind, { sub: string; lead: string; middle: [string, string]; scope: [string, string] }> = {
  "management-system": {
    sub: "OF REGISTRATION",
    lead: "This is to certify that the management system of",
    middle: ["has been assessed and found to conform", "to the requirements of"],
    scope: ["Rental of cranes, earthmoving, lifting and access equipment,", "with and without operators, in the Kingdom of Saudi Arabia"],
  },
  inspection: {
    sub: "OF INSPECTION",
    lead: "This is to certify that the lifting equipment of",
    middle: ["has been thoroughly examined and found", "fit for continued safe use under"],
    scope: ["Mobile cranes, boom trucks, forklifts, telehandlers", "and mobile elevating work platforms"],
  },
  operator: {
    sub: "OF COMPETENCE",
    lead: "This is to certify that the equipment operators of",
    middle: ["have been assessed and found competent", "under the scheme for"],
    scope: ["Mobile and crawler cranes, excavators,", "wheel loaders, forklifts and telehandlers"],
  },
};

const INK = "#1b2430";
const MUTED = "#677282";
const CONDENSED = { fontFamily: "var(--font-barlow-condensed), 'Arial Narrow', sans-serif" };

export function CertificateSpecimen({
  certification,
  label,
  className,
}: {
  certification: Certification;
  /** Given when the artwork is the content (in the viewer); omitted for thumbnails. */
  label?: string;
  className?: string;
}) {
  const words = WORDING[certification.kind];
  const holder = BUSINESS.legalName?.en ?? BUSINESS.name.en;
  const standardSize = certification.standard.en.length > 14 ? 29 : 36;

  return (
    <svg
      viewBox="0 0 420 594"
      lang="en"
      direction="ltr"
      className={className}
      style={{ fontFamily: "var(--font-barlow), system-ui, sans-serif", direction: "ltr" }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <rect width="420" height="594" fill="#fdfcf8" />
      <rect x="14" y="14" width="392" height="566" fill="none" stroke={INK} strokeWidth="1.5" />
      <rect x="21.5" y="21.5" width="377" height="551" fill="none" stroke="#a9b1bc" strokeWidth="6" strokeDasharray="1 2.4" />
      <rect x="29" y="29" width="362" height="536" fill="none" stroke={INK} strokeWidth="0.75" />

      <g transform="translate(210 80)" fill="none" stroke="#3a4655">
        <circle r="21" strokeWidth="1.5" />
        <circle r="16" strokeWidth="0.75" />
        <ellipse rx="7" ry="16" strokeWidth="0.75" />
        <path d="M-16 0H16M0-16V16" strokeWidth="0.75" />
      </g>

      <text x="210" y="136" textAnchor="middle" fontSize="31" fontWeight="700" letterSpacing="7" fill={INK} style={CONDENSED}>
        CERTIFICATE
      </text>
      <text x="210" y="156" textAnchor="middle" fontSize="10.5" letterSpacing="3.5" fill={MUTED}>
        {words.sub}
      </text>
      <rect x="175" y="168" width="70" height="3" fill="#f68734" />

      <text x="210" y="198" textAnchor="middle" fontSize="9.5" fill={MUTED}>
        {words.lead}
      </text>
      <text x="210" y="222" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK} style={CONDENSED}>
        {holder}
      </text>
      <text x="210" y="245" textAnchor="middle" fontSize="9.5" fill={MUTED}>
        {words.middle[0]}
      </text>
      <text x="210" y="258" textAnchor="middle" fontSize="9.5" fill={MUTED}>
        {words.middle[1]}
      </text>

      <text x="210" y="300" textAnchor="middle" fontSize={standardSize} fontWeight="700" fill={INK} style={CONDENSED}>
        {certification.standard.en}
      </text>
      <text x="210" y="322" textAnchor="middle" fontSize="12.5" fill="#3a4655">
        {certification.title.en}
      </text>

      <text x="210" y="356" textAnchor="middle" fontSize="8" letterSpacing="2" fill={MUTED}>
        SCOPE
      </text>
      <text x="210" y="371" textAnchor="middle" fontSize="9" fill="#3a4655">
        {words.scope[0]}
      </text>
      <text x="210" y="384" textAnchor="middle" fontSize="9" fill="#3a4655">
        {words.scope[1]}
      </text>

      <g fontSize="8.5">
        <text x="58" y="440" fill={MUTED}>Certificate no.</text>
        <text x="58" y="455" fontWeight="600" fill={INK}>XXXX-XXXX-XX</text>
        <text x="58" y="480" fill={MUTED}>Valid until</text>
        <text x="58" y="495" fontWeight="600" fill={INK}>DD MMM YYYY</text>
      </g>

      <g transform="translate(322 468)">
        <circle r="37" fill="none" stroke="#f68734" strokeWidth="9" strokeDasharray="1.6 1.7" />
        <circle r="29" fill="#f68734" />
        <circle r="24" fill="none" stroke="#fdfcf8" strokeWidth="1" />
        <path d="M-10 1l7 7 13-15" fill="none" stroke="#fdfcf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <path d="M156 520c9-17 17-3 25-10s10-12 17-2 12 3 21-7" fill="none" stroke="#3a4655" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="146" y1="530" x2="252" y2="530" stroke="#a9b1bc" strokeWidth="0.75" />
      <text x="199" y="543" textAnchor="middle" fontSize="8" fill={MUTED}>
        Certification body
      </text>

      <text
        x="210"
        y="330"
        textAnchor="middle"
        transform="rotate(-33 210 330)"
        fontSize="76"
        fontWeight="700"
        letterSpacing="9"
        fill="#b04a12"
        opacity="0.14"
        style={CONDENSED}
      >
        SPECIMEN
      </text>
    </svg>
  );
}
