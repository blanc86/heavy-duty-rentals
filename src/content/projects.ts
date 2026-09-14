import type { Localized, LocalizedList } from "./catalog";

/**
 * COMPLETED PROJECTS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  SAMPLES. Every project below is an illustrative example written to show how
 *  the section works, with licensed stock photographs. None describes work the
 *  business has done. Each is marked `sample: true`, which puts a "Sample"
 *  label on it wherever it appears, and `npm run content:check` counts them.
 *
 *  To add a real project: copy an entry, write what actually happened, use a
 *  photograph of the job (with the client's permission if the site or client
 *  can be identified), set `sample: false`, and delete the samples. Never set
 *  `sample: false` on one of these.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Clients are described by sector, not named: naming a client needs their
 * written permission, and a procurement reader learns more from "maintenance
 * contractor, petrochemical sector" than from a logo they cannot verify.
 */

export interface ProjectFact {
  label: Localized;
  /** Latin digits in both languages, like the specification tables. */
  value: Localized;
}

export interface Project {
  slug: string;
  /** True for illustrative examples. See the note at the top of this file. */
  sample: boolean;
  title: Localized;
  /** The kind of work, shown as the project's label. */
  type: Localized;
  /** Who the work was for, by sector. */
  client: Localized;
  /** A SERVICE_AREAS slug, linking the project to its city page. */
  area: string;
  /** Where, more precisely than the city. */
  location: Localized;
  year: number;
  duration: Localized;
  summary: Localized;
  /** What was supplied and done, one line each. */
  scope: LocalizedList;
  /** Figures specific to the job, shown as plates. */
  facts: ProjectFact[];
  /** Machine slugs from the catalogue, linked to their pages. */
  equipment: string[];
}

export const PROJECTS: Project[] = [
  {
    slug: "jubail-plant-expansion-lifts",
    sample: true,
    title: {
      en: "Heavy lifts for a petrochemical plant expansion",
      ar: "أعمال رفع ثقيلة لتوسعة مصنع بتروكيماويات",
    },
    type: { en: "Industrial lifting", ar: "رفع صناعي" },
    client: { en: "Mechanical contractor, petrochemical sector", ar: "مقاول أعمال ميكانيكية في قطاع البتروكيماويات" },
    area: "jubail",
    location: { en: "Jubail Industrial City", ar: "مدينة الجبيل الصناعية" },
    year: 2025,
    duration: { en: "7 weeks", ar: "7 أسابيع" },
    summary: {
      en: "Crawler and all-terrain cranes set process modules, pipe racks and a column section for a new unit, with boom lifts for bolting and inspection at height.",
      ar: "رافعات زاحفة ورافعات لجميع التضاريس لتركيب وحدات المعالجة وحوامل الأنابيب وجزء من برج لوحدة جديدة، مع رافعات ذات ذراع لأعمال التثبيت والفحص على ارتفاع.",
    },
    scope: {
      en: [
        "Inspection certificates and operator cards submitted for site approval before mobilisation",
        "300 t crawler crane for the heaviest module lifts, assembled on site",
        "200 t all-terrain crane for pipe racks and tail lifts",
        "26 m boom lifts for bolting, insulation and inspection",
      ],
      ar: [
        "تقديم شهادات الفحص وبطاقات المشغلين لاعتماد الموقع قبل التحريك",
        "رافعة زاحفة بحمولة 300 طن لأثقل الوحدات، جُمعت في الموقع",
        "رافعة لجميع التضاريس بحمولة 200 طن لحوامل الأنابيب والرفع المساعد",
        "رافعات ذات ذراع بارتفاع 26 متراً لأعمال التثبيت والعزل والفحص",
      ],
    },
    facts: [
      { label: { en: "Heaviest lift", ar: "أثقل رفعة" }, value: { en: "118 t", ar: "118 t" } },
      { label: { en: "Machines on site", ar: "المعدات في الموقع" }, value: { en: "6", ar: "6" } },
      { label: { en: "Working pattern", ar: "نظام العمل" }, value: { en: "Day and night", ar: "ليلاً ونهاراً" } },
    ],
    equipment: ["crawler-crane-300t", "all-terrain-crane-200t", "boom-lift-26m"],
  },
  {
    slug: "riyadh-solar-plant-lifts",
    sample: true,
    title: {
      en: "Setting inverter stations at a solar power plant",
      ar: "تركيب محطات العاكسات في محطة طاقة شمسية",
    },
    type: { en: "Energy", ar: "طاقة" },
    client: { en: "EPC contractor, renewable energy", ar: "مقاول هندسة وتوريد وإنشاء في الطاقة المتجددة" },
    area: "riyadh",
    location: { en: "Riyadh Province", ar: "منطقة الرياض" },
    year: 2026,
    duration: { en: "10 weeks", ar: "10 أسابيع" },
    summary: {
      en: "A 100 t all-terrain crane moved between blocks of the array to set inverter and transformer stations from low-bed deliveries, while telehandlers unloaded and distributed panel pallets.",
      ar: "تنقلت رافعة لجميع التضاريس بحمولة 100 طن بين أجزاء المحطة لتركيب محطات العاكسات والمحولات من شاحنات المقطورات المنخفضة، بينما تولت الرافعات الشوكية التلسكوبية تفريغ منصات الألواح وتوزيعها.",
    },
    scope: {
      en: [
        "100 t all-terrain crane with operator, relocated block by block",
        "Telehandlers for unloading and distributing panel pallets along the rows",
        "Low-bed transport for station skids from the laydown yard",
        "Site generator for the temporary offices and stores",
      ],
      ar: [
        "رافعة لجميع التضاريس بحمولة 100 طن مع مشغل، تُنقل من جزء إلى آخر",
        "رافعات شوكية تلسكوبية لتفريغ منصات الألواح وتوزيعها على الصفوف",
        "نقل بمقطورات منخفضة لقواعد المحطات من ساحة التخزين",
        "مولد للمكاتب والمستودعات المؤقتة في الموقع",
      ],
    },
    facts: [
      { label: { en: "Stations set", ar: "المحطات المركّبة" }, value: { en: "24", ar: "24" } },
      { label: { en: "Heaviest station", ar: "أثقل محطة" }, value: { en: "21 t", ar: "21 t" } },
      { label: { en: "Crane moves", ar: "تنقلات الرافعة" }, value: { en: "31", ar: "31" } },
    ],
    equipment: ["all-terrain-crane-100t", "telehandler-17m", "low-bed-trailer-60t", "generator-500kva"],
  },
  {
    slug: "dammam-warehouse-roof-steel",
    sample: true,
    title: {
      en: "Roof steel and cladding for a distribution warehouse",
      ar: "تركيب الهيكل الحديدي للسقف والكسوة لمستودع توزيع",
    },
    type: { en: "Construction", ar: "إنشاءات" },
    client: { en: "Steel structure contractor, logistics sector", ar: "مقاول هياكل حديدية في قطاع الخدمات اللوجستية" },
    area: "dammam",
    location: { en: "Dammam Second Industrial City", ar: "المدينة الصناعية الثانية بالدمام" },
    year: 2025,
    duration: { en: "4 months", ar: "4 أشهر" },
    summary: {
      en: "Scissor lifts and a telehandler worked under the roof trusses of a 24,000 m² warehouse while a 50 t crane lifted the truss sections, followed by forklifts for the racking installation.",
      ar: "عملت منصات مقصية ورافعة شوكية تلسكوبية تحت جمالونات سقف مستودع مساحته 24,000 متر مربع بينما رفعت رافعة بحمولة 50 طناً أجزاء الجمالونات، ثم تولت الرافعات الشوكية تركيب الأرفف.",
    },
    scope: {
      en: [
        "50 t all-terrain crane for roof truss sections",
        "12 m scissor lifts for bolting, purlins and cladding",
        "Telehandler for moving steel and sheeting around the slab",
        "Forklifts for unloading and racking installation, on a monthly rental",
      ],
      ar: [
        "رافعة لجميع التضاريس بحمولة 50 طناً لأجزاء جمالونات السقف",
        "منصات مقصية بارتفاع 12 متراً للتثبيت والمدادات والكسوة",
        "رافعة شوكية تلسكوبية لنقل الحديد والألواح داخل الموقع",
        "رافعات شوكية للتفريغ وتركيب الأرفف بإيجار شهري",
      ],
    },
    facts: [
      { label: { en: "Warehouse area", ar: "مساحة المستودع" }, value: { en: "24,000 m²", ar: "24,000 m²" } },
      { label: { en: "Machines on site", ar: "المعدات في الموقع" }, value: { en: "7", ar: "7" } },
      { label: { en: "Rental", ar: "الإيجار" }, value: { en: "Monthly", ar: "شهري" } },
    ],
    equipment: ["all-terrain-crane-50t", "scissor-lift-12m", "telehandler-17m", "forklift-3t-diesel"],
  },
  {
    slug: "riyadh-water-pipeline-trenching",
    sample: true,
    title: {
      en: "Trenching and pipe laying for a water transmission line",
      ar: "حفر الخنادق ومد الأنابيب لخط نقل مياه",
    },
    type: { en: "Infrastructure", ar: "بنية تحتية" },
    client: { en: "Utilities contractor", ar: "مقاول مرافق" },
    area: "riyadh",
    location: { en: "East Riyadh", ar: "شرق الرياض" },
    year: 2024,
    duration: { en: "5 months", ar: "5 أشهر" },
    summary: {
      en: "Excavators opened and backfilled the trench along a 3.2 km water line, handling pipe sections into place, with dewatering pumps on standby for the low sections.",
      ar: "تولت الحفارات فتح الخندق وردمه على امتداد خط مياه طوله 3.2 كيلومتر وإنزال أجزاء الأنابيب في مواضعها، مع مضخات نزح احتياطية للمقاطع المنخفضة.",
    },
    scope: {
      en: [
        "36 t excavator for bulk trench excavation",
        "20 t excavator for pipe handling and bedding",
        "Backhoe loader for backfill and reinstatement",
        "6 inch dewatering pumps for the low sections of the route",
      ],
      ar: [
        "حفار بوزن 36 طناً لأعمال الحفر الرئيسية للخندق",
        "حفار بوزن 20 طناً لمناولة الأنابيب وتجهيز فرشتها",
        "جرافة حفار لأعمال الردم وإعادة الموقع",
        "مضخات نزح 6 بوصات للمقاطع المنخفضة من المسار",
      ],
    },
    facts: [
      { label: { en: "Line length", ar: "طول الخط" }, value: { en: "3.2 km", ar: "3.2 km" } },
      { label: { en: "Deepest trench", ar: "أقصى عمق للخندق" }, value: { en: "4 m", ar: "4 m" } },
      { label: { en: "Operators supplied", ar: "المشغلون" }, value: { en: "3", ar: "3" } },
    ],
    equipment: ["excavator-36t", "excavator-20t", "backhoe-loader", "dewatering-pump-6in"],
  },
  {
    slug: "khobar-plant-relocation",
    sample: true,
    title: {
      en: "Relocating earthmoving plant between Eastern Province sites",
      ar: "نقل معدات الحفر والتحميل بين مواقع المنطقة الشرقية",
    },
    type: { en: "Heavy transport", ar: "نقل ثقيل" },
    client: { en: "Civil works contractor", ar: "مقاول أعمال مدنية" },
    area: "khobar",
    location: { en: "Al Khobar and Dhahran", ar: "الخبر والظهران" },
    year: 2024,
    duration: { en: "3 weeks", ar: "3 أسابيع" },
    summary: {
      en: "Low-bed transport moved excavators, loaders and a scraper between three sites at night, with each route checked for height and weight limits before the move.",
      ar: "نُقلت الحفارات واللوادر وكاشطة بين ثلاثة مواقع ليلاً بالمقطورات المنخفضة، بعد التحقق من قيود الارتفاع والوزن على كل مسار قبل النقل.",
    },
    scope: {
      en: [
        "Route checks for height, weight and turning restrictions",
        "60 t low-bed trailer with prime mover and escort vehicles",
        "Night moves outside peak traffic hours",
        "Loading and securing supervised at both ends",
      ],
      ar: [
        "التحقق من قيود الارتفاع والوزن والانعطاف على المسارات",
        "مقطورة منخفضة بحمولة 60 طناً مع شاحنة جر ومركبات مرافقة",
        "النقل ليلاً خارج أوقات الذروة",
        "الإشراف على التحميل والتثبيت في نقطتي البداية والنهاية",
      ],
    },
    facts: [
      { label: { en: "Moves completed", ar: "عمليات النقل" }, value: { en: "14", ar: "14" } },
      { label: { en: "Heaviest load", ar: "أثقل حمولة" }, value: { en: "38 t", ar: "38 t" } },
      { label: { en: "Moves scheduled", ar: "توقيت النقل" }, value: { en: "Overnight", ar: "ليلاً" } },
    ],
    equipment: ["low-bed-trailer-60t", "excavator-36t", "wheel-loader-3m3"],
  },
  {
    slug: "jeddah-coastal-site-preparation",
    sample: true,
    title: {
      en: "Site clearance for a coastal residential compound",
      ar: "تجهيز موقع مجمع سكني ساحلي",
    },
    type: { en: "Earthworks", ar: "أعمال ترابية" },
    client: { en: "Residential developer", ar: "مطور سكني" },
    area: "jeddah",
    location: { en: "North Jeddah", ar: "شمال جدة" },
    year: 2025,
    duration: { en: "6 weeks", ar: "6 أسابيع" },
    summary: {
      en: "A wheel loader and backhoe loader cleared and levelled the plot and loaded haul trucks, with a boom truck for unloading site cabins and materials.",
      ar: "تولى لودر وجرافة حفار تنظيف الأرض وتسويتها وتحميل شاحنات النقل، مع شاحنة ذات ذراع لتفريغ الكبائن والمواد في الموقع.",
    },
    scope: {
      en: [
        "Wheel loader for clearance, stockpiling and loading haul trucks",
        "Backhoe loader for trenches for temporary services",
        "15 t boom truck for site cabins and materials",
        "Weekly rental, ended as soon as the plot was handed over",
      ],
      ar: [
        "لودر لتنظيف الموقع وتكويم المواد وتحميل الشاحنات",
        "جرافة حفار لحفر خنادق الخدمات المؤقتة",
        "شاحنة ذات ذراع بحمولة 15 طناً للكبائن والمواد",
        "إيجار أسبوعي انتهى فور تسليم الأرض",
      ],
    },
    facts: [
      { label: { en: "Plot area", ar: "مساحة الأرض" }, value: { en: "35,000 m²", ar: "35,000 m²" } },
      { label: { en: "Material moved", ar: "المواد المنقولة" }, value: { en: "18,000 m³", ar: "18,000 m³" } },
      { label: { en: "Rental", ar: "الإيجار" }, value: { en: "Weekly", ar: "أسبوعي" } },
    ],
    equipment: ["wheel-loader-3m3", "backhoe-loader", "boom-truck-15t"],
  },
];
