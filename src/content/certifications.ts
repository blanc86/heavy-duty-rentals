import type { Localized } from "./catalog";

/**
 * CERTIFICATIONS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  SAMPLES. These are the certifications an equipment rental business in Saudi
 *  Arabia is commonly asked for in a tender — they are NOT certificates this
 *  business has been shown to hold. Each is marked `sample: true`, which draws
 *  a generic specimen certificate with a SPECIMEN watermark and labels the card
 *  "Sample". No real certification body's name or mark is used: those marks
 *  may only appear on a certificate the body actually issued.
 *
 *  To show a real certificate:
 *   1. Save a scan in public/certificates/ (JPG or PNG, about 1600 px on the
 *      long side) and, if you have it, the PDF beside it.
 *   2. Fill in issuer, certificateNumber, validUntil, image and pdf.
 *   3. Set sample: false. A test refuses a non-sample entry that is missing any
 *      of those details or whose file does not exist.
 *  Remove any certification the business does not hold.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type CertificationKind = "management-system" | "inspection" | "operator";

export interface CertificateScan {
  /** Path under public/, for example "/certificates/iso-9001.jpg". */
  src: string;
  width: number;
  height: number;
}

export interface Certification {
  slug: string;
  /** True until the real certificate is supplied. See the note above. */
  sample: boolean;
  kind: CertificationKind;
  /** The standard or scheme as certificates print it, e.g. "ISO 9001:2015". */
  standard: Localized;
  title: Localized;
  /** What holding it means for a customer, in a sentence. */
  summary: Localized;
  /** The certification or inspection body named on the certificate. */
  issuer: Localized | null;
  certificateNumber: string | null;
  /** YYYY-MM-DD, as printed on the certificate. */
  validUntil: string | null;
  image: CertificateScan | null;
  /** Path under public/ to the certificate PDF, if there is one. */
  pdf: string | null;
}

export const CERTIFICATIONS: Certification[] = [
  {
    slug: "iso-9001",
    sample: true,
    kind: "management-system",
    standard: { en: "ISO 9001:2015", ar: "ISO 9001:2015" },
    title: { en: "Quality management system", ar: "نظام إدارة الجودة" },
    summary: {
      en: "Rentals, servicing and handover follow documented procedures that an independent body audits every year.",
      ar: "تسير عمليات التأجير والصيانة والتسليم وفق إجراءات موثقة تدققها جهة مستقلة كل عام.",
    },
    issuer: null,
    certificateNumber: null,
    validUntil: null,
    image: null,
    pdf: null,
  },
  {
    slug: "iso-45001",
    sample: true,
    kind: "management-system",
    standard: { en: "ISO 45001:2018", ar: "ISO 45001:2018" },
    title: { en: "Occupational health and safety", ar: "إدارة السلامة والصحة المهنية" },
    summary: {
      en: "Site risks, operator competence and incident reporting are managed within an audited safety management system.",
      ar: "تُدار مخاطر المواقع وكفاءة المشغلين والإبلاغ عن الحوادث ضمن نظام مدقَّق لإدارة السلامة.",
    },
    issuer: null,
    certificateNumber: null,
    validUntil: null,
    image: null,
    pdf: null,
  },
  {
    slug: "iso-14001",
    sample: true,
    kind: "management-system",
    standard: { en: "ISO 14001:2015", ar: "ISO 14001:2015" },
    title: { en: "Environmental management", ar: "نظام الإدارة البيئية" },
    summary: {
      en: "Fuel, oil and waste from machines on hire are handled under an audited environmental management system.",
      ar: "يُتعامل مع الوقود والزيوت والنفايات الناتجة عن المعدات المؤجرة وفق نظام مدقَّق للإدارة البيئية.",
    },
    issuer: null,
    certificateNumber: null,
    validUntil: null,
    image: null,
    pdf: null,
  },
  {
    slug: "lifting-equipment-inspection",
    sample: true,
    kind: "inspection",
    standard: { en: "Third-party inspection", ar: "فحص من جهة خارجية" },
    title: { en: "Cranes and lifting equipment", ar: "الرافعات ومعدات الرفع" },
    summary: {
      en: "Cranes, boom trucks, forklifts and access platforms carry a current certificate from an accredited third-party inspector.",
      ar: "تحمل الرافعات والشاحنات ذات الذراع والرافعات الشوكية ومنصات العمل شهادة سارية من جهة فحص خارجية معتمدة.",
    },
    issuer: null,
    certificateNumber: null,
    validUntil: null,
    image: null,
    pdf: null,
  },
  {
    slug: "operator-certification",
    sample: true,
    kind: "operator",
    standard: { en: "Operator certification", ar: "اعتماد المشغلين" },
    title: { en: "Crane and heavy equipment operators", ar: "مشغلو الرافعات والمعدات الثقيلة" },
    summary: {
      en: "Operators supplied with our machines hold third-party certification for the class of equipment they run.",
      ar: "يحمل المشغلون المرافقون لمعداتنا شهادات من جهات خارجية لفئة المعدات التي يشغّلونها.",
    },
    issuer: null,
    certificateNumber: null,
    validUntil: null,
    image: null,
    pdf: null,
  },
];
