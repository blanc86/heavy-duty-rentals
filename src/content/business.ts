import type { Localized } from "./catalog";

/**
 * BUSINESS DETAILS.
 *
 * Every phone link, WhatsApp button, email address, footer line and piece of
 * LocalBusiness structured data on the site reads from this one object. Change
 * a number here and it changes everywhere, including the `tel:` and `wa.me`
 * links, which are derived rather than typed a second time.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDERS. The project never contained real contact details — the
 *  original seed used "+966 11 000 0000", "info@example.com" and addresses
 *  labelled "(demo address)". Nothing below is invented to look real:
 *
 *   - phone / whatsapp: shown as "+966 5X XXX XXXX" so no visitor mistakes it
 *     for a working number. The link digits dial a reserved all-zero number.
 *   - email: example.com is reserved by RFC 2606 and never delivers anywhere.
 *   - address, hours, legal registration: null, so the UI omits them rather
 *     than printing something made up.
 *
 *  `PLACEHOLDER_FIELDS` lists what is still missing; `npm run content:check`
 *  prints it. Replace each value and remove its name from that list.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface PhoneNumber {
  /** As printed on the page, in local convention. */
  display: string;
  /** Digits only, with country code and no "+": what `tel:` and `wa.me` need. */
  digits: string;
}

export interface BusinessDetails {
  name: Localized;
  /** Legal entity name, for the footer and structured data. Null until provided. */
  legalName: string | null;
  phone: PhoneNumber;
  /** The number that receives WhatsApp messages. Often the same as `phone`. */
  whatsapp: PhoneNumber;
  email: string;
  /** Street address. Null until provided — never a guessed or "demo" address. */
  address: Localized | null;
  /** A Google Maps link for directions. Null until the address is known. */
  mapsUrl: string | null;
  /** Opening hours as the business wants them read. Null until provided. */
  hours: Localized | null;
  /** Commercial registration number — a trust signal Saudi buyers look for. */
  crNumber: string | null;
  vatNumber: string | null;
  /** Year operations began. Shown on the About page; never estimated. */
  foundedYear: number | null;
}

export const BUSINESS: BusinessDetails = {
  name: { en: "Heavy Duty Rentals", ar: "هيفي ديوتي للتأجير" },
  legalName: null,
  phone: { display: "+966 5X XXX XXXX", digits: "966500000000" },
  whatsapp: { display: "+966 5X XXX XXXX", digits: "966500000000" },
  email: "info@example.com",
  address: null,
  mapsUrl: null,
  hours: null,
  crNumber: null,
  vatNumber: null,
  foundedYear: null,
};

/**
 * What the business still needs to supply. Kept next to the data so the two
 * are edited together.
 */
export const PLACEHOLDER_FIELDS: readonly (keyof BusinessDetails | "fleet" | "serviceAreas" | "testimonials" | "photos" | "domain")[] = [
  "phone",
  "whatsapp",
  "email",
  "address",
  "mapsUrl",
  "hours",
  "legalName",
  "crNumber",
  "vatNumber",
  "foundedYear",
  "fleet",
  "serviceAreas",
  "testimonials",
  "photos",
  "domain",
];

/**
 * Cities served.
 *
 * Carried over from the original project, which listed depots in these five
 * cities with addresses marked "(demo address)". The addresses are dropped; the
 * cities are kept as service areas pending confirmation. Each entry generates a
 * service-area page and appears in `areaServed`, so remove any city the
 * business does not actually deliver to — an unserved city page is a promise
 * the phone line then has to break.
 */
export interface ServiceArea {
  slug: string;
  city: Localized;
  region: Localized;
  /** Industrial zones and project hubs named on the page, where they help a reader. */
  nearby: Localized;
  /**
   * Practical planning advice for renting in this city. This is what makes a
   * city page worth reading rather than a copy of every other city page with
   * the name swapped — which search engines treat as a doorway page.
   * General site-planning guidance only; no claims about the business.
   */
  planning: Localized;
}

export const SERVICE_AREAS: ServiceArea[] = [
  {
    slug: "riyadh",
    city: { en: "Riyadh", ar: "الرياض" },
    region: { en: "Riyadh Province", ar: "منطقة الرياض" },
    nearby: {
      en: "Second and Third Industrial Cities, Al Kharj Road and major project sites across the capital",
      ar: "المدينتان الصناعيتان الثانية والثالثة وطريق الخرج ومواقع المشاريع الكبرى في العاصمة",
    },
    planning: {
      en: "City-centre sites in Riyadh often have limited space to set up and restricted hours for heavy vehicles on main roads. Tell us about site access and any delivery time windows when you enquire, especially for mobile cranes and low-bed deliveries, so transport can be planned around them.",
      ar: "غالباً ما تكون المساحة المتاحة لتجهيز المعدات في مواقع وسط الرياض محدودة، مع قيود على أوقات سير المركبات الثقيلة في الطرق الرئيسية. أخبرنا عن طريقة الوصول إلى الموقع وأي أوقات محددة للتوصيل عند تواصلك معنا، خاصة للرافعات المتحركة والنقل بالمقطورات المنخفضة، ليتم تخطيط النقل وفقاً لها.",
    },
  },
  {
    slug: "jeddah",
    city: { en: "Jeddah", ar: "جدة" },
    region: { en: "Makkah Province", ar: "منطقة مكة المكرمة" },
    nearby: {
      en: "Jeddah industrial areas, the port and project sites across the western region",
      ar: "المناطق الصناعية في جدة والميناء ومواقع المشاريع في المنطقة الغربية",
    },
    planning: {
      en: "Coastal humidity and heat affect working hours and equipment choice in Jeddah. For work near the port or in busy districts, let us know about access routes and permits early, and whether indoor or enclosed areas mean an electric access platform is the better fit.",
      ar: "تؤثر الرطوبة والحرارة الساحلية على ساعات العمل واختيار المعدات في جدة. وللأعمال القريبة من الميناء أو في الأحياء المزدحمة، أخبرنا مبكراً عن طرق الوصول والتصاريح، وما إذا كانت المناطق الداخلية أو المغلقة تجعل منصة العمل الكهربائية الخيار الأنسب.",
    },
  },
  {
    slug: "dammam",
    city: { en: "Dammam", ar: "الدمام" },
    region: { en: "Eastern Province", ar: "المنطقة الشرقية" },
    nearby: {
      en: "Dammam's Second Industrial City, King Abdulaziz Port and sites across the Eastern Province",
      ar: "المدينة الصناعية الثانية بالدمام وميناء الملك عبدالعزيز ومواقع المنطقة الشرقية",
    },
    planning: {
      en: "Industrial and port work around Dammam frequently involves site inductions, gate passes and permit-to-work systems. Share the site's entry requirements when you enquire so operators and transport arrive with the paperwork the gate expects.",
      ar: "كثيراً ما تتضمن الأعمال الصناعية وأعمال الموانئ حول الدمام برامج تعريف بالموقع وتصاريح دخول وأنظمة تصاريح العمل. شاركنا متطلبات الدخول إلى الموقع عند تواصلك معنا ليصل المشغلون ووسائل النقل بالمستندات المطلوبة عند البوابة.",
    },
  },
  {
    slug: "khobar",
    city: { en: "Al Khobar", ar: "الخبر" },
    region: { en: "Eastern Province", ar: "المنطقة الشرقية" },
    nearby: {
      en: "Al Khobar, Dhahran and the surrounding commercial and industrial areas",
      ar: "الخبر والظهران والمناطق التجارية والصناعية المحيطة",
    },
    planning: {
      en: "Commercial and mixed-use projects in Al Khobar often mean tight plots beside occupied buildings. For lifting work, send the heaviest load, the radius and the set-up space available, and we can suggest a crane or boom truck that fits the plot.",
      ar: "غالباً ما تعني المشاريع التجارية ومتعددة الاستخدامات في الخبر مواقع ضيقة بجوار مبانٍ مشغولة. ولأعمال الرفع، أرسل أثقل حمل ونصف القطر ومساحة التجهيز المتاحة، ويمكننا اقتراح رافعة أو شاحنة ذات ذراع تناسب الموقع.",
    },
  },
  {
    slug: "jubail",
    city: { en: "Jubail", ar: "الجبيل" },
    region: { en: "Eastern Province", ar: "المنطقة الشرقية" },
    nearby: {
      en: "Jubail Industrial City and petrochemical plant maintenance sites",
      ar: "مدينة الجبيل الصناعية ومواقع صيانة المصانع البتروكيماوية",
    },
    planning: {
      en: "Plant maintenance and shutdown work in Jubail Industrial City runs to fixed schedules with strict safety requirements. Contact us as early as your shutdown dates are known, and include the site's certification and inspection requirements for lifting equipment and operators.",
      ar: "تسير أعمال صيانة المصانع والتوقفات في مدينة الجبيل الصناعية وفق جداول ثابتة ومتطلبات سلامة صارمة. تواصل معنا بمجرد تحديد مواعيد التوقف، واذكر متطلبات الموقع من شهادات وفحوص لمعدات الرفع والمشغلين.",
    },
  },
];
