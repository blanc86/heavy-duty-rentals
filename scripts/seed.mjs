#!/usr/bin/env node
/**
 * Development seed.
 *
 * ============================== IMPORTANT ==============================
 * EVERY equipment record created here is FICTIONAL and is flagged
 * `is_demo_data = true`, which makes the UI render a "Demo data" badge on it.
 *
 * The machines do not exist. The rates are plausible market figures taken from
 * published secondary sources (see docs/research.md §4) purely so the pricing
 * engine has realistic magnitudes to work with — they are NOT this business's
 * prices. The company name, VAT number, CR number, address and phone are
 * placeholders.
 *
 * Nothing here asserts a certification, a customer, a safety record or a
 * statistic. Replace all of it with real inventory before any public
 * deployment.
 * =======================================================================
 */
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { hash as argonHash } from "@node-rs/argon2";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(here, "..", ".env"));
} catch {
  /* environment may be injected by the platform */
}

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data into a production environment.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

// --- helpers ---------------------------------------------------------------

function uuidv7() {
  const bytes = randomBytes(16);
  const ms = BigInt(Date.now());
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** SAR -> halalas. All money in the database is an integer number of halalas. */
const sar = (amount) => BigInt(Math.round(amount * 100));

// --- reference data --------------------------------------------------------

const BRANCHES = [
  {
    slug: "riyadh", nameEn: "Riyadh Depot", nameAr: "مستودع الرياض",
    city: "Riyadh", cityAr: "الرياض", region: "Riyadh Province", regionAr: "منطقة الرياض",
    addressEn: "Second Industrial City, Riyadh (demo address)",
    addressAr: "المدينة الصناعية الثانية، الرياض (عنوان تجريبي)",
    lat: "24.6280", lng: "46.8420", phone: "+966 11 000 0000",
  },
  {
    slug: "jeddah", nameEn: "Jeddah Depot", nameAr: "مستودع جدة",
    city: "Jeddah", cityAr: "جدة", region: "Makkah Province", regionAr: "منطقة مكة المكرمة",
    addressEn: "Industrial Area, Jeddah (demo address)",
    addressAr: "المنطقة الصناعية، جدة (عنوان تجريبي)",
    lat: "21.4400", lng: "39.2200", phone: "+966 12 000 0000",
  },
  {
    slug: "dammam", nameEn: "Dammam Depot", nameAr: "مستودع الدمام",
    city: "Dammam", cityAr: "الدمام", region: "Eastern Province", regionAr: "المنطقة الشرقية",
    addressEn: "Second Industrial City, Dammam (demo address)",
    addressAr: "المدينة الصناعية الثانية، الدمام (عنوان تجريبي)",
    lat: "26.3400", lng: "50.1100", phone: "+966 13 000 0000",
  },
  {
    slug: "khobar", nameEn: "Khobar Yard", nameAr: "ساحة الخبر",
    city: "Khobar", cityAr: "الخبر", region: "Eastern Province", regionAr: "المنطقة الشرقية",
    addressEn: "Industrial Area, Al Khobar (demo address)",
    addressAr: "المنطقة الصناعية، الخبر (عنوان تجريبي)",
    lat: "26.2170", lng: "50.1970", phone: "+966 13 000 0001",
  },
  {
    slug: "jubail", nameEn: "Jubail Industrial Yard", nameAr: "ساحة الجبيل الصناعية",
    city: "Jubail", cityAr: "الجبيل", region: "Eastern Province", regionAr: "المنطقة الشرقية",
    addressEn: "Jubail Industrial City (demo address)",
    addressAr: "مدينة الجبيل الصناعية (عنوان تجريبي)",
    lat: "27.0100", lng: "49.6580", phone: "+966 13 000 0002",
  },
];

/**
 * Filter schemas. These drive the category-aware filter panel — adding a filter
 * is a data change, not a deploy.
 */
const CRANE_FILTERS = [
  { key: "capacityKg", labelEn: "Capacity", labelAr: "الحمولة", type: "range", unit: "t", min: 0, max: 1200, step: 5, sortOrder: 1 },
  { key: "maxBoomM", labelEn: "Main boom length", labelAr: "طول الذراع الرئيسي", type: "range", unit: "m", min: 0, max: 120, step: 1, sortOrder: 2 },
  { key: "maxRadiusM", labelEn: "Maximum radius", labelAr: "أقصى نصف قطر", type: "range", unit: "m", min: 0, max: 100, step: 1, sortOrder: 3 },
  { key: "driveType", labelEn: "Drive", labelAr: "نوع الدفع", type: "select", sortOrder: 4,
    options: [
      { value: "all_terrain", labelEn: "All terrain", labelAr: "جميع التضاريس" },
      { value: "rough_terrain", labelEn: "Rough terrain", labelAr: "التضاريس الوعرة" },
      { value: "truck", labelEn: "Truck mounted", labelAr: "مركبة على شاحنة" },
      { value: "crawler", labelEn: "Crawler", labelAr: "زاحفة" },
    ] },
];

const FORKLIFT_FILTERS = [
  { key: "capacityKg", labelEn: "Capacity", labelAr: "الحمولة", type: "range", unit: "kg", min: 0, max: 30000, step: 500, sortOrder: 1 },
  { key: "liftHeightM", labelEn: "Lift height", labelAr: "ارتفاع الرفع", type: "range", unit: "m", min: 0, max: 20, step: 0.5, sortOrder: 2 },
  { key: "fuelType", labelEn: "Power", labelAr: "مصدر الطاقة", type: "select", sortOrder: 3,
    options: [
      { value: "diesel", labelEn: "Diesel", labelAr: "ديزل" },
      { value: "lpg", labelEn: "LPG", labelAr: "غاز" },
      { value: "electric", labelEn: "Electric", labelAr: "كهربائي" },
    ] },
  { key: "tyreType", labelEn: "Tyres", labelAr: "الإطارات", type: "select", sortOrder: 4,
    options: [
      { value: "pneumatic", labelEn: "Pneumatic", labelAr: "هوائية" },
      { value: "solid", labelEn: "Solid", labelAr: "صلبة" },
    ] },
];

const EARTHMOVING_FILTERS = [
  { key: "operatingWeightKg", labelEn: "Operating weight", labelAr: "وزن التشغيل", type: "range", unit: "kg", min: 0, max: 90000, step: 1000, sortOrder: 1 },
  { key: "bucketM3", labelEn: "Bucket capacity", labelAr: "سعة الدلو", type: "range", unit: "m³", min: 0, max: 6, step: 0.1, sortOrder: 2 },
  { key: "enginePowerKw", labelEn: "Engine power", labelAr: "قدرة المحرك", type: "range", unit: "kW", min: 0, max: 500, step: 10, sortOrder: 3 },
];

const ACCESS_FILTERS = [
  { key: "workingHeightM", labelEn: "Working height", labelAr: "ارتفاع العمل", type: "range", unit: "m", min: 0, max: 60, step: 1, sortOrder: 1 },
  { key: "platformCapacityKg", labelEn: "Platform capacity", labelAr: "حمولة المنصة", type: "range", unit: "kg", min: 0, max: 1000, step: 25, sortOrder: 2 },
  { key: "fuelType", labelEn: "Power", labelAr: "مصدر الطاقة", type: "select", sortOrder: 3,
    options: [
      { value: "diesel", labelEn: "Diesel", labelAr: "ديزل" },
      { value: "electric", labelEn: "Electric", labelAr: "كهربائي" },
    ] },
];

const POWER_FILTERS = [
  { key: "outputKva", labelEn: "Output", labelAr: "القدرة", type: "range", unit: "kVA", min: 0, max: 1500, step: 10, sortOrder: 1 },
  { key: "fuelTankL", labelEn: "Fuel tank", labelAr: "خزان الوقود", type: "range", unit: "L", min: 0, max: 2000, step: 50, sortOrder: 2 },
];

const TRANSPORT_FILTERS = [
  { key: "payloadKg", labelEn: "Payload", labelAr: "الحمولة", type: "range", unit: "kg", min: 0, max: 120000, step: 5000, sortOrder: 1 },
  { key: "deckLengthM", labelEn: "Deck length", labelAr: "طول السطح", type: "range", unit: "m", min: 0, max: 30, step: 0.5, sortOrder: 2 },
];

const CATEGORIES = [
  { slug: "mobile-cranes", nameEn: "Mobile Cranes", nameAr: "رافعات متحركة",
    descEn: "All-terrain, rough-terrain and truck-mounted cranes for lifting on constrained sites.",
    descAr: "رافعات لجميع التضاريس والتضاريس الوعرة ورافعات الشاحنات لأعمال الرفع في المواقع المحدودة.",
    filters: CRANE_FILTERS, sort: 1 },
  { slug: "crawler-cranes", nameEn: "Crawler Cranes", nameAr: "رافعات زاحفة",
    descEn: "Heavy-lift crawler cranes for sustained duty on prepared ground.",
    descAr: "رافعات زاحفة للرفع الثقيل والعمل المستمر على أرض مجهزة.",
    filters: CRANE_FILTERS, sort: 2 },
  { slug: "boom-trucks", nameEn: "Boom Trucks", nameAr: "شاحنات ذات ذراع",
    descEn: "Truck-mounted knuckle and telescopic boom cranes for load-and-carry work.",
    descAr: "شاحنات مزودة بذراع تلسكوبي أو مفصلي لأعمال التحميل والنقل.",
    filters: CRANE_FILTERS, sort: 3 },
  { slug: "forklifts", nameEn: "Forklifts", nameAr: "رافعات شوكية",
    descEn: "Diesel, LPG and electric forklifts from warehouse to heavy industrial duty.",
    descAr: "رافعات شوكية ديزل وغاز وكهربائية للمستودعات والأعمال الصناعية الثقيلة.",
    filters: FORKLIFT_FILTERS, sort: 4 },
  { slug: "telehandlers", nameEn: "Telehandlers", nameAr: "رافعات تلسكوبية",
    descEn: "Telescopic handlers for placing loads at height and reach on site.",
    descAr: "رافعات تلسكوبية لوضع الأحمال على ارتفاع ومدى في الموقع.",
    filters: FORKLIFT_FILTERS, sort: 5 },
  { slug: "excavators", nameEn: "Excavators", nameAr: "حفارات",
    descEn: "Tracked excavators for bulk earthworks, trenching and demolition support.",
    descAr: "حفارات مجنزرة لأعمال الحفر والخنادق ودعم الهدم.",
    filters: EARTHMOVING_FILTERS, sort: 6 },
  { slug: "wheel-loaders", nameEn: "Wheel Loaders", nameAr: "لوادر بعجل",
    descEn: "Wheel loaders for stockpiling, loading and site haulage.",
    descAr: "لوادر بعجل للتكديس والتحميل والنقل داخل الموقع.",
    filters: EARTHMOVING_FILTERS, sort: 7 },
  { slug: "backhoe-loaders", nameEn: "Backhoe Loaders", nameAr: "حفارات لودر",
    descEn: "Combined loader and backhoe machines for utilities and general site work.",
    descAr: "معدات تجمع بين اللودر والحفار لأعمال المرافق والأعمال العامة.",
    filters: EARTHMOVING_FILTERS, sort: 8 },
  { slug: "manlifts", nameEn: "Manlifts / MEWPs", nameAr: "رافعات أفراد",
    descEn: "Articulating and telescopic boom lifts for elevated access.",
    descAr: "رافعات ذات ذراع مفصلي أو تلسكوبي للوصول إلى المرتفعات.",
    filters: ACCESS_FILTERS, sort: 9 },
  { slug: "scissor-lifts", nameEn: "Scissor Lifts", nameAr: "رافعات مقصية",
    descEn: "Vertical platform lifts for indoor and slab-level access work.",
    descAr: "رافعات منصات عمودية للأعمال الداخلية والوصول على مستوى البلاطة.",
    filters: ACCESS_FILTERS, sort: 10 },
  { slug: "generators", nameEn: "Generators", nameAr: "مولدات كهربائية",
    descEn: "Silenced diesel generator sets for temporary and standby site power.",
    descAr: "مولدات ديزل صامتة للطاقة المؤقتة والاحتياطية في الموقع.",
    filters: POWER_FILTERS, sort: 11 },
  { slug: "air-compressors", nameEn: "Air Compressors", nameAr: "ضواغط هواء",
    descEn: "Portable diesel screw compressors for breaking, blasting and tooling.",
    descAr: "ضواغط هواء ديزل متنقلة لأعمال التكسير والتنظيف والمعدات الهوائية.",
    filters: POWER_FILTERS, sort: 12 },
  { slug: "dewatering-pumps", nameEn: "Dewatering Pumps", nameAr: "مضخات نزح المياه",
    descEn: "Diesel-driven pumps for excavation dewatering and bypass duty.",
    descAr: "مضخات تعمل بالديزل لنزح المياه من الحفريات وأعمال التحويل.",
    filters: POWER_FILTERS, sort: 13 },
  { slug: "low-bed-trailers", nameEn: "Low-bed & Hydraulic Trailers", nameAr: "مقطورات منخفضة وهيدروليكية",
    descEn: "Low-bed and modular hydraulic trailers for plant and abnormal loads.",
    descAr: "مقطورات منخفضة ومقطورات هيدروليكية معيارية لنقل المعدات والأحمال غير الاعتيادية.",
    filters: TRANSPORT_FILTERS, sort: 14 },
];

/**
 * Equipment classes.
 *
 * Manufacturer/model names are real industry designations so specification
 * data is coherent, but the UNITS are fictional. Rates sit inside the published
 * market ranges recorded in docs/research.md §4.
 */
const CLASSES = [
  {
    slug: "all-terrain-crane-50t", category: "mobile-cranes",
    nameEn: "50 Tonne All-Terrain Crane", nameAr: "رافعة جميع التضاريس 50 طن",
    manufacturer: "Liebherr", model: "LTM 1050-3.1",
    capacityKg: 50000, minDays: 1, mobBuffer: 1, demobBuffer: 1,
    deposit: 8000, fuel: "dry", transportClass: "crane_medium",
    lowBed: true, escort: false, instant: true, requiresOperator: true,
    rates: { daily: 2400, weekly: 14400, monthly: 50400 },
    descEn: "Three-axle all-terrain crane suited to urban and industrial sites where access is tight. Fast set-up and good road mobility between lifts.",
    descAr: "رافعة جميع التضاريس بثلاثة محاور مناسبة للمواقع الحضرية والصناعية ذات المداخل الضيقة. سرعة في التجهيز وقدرة جيدة على التنقل بين عمليات الرفع.",
    specs: { maxBoomM: 38, maxRadiusM: 34, driveType: "all_terrain", axles: 3, transportWeightKg: 36000 },
    incEn: ["Certified crane operator", "Standard rigging (slings and shackles)", "Routine servicing during hire", "Third-party inspection certificate"],
    incAr: ["مشغل رافعة معتمد", "معدات ربط قياسية (أحزمة ومشابك)", "الصيانة الدورية أثناء فترة الإيجار", "شهادة فحص من طرف ثالث"],
    excEn: ["Fuel", "Site preparation and ground bearing assessment", "Lift plan and method statement", "Permits and road closures", "Standby time outside agreed shift"],
    excAr: ["الوقود", "تجهيز الموقع وتقييم تحمل التربة", "خطة الرفع وبيان الطريقة", "التصاريح وإغلاق الطرق", "وقت الانتظار خارج الوردية المتفق عليها"],
  },
  {
    slug: "all-terrain-crane-100t", category: "mobile-cranes",
    nameEn: "100 Tonne All-Terrain Crane", nameAr: "رافعة جميع التضاريس 100 طن",
    manufacturer: "Liebherr", model: "LTM 1100-4.2",
    capacityKg: 100000, minDays: 1, mobBuffer: 1, demobBuffer: 1,
    deposit: 15000, fuel: "dry", transportClass: "crane_large",
    lowBed: true, escort: false, instant: true, requiresOperator: true,
    rates: { daily: 4200, weekly: 25200, monthly: 88200 },
    descEn: "Four-axle all-terrain crane covering the majority of mid-rise construction and plant maintenance lifts. Long telescopic boom with a strong load chart at radius.",
    descAr: "رافعة جميع التضاريس بأربعة محاور تغطي معظم عمليات الرفع في المباني متوسطة الارتفاع وصيانة المصانع. ذراع تلسكوبي طويل مع جدول أحمال قوي عند نصف القطر.",
    specs: { maxBoomM: 60, maxRadiusM: 56, driveType: "all_terrain", axles: 4, transportWeightKg: 48000 },
    incEn: ["Certified crane operator", "Standard rigging (slings and shackles)", "Routine servicing during hire", "Third-party inspection certificate"],
    incAr: ["مشغل رافعة معتمد", "معدات ربط قياسية (أحزمة ومشابك)", "الصيانة الدورية أثناء فترة الإيجار", "شهادة فحص من طرف ثالث"],
    excEn: ["Fuel", "Site preparation and ground bearing assessment", "Lift plan and method statement", "Permits and road closures", "Standby time outside agreed shift"],
    excAr: ["الوقود", "تجهيز الموقع وتقييم تحمل التربة", "خطة الرفع وبيان الطريقة", "التصاريح وإغلاق الطرق", "وقت الانتظار خارج الوردية المتفق عليها"],
  },
  {
    slug: "all-terrain-crane-200t", category: "mobile-cranes",
    nameEn: "200 Tonne All-Terrain Crane", nameAr: "رافعة جميع التضاريس 200 طن",
    manufacturer: "Grove", model: "GMK5200-1",
    capacityKg: 200000, minDays: 2, mobBuffer: 2, demobBuffer: 2,
    deposit: 30000, fuel: "dry", transportClass: "crane_heavy",
    lowBed: true, escort: true, instant: true, requiresOperator: true,
    rates: { daily: 8500, weekly: 51000, monthly: 178500 },
    descEn: "Five-axle heavy class crane for structural steel, vessel setting and major plant work. Requires prepared ground and a documented lift plan.",
    descAr: "رافعة من الفئة الثقيلة بخمسة محاور لأعمال الهياكل المعدنية وتركيب الأوعية والأعمال الصناعية الكبرى. تتطلب أرضاً مجهزة وخطة رفع موثقة.",
    specs: { maxBoomM: 78, maxRadiusM: 70, driveType: "all_terrain", axles: 5, transportWeightKg: 72000 },
    incEn: ["Certified crane operator", "Rigger and banksman", "Counterweight transport", "Third-party inspection certificate"],
    incAr: ["مشغل رافعة معتمد", "فني ربط ومشير", "نقل الأثقال الموازنة", "شهادة فحص من طرف ثالث"],
    excEn: ["Fuel", "Ground bearing pressure assessment and matting", "Lift plan and method statement", "Permits, escorts and road closures", "Standby time outside agreed shift"],
    excAr: ["الوقود", "تقييم ضغط تحمل التربة والحصائر", "خطة الرفع وبيان الطريقة", "التصاريح والمرافقة وإغلاق الطرق", "وقت الانتظار خارج الوردية المتفق عليها"],
  },
  {
    slug: "crawler-crane-300t", category: "crawler-cranes",
    nameEn: "300 Tonne Crawler Crane", nameAr: "رافعة زاحفة 300 طن",
    manufacturer: "Liebherr", model: "LR 1300",
    capacityKg: 300000, minDays: 14, mobBuffer: 4, demobBuffer: 4,
    deposit: 60000, fuel: "dry", transportClass: "crawler_heavy",
    lowBed: true, escort: true,
    // Deliberately NOT instant-bookable: mobilisation for this class depends on
    // a route survey and multiple loads, and can reach 20-40% of the job cost.
    // Quoting an instant price here would be a guess presented as a number.
    instant: false, requiresOperator: true,
    rates: { daily: 16000, weekly: 96000, monthly: 336000 },
    descEn: "Lattice-boom crawler crane for sustained heavy lifting on prepared ground. Mobilisation is priced individually because it depends on route survey, permits and the number of transport loads.",
    descAr: "رافعة زاحفة بذراع شبكي للرفع الثقيل المستمر على أرض مجهزة. يتم تسعير التعبئة والنقل بشكل منفصل لأنها تعتمد على دراسة المسار والتصاريح وعدد أحمال النقل.",
    specs: { maxBoomM: 96, maxRadiusM: 84, driveType: "crawler", transportLoads: 14 },
    incEn: ["Certified crane operator", "Assembly and dismantling crew", "Third-party inspection certificate"],
    incAr: ["مشغل رافعة معتمد", "طاقم التركيب والفك", "شهادة فحص من طرف ثالث"],
    excEn: ["Fuel", "Assist crane for assembly", "Ground preparation and crane mats", "Lift plan and method statement", "Permits, escorts and route survey"],
    excAr: ["الوقود", "رافعة مساعدة للتركيب", "تجهيز الأرض وحصائر الرافعة", "خطة الرفع وبيان الطريقة", "التصاريح والمرافقة ودراسة المسار"],
  },
  {
    slug: "boom-truck-15t", category: "boom-trucks",
    nameEn: "15 Tonne Boom Truck", nameAr: "شاحنة ذات ذراع 15 طن",
    manufacturer: "Hiab", model: "X-HiPro 548",
    capacityKg: 15000, minDays: 1, mobBuffer: 0, demobBuffer: 0,
    deposit: 3000, fuel: "wet", transportClass: "self_drive",
    lowBed: false, escort: false, instant: true, requiresOperator: true,
    rates: { daily: 1300, weekly: 7800, monthly: 27300 },
    descEn: "Truck-mounted knuckle boom crane with a flatbed body. Ideal for load-and-carry duties, delivering materials and placing plant where a dedicated crane is not justified.",
    descAr: "رافعة ذات ذراع مفصلي مركبة على شاحنة بصندوق مسطح. مثالية لأعمال التحميل والنقل وتوصيل المواد ووضع المعدات حيث لا تستدعي الحاجة رافعة مخصصة.",
    specs: { maxBoomM: 19, maxRadiusM: 18, driveType: "truck", deckLengthM: 7.2 },
    incEn: ["Certified operator", "Fuel", "Standard slings and chains", "Flatbed body"],
    incAr: ["مشغل معتمد", "الوقود", "أحزمة وسلاسل قياسية", "صندوق مسطح"],
    excEn: ["Overtime beyond 10-hour shift", "Permits for abnormal loads", "Waiting time on site"],
    excAr: ["العمل الإضافي بعد وردية 10 ساعات", "تصاريح الأحمال غير الاعتيادية", "وقت الانتظار في الموقع"],
  },
  {
    slug: "forklift-3t-diesel", category: "forklifts",
    nameEn: "3 Tonne Diesel Forklift", nameAr: "رافعة شوكية ديزل 3 طن",
    manufacturer: "Toyota", model: "8FD30",
    capacityKg: 3000, minDays: 1, mobBuffer: 0, demobBuffer: 0,
    deposit: 1500, fuel: "dry", transportClass: "light_plant",
    lowBed: false, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 420, weekly: 2310, monthly: 7560 },
    descEn: "General-purpose diesel counterbalance forklift for yard and warehouse handling. Pneumatic tyres suit unsealed ground.",
    descAr: "رافعة شوكية ديزل متوازنة للأغراض العامة لأعمال المناولة في الساحات والمستودعات. الإطارات الهوائية مناسبة للأرضيات غير المعبدة.",
    specs: { liftHeightM: 4.5, fuelType: "diesel", tyreType: "pneumatic", operatingWeightKg: 4400 },
    incEn: ["Standard forks", "Routine servicing during hire", "Third-party inspection certificate"],
    incAr: ["شوكات قياسية", "الصيانة الدورية أثناء فترة الإيجار", "شهادة فحص من طرف ثالث"],
    excEn: ["Operator (available as an add-on)", "Fuel", "Attachments beyond standard forks", "Damage to forks or tyres"],
    excAr: ["المشغل (متاح كخدمة إضافية)", "الوقود", "الملحقات غير الشوكات القياسية", "الأضرار التي تلحق بالشوكات أو الإطارات"],
  },
  {
    slug: "forklift-16t-diesel", category: "forklifts",
    nameEn: "16 Tonne Diesel Forklift", nameAr: "رافعة شوكية ديزل 16 طن",
    manufacturer: "Hyster", model: "H16XM-12",
    capacityKg: 16000, minDays: 2, mobBuffer: 1, demobBuffer: 1,
    deposit: 6000, fuel: "dry", transportClass: "heavy_plant",
    lowBed: true, escort: false, instant: true, requiresOperator: true,
    rates: { daily: 1850, weekly: 11100, monthly: 38850 },
    descEn: "Heavy industrial forklift for handling containers, steel sections and plant components in ports and industrial yards.",
    descAr: "رافعة شوكية صناعية ثقيلة لمناولة الحاويات والمقاطع المعدنية ومكونات المعدات في الموانئ والساحات الصناعية.",
    specs: { liftHeightM: 5.5, fuelType: "diesel", tyreType: "pneumatic", operatingWeightKg: 23000 },
    incEn: ["Certified operator", "Standard forks", "Routine servicing during hire", "Third-party inspection certificate"],
    incAr: ["مشغل معتمد", "شوكات قياسية", "الصيانة الدورية أثناء فترة الإيجار", "شهادة فحص من طرف ثالث"],
    excEn: ["Fuel", "Attachments beyond standard forks", "Permits for transport", "Overtime beyond 10-hour shift"],
    excAr: ["الوقود", "الملحقات غير الشوكات القياسية", "تصاريح النقل", "العمل الإضافي بعد وردية 10 ساعات"],
  },
  {
    slug: "telehandler-17m", category: "telehandlers",
    nameEn: "17 m Telehandler", nameAr: "رافعة تلسكوبية 17 متر",
    manufacturer: "JCB", model: "540-170",
    capacityKg: 4000, minDays: 1, mobBuffer: 0, demobBuffer: 0,
    deposit: 2500, fuel: "dry", transportClass: "light_plant",
    lowBed: false, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 780, weekly: 4290, monthly: 14040 },
    descEn: "Telescopic handler with 4 tonne capacity and 17 metre lift height. Handles palletised materials at height without a crane.",
    descAr: "رافعة تلسكوبية بحمولة 4 أطنان وارتفاع رفع 17 متراً. تتعامل مع المواد المرصوصة على المنصات في الارتفاعات دون الحاجة إلى رافعة.",
    specs: { liftHeightM: 17, fuelType: "diesel", tyreType: "pneumatic", operatingWeightKg: 11000 },
    incEn: ["Standard forks", "Routine servicing during hire", "Third-party inspection certificate"],
    incAr: ["شوكات قياسية", "الصيانة الدورية أثناء فترة الإيجار", "شهادة فحص من طرف ثالث"],
    excEn: ["Operator (available as an add-on)", "Fuel", "Jib or bucket attachments", "Damage to tyres"],
    excAr: ["المشغل (متاح كخدمة إضافية)", "الوقود", "ملحقات الذراع أو الدلو", "الأضرار التي تلحق بالإطارات"],
  },
  {
    slug: "excavator-20t", category: "excavators",
    nameEn: "20 Tonne Tracked Excavator", nameAr: "حفار مجنزر 20 طن",
    manufacturer: "Caterpillar", model: "320",
    capacityKg: 20000, minDays: 1, mobBuffer: 1, demobBuffer: 1,
    deposit: 5000, fuel: "dry", transportClass: "heavy_plant",
    lowBed: true, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 1150, weekly: 6900, monthly: 24150 },
    descEn: "The general-purpose size class for bulk earthworks, trenching and loading. Quick coupler fitted as standard.",
    descAr: "فئة الحجم متعددة الاستخدامات لأعمال الحفر الكبيرة والخنادق والتحميل. مزود بوصلة سريعة كتجهيز قياسي.",
    specs: { operatingWeightKg: 20200, bucketM3: 1.19, enginePowerKw: 122, maxDigDepthM: 6.7 },
    incEn: ["General purpose bucket", "Quick coupler", "Routine servicing during hire"],
    incAr: ["دلو للأغراض العامة", "وصلة سريعة", "الصيانة الدورية أثناء فترة الإيجار"],
    excEn: ["Operator (available as an add-on)", "Fuel", "Breaker or specialist attachments", "Track damage from unsuitable ground"],
    excAr: ["المشغل (متاح كخدمة إضافية)", "الوقود", "الكسارة أو الملحقات المتخصصة", "أضرار الجنزير الناتجة عن أرض غير مناسبة"],
  },
  {
    slug: "excavator-36t", category: "excavators",
    nameEn: "36 Tonne Tracked Excavator", nameAr: "حفار مجنزر 36 طن",
    manufacturer: "Komatsu", model: "PC360LC-11",
    capacityKg: 36000, minDays: 2, mobBuffer: 1, demobBuffer: 1,
    deposit: 9000, fuel: "dry", transportClass: "heavy_plant",
    lowBed: true, escort: false, instant: true, requiresOperator: true,
    rates: { daily: 2100, weekly: 12600, monthly: 44100 },
    descEn: "Large tracked excavator for mass excavation, rock handling and heavy demolition support.",
    descAr: "حفار مجنزر كبير لأعمال الحفر الضخمة ومناولة الصخور ودعم أعمال الهدم الثقيلة.",
    specs: { operatingWeightKg: 36500, bucketM3: 2.1, enginePowerKw: 202, maxDigDepthM: 7.8 },
    incEn: ["Certified operator", "General purpose bucket", "Routine servicing during hire"],
    incAr: ["مشغل معتمد", "دلو للأغراض العامة", "الصيانة الدورية أثناء فترة الإيجار"],
    excEn: ["Fuel", "Breaker or specialist attachments", "Transport permits", "Overtime beyond 10-hour shift"],
    excAr: ["الوقود", "الكسارة أو الملحقات المتخصصة", "تصاريح النقل", "العمل الإضافي بعد وردية 10 ساعات"],
  },
  {
    slug: "wheel-loader-3m3", category: "wheel-loaders",
    nameEn: "3 m³ Wheel Loader", nameAr: "لودر بعجل 3 م³",
    manufacturer: "Volvo", model: "L120H",
    capacityKg: 20000, minDays: 1, mobBuffer: 1, demobBuffer: 1,
    deposit: 5000, fuel: "dry", transportClass: "heavy_plant",
    lowBed: true, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 1080, weekly: 6480, monthly: 22680 },
    descEn: "Mid-size wheel loader for stockpile handling, truck loading and general site logistics.",
    descAr: "لودر بعجل متوسط الحجم لمناولة الأكوام وتحميل الشاحنات والخدمات اللوجستية العامة في الموقع.",
    specs: { operatingWeightKg: 20400, bucketM3: 3.0, enginePowerKw: 195 },
    incEn: ["General purpose bucket", "Routine servicing during hire"],
    incAr: ["دلو للأغراض العامة", "الصيانة الدورية أثناء فترة الإيجار"],
    excEn: ["Operator (available as an add-on)", "Fuel", "Specialist attachments", "Tyre damage"],
    excAr: ["المشغل (متاح كخدمة إضافية)", "الوقود", "الملحقات المتخصصة", "أضرار الإطارات"],
  },
  {
    slug: "backhoe-loader", category: "backhoe-loaders",
    nameEn: "Backhoe Loader", nameAr: "حفار لودر",
    manufacturer: "JCB", model: "3CX",
    capacityKg: 8000, minDays: 1, mobBuffer: 0, demobBuffer: 0,
    deposit: 2000, fuel: "dry", transportClass: "light_plant",
    lowBed: false, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 560, weekly: 3080, monthly: 10080 },
    descEn: "Combined loader and backhoe for utilities, trenching and general site work where a single versatile machine is preferable to two.",
    descAr: "معدة تجمع بين اللودر والحفار لأعمال المرافق والخنادق والأعمال العامة حيث تكون معدة واحدة متعددة الاستخدامات أفضل من اثنتين.",
    specs: { operatingWeightKg: 8200, bucketM3: 1.0, enginePowerKw: 81, maxDigDepthM: 5.5 },
    incEn: ["Loader bucket and backhoe bucket", "Routine servicing during hire"],
    incAr: ["دلو اللودر ودلو الحفار", "الصيانة الدورية أثناء فترة الإيجار"],
    excEn: ["Operator (available as an add-on)", "Fuel", "Breaker attachment", "Tyre damage"],
    excAr: ["المشغل (متاح كخدمة إضافية)", "الوقود", "ملحق الكسارة", "أضرار الإطارات"],
  },
  {
    slug: "boom-lift-28m", category: "manlifts",
    nameEn: "28 m Articulating Boom Lift", nameAr: "رافعة أفراد مفصلية 28 متر",
    manufacturer: "Genie", model: "Z-80/60",
    capacityKg: 227, minDays: 1, mobBuffer: 0, demobBuffer: 0,
    deposit: 3000, fuel: "dry", transportClass: "light_plant",
    lowBed: false, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 890, weekly: 4895, monthly: 16020 },
    descEn: "Diesel articulating boom lift with up-and-over reach for elevated access around structures and plant.",
    descAr: "رافعة أفراد مفصلية تعمل بالديزل بمدى وصول فوق العوائق للوصول إلى المرتفعات حول الهياكل والمعدات.",
    specs: { workingHeightM: 26.4, platformCapacityKg: 227, fuelType: "diesel", horizontalReachM: 18.3 },
    incEn: ["Harness anchor points", "Routine servicing during hire", "Third-party inspection certificate"],
    incAr: ["نقاط تثبيت الحزام", "الصيانة الدورية أثناء فترة الإيجار", "شهادة فحص من طرف ثالث"],
    excEn: ["Operator (available as an add-on)", "Fuel", "Fall-arrest harnesses", "Ground preparation"],
    excAr: ["المشغل (متاح كخدمة إضافية)", "الوقود", "أحزمة منع السقوط", "تجهيز الأرض"],
  },
  {
    slug: "scissor-lift-12m", category: "scissor-lifts",
    nameEn: "12 m Electric Scissor Lift", nameAr: "رافعة مقصية كهربائية 12 متر",
    manufacturer: "JLG", model: "4069LE",
    capacityKg: 350, minDays: 1, mobBuffer: 0, demobBuffer: 0,
    deposit: 1500, fuel: "dry", transportClass: "light_plant",
    lowBed: false, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 380, weekly: 2090, monthly: 6840 },
    descEn: "Electric rough-terrain scissor lift. Zero emissions at the platform makes it suitable for indoor and enclosed work.",
    descAr: "رافعة مقصية كهربائية للتضاريس الوعرة. انعدام الانبعاثات عند المنصة يجعلها مناسبة للأعمال الداخلية والمغلقة.",
    specs: { workingHeightM: 12.0, platformCapacityKg: 350, fuelType: "electric" },
    incEn: ["Charger", "Routine servicing during hire", "Third-party inspection certificate"],
    incAr: ["الشاحن", "الصيانة الدورية أثناء فترة الإيجار", "شهادة فحص من طرف ثالث"],
    excEn: ["Operator (available as an add-on)", "Site power for charging", "Fall-arrest harnesses"],
    excAr: ["المشغل (متاح كخدمة إضافية)", "الطاقة الكهربائية في الموقع للشحن", "أحزمة منع السقوط"],
  },
  {
    slug: "generator-500kva", category: "generators",
    nameEn: "500 kVA Diesel Generator", nameAr: "مولد ديزل 500 كيلو فولت أمبير",
    manufacturer: "Cummins", model: "C500D5",
    capacityKg: 500, minDays: 7, mobBuffer: 0, demobBuffer: 0,
    deposit: 4000, fuel: "dry", transportClass: "heavy_plant",
    lowBed: false, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 720, weekly: 3960, monthly: 12960 },
    descEn: "Silenced 500 kVA generator set in a weatherproof canopy with integral fuel tank. Suitable for prime and standby site power.",
    descAr: "مولد كهربائي صامت بقدرة 500 كيلو فولت أمبير في هيكل مقاوم للعوامل الجوية مع خزان وقود مدمج. مناسب للطاقة الأساسية والاحتياطية في الموقع.",
    specs: { outputKva: 500, fuelTankL: 990, enginePowerKw: 400, noiseDbAt7m: 75 },
    incEn: ["Weatherproof canopy", "Integral fuel tank", "Routine servicing during hire"],
    incAr: ["هيكل مقاوم للعوامل الجوية", "خزان وقود مدمج", "الصيانة الدورية أثناء فترة الإيجار"],
    excEn: ["Fuel", "Distribution board and cabling", "Electrical connection by a licensed electrician", "Earthing installation"],
    excAr: ["الوقود", "لوحة التوزيع والكابلات", "التوصيل الكهربائي بواسطة كهربائي مرخص", "تركيب التأريض"],
  },
  {
    slug: "air-compressor-375cfm", category: "air-compressors",
    nameEn: "375 cfm Air Compressor", nameAr: "ضاغط هواء 375 قدم مكعب/دقيقة",
    manufacturer: "Atlas Copco", model: "XATS 375",
    capacityKg: 375, minDays: 3, mobBuffer: 0, demobBuffer: 0,
    deposit: 1500, fuel: "dry", transportClass: "light_plant",
    lowBed: false, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 340, weekly: 1870, monthly: 6120 },
    descEn: "Towable diesel screw compressor for pneumatic breakers, sand blasting and general site tooling.",
    descAr: "ضاغط هواء لولبي يعمل بالديزل وقابل للسحب لكسارات الهواء المضغوط والسفع الرملي والمعدات العامة في الموقع.",
    specs: { fuelTankL: 235, freeAirDeliveryCfm: 375, workingPressureBar: 7 },
    incEn: ["Towing hitch", "Routine servicing during hire"],
    incAr: ["وصلة القطر", "الصيانة الدورية أثناء فترة الإيجار"],
    excEn: ["Fuel", "Air hoses and tooling", "Towing vehicle"],
    excAr: ["الوقود", "خراطيم الهواء والمعدات", "مركبة القطر"],
  },
  {
    slug: "dewatering-pump-6in", category: "dewatering-pumps",
    nameEn: "6 inch Dewatering Pump", nameAr: "مضخة نزح مياه 6 بوصة",
    manufacturer: "Selwood", model: "S150",
    capacityKg: 150, minDays: 3, mobBuffer: 0, demobBuffer: 0,
    deposit: 1200, fuel: "dry", transportClass: "light_plant",
    lowBed: false, escort: false, instant: true, requiresOperator: false,
    rates: { daily: 290, weekly: 1595, monthly: 5220 },
    descEn: "Diesel-driven self-priming pump for excavation dewatering and sewer bypass. Handles solids in suspension.",
    descAr: "مضخة ذاتية التحضير تعمل بالديزل لنزح مياه الحفريات وتحويل مياه الصرف. تتعامل مع المواد الصلبة العالقة.",
    specs: { fuelTankL: 210, maxFlowM3h: 200, maxHeadM: 24 },
    incEn: ["Suction strainer", "Routine servicing during hire"],
    incAr: ["مصفاة الشفط", "الصيانة الدورية أثناء فترة الإيجار"],
    excEn: ["Fuel", "Hoses and fittings", "Discharge permits"],
    excAr: ["الوقود", "الخراطيم والوصلات", "تصاريح التصريف"],
  },
  {
    slug: "low-bed-trailer-60t", category: "low-bed-trailers",
    nameEn: "60 Tonne Low-bed Trailer", nameAr: "مقطورة منخفضة 60 طن",
    manufacturer: "Faymonville", model: "MegaMAX",
    capacityKg: 60000, minDays: 1, mobBuffer: 0, demobBuffer: 0,
    deposit: 5000, fuel: "wet", transportClass: "self_drive",
    lowBed: false, escort: true, instant: true, requiresOperator: true,
    rates: { daily: 2200, weekly: 13200, monthly: 46200 },
    descEn: "Low-bed semi-trailer with prime mover and driver for moving tracked plant and abnormal loads. Escort arrangements priced separately.",
    descAr: "مقطورة منخفضة مع رأس قاطرة وسائق لنقل المعدات المجنزرة والأحمال غير الاعتيادية. يتم تسعير ترتيبات المرافقة بشكل منفصل.",
    specs: { payloadKg: 60000, deckLengthM: 13.6, deckHeightM: 0.85 },
    incEn: ["Prime mover and licensed driver", "Fuel", "Load securing equipment"],
    incAr: ["رأس القاطرة وسائق مرخص", "الوقود", "معدات تأمين الحمولة"],
    excEn: ["Abnormal load permits", "Escort vehicles", "Loading and unloading crane", "Waiting time"],
    excAr: ["تصاريح الأحمال غير الاعتيادية", "مركبات المرافقة", "رافعة التحميل والتفريغ", "وقت الانتظار"],
  },
];

/**
 * Transport rates by distance band.
 *
 * Mobilisation is charged both ways and scales with distance and machine class,
 * because for heavy plant it is a genuine cost centre rather than "shipping"
 * (docs/research.md §4).
 */
const TRANSPORT_CLASSES = {
  self_drive:   { base: 0,     perBand: 0,    lowBed: 0,    escort: 1200 },
  light_plant:  { base: 450,   perBand: 380,  lowBed: 0,    escort: 0 },
  heavy_plant:  { base: 1400,  perBand: 1100, lowBed: 900,  escort: 0 },
  crane_medium: { base: 2200,  perBand: 1600, lowBed: 1400, escort: 1800 },
  crane_large:  { base: 3800,  perBand: 2600, lowBed: 2200, escort: 2400 },
  crane_heavy:  { base: 7500,  perBand: 5200, lowBed: 4200, escort: 4800 },
  crawler_heavy:{ base: 26000, perBand: 18000, lowBed: 12000, escort: 9000 },
};

const DISTANCE_BANDS = [
  { from: 0, to: 50 },
  { from: 51, to: 150 },
  { from: 151, to: 400 },
  { from: 401, to: 900 },
  { from: 901, to: null },
];

const ADDONS = [
  { code: "operator", nameEn: "Certified operator", nameAr: "مشغل معتمد",
    descEn: "Licensed operator for the full shift. Overtime charged separately.",
    descAr: "مشغل مرخص لكامل الوردية. يتم احتساب العمل الإضافي بشكل منفصل.",
    model: "per_day", rate: 550, max: 3, sort: 1 },
  { code: "fuel", nameEn: "Fuel supply", nameAr: "توريد الوقود",
    descEn: "We fuel the machine and bill actual consumption at cost plus handling.",
    descAr: "نقوم بتزويد المعدة بالوقود ونحاسب على الاستهلاك الفعلي بسعر التكلفة مضافاً إليه رسوم المناولة.",
    model: "per_day", rate: 350, max: 1, sort: 2 },
  { code: "rigger", nameEn: "Rigger / banksman", nameAr: "فني ربط / مشير",
    descEn: "Trained rigger and signaller. Required for most lifts over 20 tonnes.",
    descAr: "فني ربط ومشير مدرب. مطلوب لمعظم عمليات الرفع التي تتجاوز 20 طناً.",
    model: "per_unit_per_day", rate: 420, max: 4, sort: 3 },
  { code: "extra_slings", nameEn: "Additional rigging set", nameAr: "طقم ربط إضافي",
    descEn: "Supplementary slings, shackles and spreader bar.",
    descAr: "أحزمة ومشابك وعارضة توزيع إضافية.",
    model: "flat", rate: 800, max: 3, sort: 4 },
  { code: "site_survey", nameEn: "Pre-mobilisation site survey", nameAr: "مسح الموقع قبل التعبئة",
    descEn: "Engineer visits the site to confirm access, ground conditions and set-up position.",
    descAr: "زيارة مهندس للموقع للتأكد من المداخل وظروف الأرض وموقع التجهيز.",
    model: "flat", rate: 1500, max: 1, sort: 5 },
];

const FAQS = [
  { qEn: "Does the rental include an operator?",
    qAr: "هل يشمل الإيجار مشغلاً؟",
    aEn: "It depends on the machine. Cranes and heavy plant are supplied with a certified operator as standard, and the equipment page states this explicitly under \"What's included\". Smaller machines such as forklifts and scissor lifts are supplied bare by default, with an operator available as a priced add-on during booking.",
    aAr: "يعتمد ذلك على المعدة. تُوفَّر الرافعات والمعدات الثقيلة مع مشغل معتمد بشكل قياسي، وتوضح صفحة المعدة ذلك صراحةً ضمن قسم \"ما يشمله السعر\". أما المعدات الأصغر مثل الرافعات الشوكية والرافعات المقصية فتُوفَّر بدون مشغل افتراضياً، مع إمكانية إضافة مشغل كخدمة مدفوعة أثناء الحجز." },
  { qEn: "Is fuel included in the rental price?",
    qAr: "هل الوقود مشمول في سعر الإيجار؟",
    aEn: "By default, no. Most rentals are \"dry\" — you supply the fuel. Every equipment page carries a badge stating whether the rental is wet (fuel included) or dry, and fuel supply can be added as a priced line at booking. We make this explicit because ambiguity about fuel is one of the most common causes of billing disputes in equipment hire.",
    aAr: "افتراضياً، لا. معظم عمليات التأجير \"غير شاملة\" — أي أنك توفّر الوقود. تحمل كل صفحة معدة شارة توضح ما إذا كان الإيجار شاملاً للوقود أم لا، ويمكن إضافة توريد الوقود كبند مسعّر عند الحجز. نوضح ذلك صراحةً لأن الغموض بشأن الوقود من أكثر أسباب نزاعات الفوترة شيوعاً في تأجير المعدات." },
  { qEn: "How is delivery priced?",
    qAr: "كيف يتم تسعير التوصيل؟",
    aEn: "Transport is charged as mobilisation (delivery to site) plus demobilisation (collection), based on the distance band from the servicing depot and the transport class of the machine. Low-bed and escort surcharges apply where the machine requires them. Every element appears as its own line in the price breakdown before you pay.",
    aAr: "يُحتسب النقل كتعبئة (التوصيل إلى الموقع) بالإضافة إلى الإرجاع (الاستلام)، بناءً على نطاق المسافة من المستودع المخدِّم وفئة نقل المعدة. تُطبَّق رسوم إضافية للمقطورة المنخفضة والمرافقة عند الحاجة. يظهر كل عنصر كبند منفصل في تفاصيل السعر قبل الدفع." },
  { qEn: "How far in advance should I book?",
    qAr: "كم من الوقت يجب أن أحجز مسبقاً؟",
    aEn: "For standard plant such as excavators, forklifts and access equipment, a few days is usually enough. For cranes above 100 tonnes, and for anything requiring a route survey or permits, book two to four weeks ahead. The availability calendar on each equipment page shows exactly which dates are free.",
    aAr: "بالنسبة للمعدات القياسية مثل الحفارات والرافعات الشوكية ومعدات الوصول، تكفي عادةً بضعة أيام. أما للرافعات التي تتجاوز 100 طن، ولأي معدة تتطلب دراسة مسار أو تصاريح، فاحجز قبل أسبوعين إلى أربعة أسابيع. يوضح تقويم التوفر في كل صفحة معدة التواريخ المتاحة بدقة." },
  { qEn: "Why do some machines show a price and others only a quote?",
    qAr: "لماذا تعرض بعض المعدات سعراً بينما تتطلب أخرى عرض سعر؟",
    aEn: "Because for the largest classes an instant price would be a guess. Mobilising a 300 tonne crawler crane involves a route survey, permits and more than a dozen transport loads, and that cost can be 20–40% of the job. Rather than quote a number we cannot stand behind, we route those classes to a structured quote — you still submit everything online, and you get a priced response you can accept online.",
    aAr: "لأن السعر الفوري للفئات الأكبر سيكون مجرد تخمين. تتضمن تعبئة رافعة زاحفة بحمولة 300 طن دراسة مسار وتصاريح وأكثر من اثني عشر حمل نقل، وقد تمثل هذه التكلفة 20–40% من قيمة المشروع. بدلاً من تقديم رقم لا يمكننا الالتزام به، نوجّه هذه الفئات إلى عرض سعر منظّم — تقدّم كل البيانات عبر الإنترنت، وتحصل على رد مسعّر يمكنك قبوله عبر الإنترنت." },
  { qEn: "What is the security deposit and when is it returned?",
    qAr: "ما هو مبلغ التأمين ومتى يُعاد؟",
    aEn: "The deposit is a refundable amount held separately from the rental charge — it is not revenue and no VAT is charged on it. It covers damage beyond fair wear, missing accessories and fuel shortfall. After the return inspection, any agreed deductions are itemised and the balance is released. Rental price, deposit, authorisation and final charge are shown as distinct figures throughout.",
    aAr: "التأمين مبلغ قابل للاسترداد يُحتجز بشكل منفصل عن قيمة الإيجار — فهو ليس إيراداً ولا تُحتسب عليه ضريبة القيمة المضافة. ويغطي الأضرار التي تتجاوز الاستهلاك الطبيعي والملحقات المفقودة ونقص الوقود. بعد فحص الإرجاع، تُفصَّل أي خصومات متفق عليها ويُفرج عن الرصيد. تُعرض قيمة الإيجار والتأمين والحجز والمبلغ النهائي كأرقام منفصلة في جميع المراحل." },
];

const ARTICLES = [
  {
    slugEn: "what-size-crane-do-i-need", slugAr: "ما-حجم-الرافعة-التي-احتاجها",
    titleEn: "What size crane do I need?",
    titleAr: "ما حجم الرافعة التي أحتاجها؟",
    excerptEn: "Capacity alone does not tell you whether a crane can make your lift. Radius does.",
    excerptAr: "الحمولة وحدها لا تحدد ما إذا كانت الرافعة قادرة على تنفيذ عملية الرفع. نصف القطر هو ما يحدد ذلك.",
    bodyEn: `The most common mistake in crane selection is reading the headline capacity as if it were the answer.

A "100 tonne crane" can lift 100 tonnes only in the most favourable configuration: shortest boom, minimum radius, full counterweight, on level prepared ground. At 30 metres radius the same machine may be rated for a small fraction of that.

## The four numbers that decide it

**Load weight.** The actual mass of what is being lifted, plus rigging: slings, shackles, spreader bars and any lifting beam. Rigging routinely adds several hundred kilograms and is frequently forgotten.

**Radius.** The horizontal distance from the crane's centre of rotation to the centre of the load — at the point of set-down, not at pick-up. This is usually the binding constraint, and it is the number most often underestimated.

**Lift height.** How high the hook must travel, including the height of the load itself, the rigging, and clearance over any obstruction.

**Ground conditions.** Outrigger loads are concentrated and large. A crane that fits the load chart on paper and sinks an outrigger through a service duct has not made the lift.

## How to use a load chart

Every crane has a load chart giving safe working loads for each boom length and radius combination. Read down to your radius, across to your boom configuration, and compare the figure to your total load including rigging. If you are within roughly 80% of the chart figure, look at the next class up — margin absorbs the wind allowance, the weight you were not told about, and the radius that turned out to be longer than the drawing.

## The limit of any online tool

Nothing on this site — and no automated recommendation anywhere — is a substitute for a lift plan prepared by a qualified lifting engineer. Load charts are published here for reference. Final equipment suitability, ground bearing assessment, and the lift plan itself must be confirmed by competent personnel who have seen the site.`,
    bodyAr: `أكثر الأخطاء شيوعاً في اختيار الرافعة هو قراءة الحمولة المعلنة وكأنها الإجابة النهائية.

"الرافعة بحمولة 100 طن" لا ترفع 100 طن إلا في أفضل التكوينات: أقصر ذراع، وأدنى نصف قطر، وكامل الأثقال الموازنة، على أرض مستوية ومجهزة. أما عند نصف قطر يبلغ 30 متراً، فقد تكون الحمولة المصنفة لنفس المعدة جزءاً صغيراً من ذلك.

## الأرقام الأربعة التي تحدد الاختيار

**وزن الحمل.** الكتلة الفعلية للحمل المراد رفعه، مضافاً إليها معدات الربط: الأحزمة والمشابك وعوارض التوزيع وأي عارضة رفع. تضيف معدات الربط عادةً عدة مئات من الكيلوغرامات ويتم إغفالها كثيراً.

**نصف القطر.** المسافة الأفقية من مركز دوران الرافعة إلى مركز الحمل — عند نقطة الإنزال، وليس عند نقطة الالتقاط. وهذا عادةً هو القيد الحاسم، وهو الرقم الأكثر عرضة للتقدير الأقل من الواقع.

**ارتفاع الرفع.** المسافة التي يجب أن يقطعها الخطاف، شاملةً ارتفاع الحمل نفسه ومعدات الربط والمسافة الآمنة فوق أي عائق.

**ظروف الأرض.** أحمال الدعامات مركزة وكبيرة. الرافعة التي تطابق جدول الأحمال على الورق ثم تغوص إحدى دعاماتها في قناة خدمات لم تنفذ عملية الرفع.

## كيفية استخدام جدول الأحمال

لكل رافعة جدول أحمال يوضح أحمال العمل الآمنة لكل تركيبة من طول الذراع ونصف القطر. انزل إلى نصف القطر المطلوب، وانتقل أفقياً إلى تكوين الذراع لديك، وقارن الرقم بإجمالي الحمل شاملاً معدات الربط. إذا كنت ضمن حدود 80% تقريباً من رقم الجدول، فانظر إلى الفئة الأعلى — فالهامش يستوعب بدل الرياح، والوزن الذي لم يُبلَّغ عنه، ونصف القطر الذي تبيّن أنه أطول مما هو في المخطط.

## حدود أي أداة إلكترونية

لا شيء في هذا الموقع — ولا أي توصية آلية في أي مكان — يغني عن خطة رفع يعدّها مهندس رفع مؤهل. تُنشر جداول الأحمال هنا للاسترشاد فقط. أما ملاءمة المعدة النهائية وتقييم تحمل التربة وخطة الرفع نفسها فيجب أن يؤكدها أشخاص مؤهلون عاينوا الموقع.` },
  {
    slugEn: "mobile-vs-crawler-cranes", slugAr: "الرافعات-المتحركة-مقابل-الزاحفة",
    titleEn: "Mobile crane or crawler crane?",
    titleAr: "رافعة متحركة أم رافعة زاحفة؟",
    excerptEn: "The decision is usually about duration and ground, not about capacity.",
    excerptAr: "القرار يتعلق عادةً بالمدة وظروف الأرض، وليس بالحمولة.",
    bodyEn: `Both types reach similar capacities at the top end, so capacity is rarely what decides between them. Duration, ground and mobilisation cost are.

## Mobile (all-terrain) cranes

Drive to site on the public road network, set up on outriggers in under an hour, and drive away. Telescopic boom, so no assembly.

Choose one when the work is measured in hours or days, when you have several lift locations, or when access is constrained. The economics are dominated by the day rate because mobilisation is comparatively cheap.

## Crawler cranes

Arrive disassembled on multiple trailer loads, are built on site with an assist crane, and travel on tracks once erected. Lattice boom, higher capacity at long radius, and able to travel with a suspended load on prepared ground.

Choose one for sustained duty — weeks or months on the same footprint — or where the duty cycle is heavy enough that a mobile crane would be working at the edge of its chart all day.

## Where the real cost sits

For a crawler crane, mobilisation and demobilisation can be **20–40% of the total project cost**. Counterweights, boom sections and tracks all move as separate loads; the route may need surveying; permits and escorts are often required.

That is why the largest crawler classes on this site are quoted rather than instantly priced. An instant number for that mobilisation would be a guess, and a guess on a figure that size is not a service.

## Rough guide

| Situation | Usually |
|---|---|
| A few lifts over one or two days | Mobile |
| Multiple set-up positions across a site | Mobile |
| Six weeks on one foundation | Crawler |
| Heavy repetitive duty cycle | Crawler |
| Tight urban access, short duration | Mobile |
| Long radius at high capacity | Crawler |

Confirm the choice with a lifting engineer against the actual load chart and site conditions.`,
    bodyAr: `يصل النوعان إلى حمولات متقاربة في الفئات العليا، لذا نادراً ما تكون الحمولة هي الفيصل بينهما. الفيصل هو المدة وظروف الأرض وتكلفة التعبئة والنقل.

## الرافعات المتحركة (جميع التضاريس)

تصل إلى الموقع عبر شبكة الطرق العامة، وتُجهَّز على الدعامات في أقل من ساعة، ثم تغادر. ذراع تلسكوبي، أي بدون أعمال تركيب.

اخترها عندما يُقاس العمل بالساعات أو الأيام، أو عندما يكون لديك عدة مواقع رفع، أو عندما تكون المداخل محدودة. تهيمن الأجرة اليومية على الاقتصاديات لأن تكلفة التعبئة والنقل منخفضة نسبياً.

## الرافعات الزاحفة

تصل مفككة على عدة أحمال مقطورات، وتُركَّب في الموقع بمساعدة رافعة أخرى، وتتنقل على الجنازير بعد تركيبها. ذراع شبكي، وحمولة أعلى عند نصف القطر الطويل، وقدرة على التحرك بحمل معلق على أرض مجهزة.

اخترها للأعمال المستمرة — أسابيع أو أشهر في الموقع نفسه — أو حيث تكون دورة العمل ثقيلة بما يجعل الرافعة المتحركة تعمل عند حدود جدول أحمالها طوال اليوم.

## أين تكمن التكلفة الحقيقية

بالنسبة للرافعة الزاحفة، قد تمثل التعبئة والإرجاع **20–40% من إجمالي تكلفة المشروع**. فالأثقال الموازنة وأقسام الذراع والجنازير تُنقل جميعها كأحمال منفصلة؛ وقد يحتاج المسار إلى دراسة؛ وغالباً ما تلزم التصاريح ومركبات المرافقة.

ولهذا السبب تُسعَّر أكبر فئات الرافعات الزاحفة في هذا الموقع عبر عرض سعر بدلاً من التسعير الفوري. فالرقم الفوري لتلك التعبئة سيكون تخميناً، والتخمين في مبلغ بهذا الحجم ليس خدمة.

## دليل تقريبي

| الحالة | الخيار المعتاد |
|---|---|
| عمليات رفع قليلة خلال يوم أو يومين | متحركة |
| مواقع تجهيز متعددة عبر الموقع | متحركة |
| ستة أسابيع على أساس واحد | زاحفة |
| دورة عمل ثقيلة ومتكررة | زاحفة |
| مداخل حضرية ضيقة ومدة قصيرة | متحركة |
| نصف قطر طويل بحمولة عالية | زاحفة |

أكّد الاختيار مع مهندس رفع بالرجوع إلى جدول الأحمال الفعلي وظروف الموقع.` },
  {
    slugEn: "what-is-included-in-crane-rental", slugAr: "ما-الذي-يشمله-ايجار-الرافعة",
    titleEn: "What is actually included in a crane rental?",
    titleAr: "ما الذي يشمله إيجار الرافعة فعلياً؟",
    excerptEn: "Wet or dry, operator or bare, mobilisation or not — the answers that decide the real invoice.",
    excerptAr: "شامل أو غير شامل، بمشغل أو بدونه، مع التعبئة أو بدونها — الإجابات التي تحدد قيمة الفاتورة الحقيقية.",
    bodyEn: `Most disputes in equipment hire are not about the day rate. They are about what the day rate did not include.

## Wet versus dry

A **wet** rental includes fuel and usually the operator. A **dry** rental is the bare machine. The difference on a month-long crane hire can be a significant share of the invoice, and the terms are used inconsistently across the market.

Every equipment page on this site carries an explicit badge stating which applies, and the price breakdown itemises fuel as its own line when you add it.

## Operator, and the crew beyond the operator

Cranes and heavy plant are normally supplied with a certified operator. What is often *not* included is the rest of the lifting team: rigger, banksman, signaller. For most lifts above about 20 tonnes you need at least one, and they are chargeable.

## Mobilisation and demobilisation

Getting the machine to site and back is a separate cost, charged in both directions, scaling with distance and machine class. Low-bed transport and escort vehicles add further. On the largest classes this is the single biggest line after the rental itself.

## What is essentially never included

- Site preparation, ground bearing assessment and crane mats
- The lift plan and method statement
- Permits, road closures and abnormal load approvals
- Standby or waiting time outside the agreed shift
- Damage beyond fair wear and tear

## The deposit is not a charge

A security deposit is refundable, is held separately from the rental, and carries no VAT because it is not revenue. It covers damage, missing accessories and fuel shortfall. After the return inspection any agreed deduction is itemised and the balance released.

Rental price, deposit, authorisation and final charge are four different figures. Any quotation that blurs them is worth questioning.`,
    bodyAr: `معظم النزاعات في تأجير المعدات لا تتعلق بالأجرة اليومية، بل بما لم تشمله تلك الأجرة.

## شامل أم غير شامل

الإيجار **الشامل** يتضمن الوقود وعادةً المشغل. أما الإيجار **غير الشامل** فهو المعدة وحدها. والفرق في إيجار رافعة لمدة شهر قد يمثل نسبة كبيرة من الفاتورة، ويُستخدم المصطلحان بشكل غير متسق في السوق.

تحمل كل صفحة معدة في هذا الموقع شارة صريحة توضح أي الحالتين تنطبق، وتفصّل تفاصيل السعر بند الوقود بشكل مستقل عند إضافته.

## المشغل، والطاقم بخلاف المشغل

تُوفَّر الرافعات والمعدات الثقيلة عادةً مع مشغل معتمد. أما ما لا يُشمل غالباً فهو بقية فريق الرفع: فني الربط والمشير وعامل الإشارة. ولمعظم عمليات الرفع التي تتجاوز 20 طناً تقريباً تحتاج إلى واحد منهم على الأقل، وهم مدفوعو الأجر.

## التعبئة والإرجاع

نقل المعدة إلى الموقع وإعادتها تكلفة منفصلة، تُحتسب في الاتجاهين، وتتناسب مع المسافة وفئة المعدة. ويضيف النقل بالمقطورة المنخفضة ومركبات المرافقة تكاليف أخرى. وفي الفئات الأكبر يمثل هذا أكبر بند بعد الإيجار نفسه.

## ما لا يُشمل عملياً أبداً

- تجهيز الموقع وتقييم تحمل التربة وحصائر الرافعة
- خطة الرفع وبيان الطريقة
- التصاريح وإغلاق الطرق وموافقات الأحمال غير الاعتيادية
- وقت الانتظار أو التوقف خارج الوردية المتفق عليها
- الأضرار التي تتجاوز الاستهلاك الطبيعي

## التأمين ليس رسماً

مبلغ التأمين قابل للاسترداد، ويُحتجز بشكل منفصل عن الإيجار، ولا تُحتسب عليه ضريبة القيمة المضافة لأنه ليس إيراداً. وهو يغطي الأضرار والملحقات المفقودة ونقص الوقود. وبعد فحص الإرجاع تُفصَّل أي خصومات متفق عليها ويُفرج عن الرصيد.

قيمة الإيجار والتأمين والحجز والمبلغ النهائي أربعة أرقام مختلفة. وأي عرض سعر يخلط بينها يستحق التساؤل.` },
];

// --- seed ------------------------------------------------------------------

async function main() {
  console.log("Seeding demo data (all equipment is fictional and flagged is_demo_data)…\n");

  await sql.begin(async (tx) => {
    // Idempotent: a re-seed replaces demo content rather than duplicating it.
    await tx`TRUNCATE TABLE
      booking_addon, booking_event, booking_item, reservation, checkout_hold,
      payment_webhook_event, refund, payment, invoice_line, invoice, rental_agreement,
      delivery, inspection, review, quote_item, quote, support_ticket,
      credit_transaction, maintenance_record, unit_blackout, equipment_unit,
      rate_tier, rate_card, addon_option, transport_rate, coupon, tax_rate,
      class_spec, class_image, class_document, equipment_class, equipment_category,
      testimonial, project, credential,
      branch, project_site, company_member, company, mfa_credential, auth_token,
      session, notification, analytics_event, article, faq, setting, audit_log,
      booking, "user"
      RESTART IDENTITY CASCADE`;

    // --- tax ---------------------------------------------------------------
    await tx`INSERT INTO tax_rate (id, code, name_en, name_ar, rate_ppm, valid_from)
      VALUES (${uuidv7()}, 'SA_VAT', 'VAT', 'ضريبة القيمة المضافة', 150000, '2020-07-01T00:00:00Z')`;

    // --- settings (all DEMO PLACEHOLDERS) -----------------------------------
    const settingRows = [
      ["companyNameEn", "Heavy Duty Rentals"],
      ["companyNameAr", "هيفي ديوتي للتأجير"],
      ["vatNumber", "300000000000003"],
      ["crNumber", "1010000000"],
      ["phone", "+966 11 000 0000"],
      ["emergencyPhone", "+966 50 000 0000"],
      ["email", "info@example.com"],
      ["addressEn", "Second Industrial City, Riyadh, Saudi Arabia (demo address)"],
      ["addressAr", "المدينة الصناعية الثانية، الرياض، المملكة العربية السعودية (عنوان تجريبي)"],
      ["termsVersion", "1.0"],
      ["foundedYear", null],
      ["cancellationTiers", [
        { minHoursNotice: 168, refundPercent: 100 },
        { minHoursNotice: 72, refundPercent: 75 },
        { minHoursNotice: 24, refundPercent: 50 },
        { minHoursNotice: 0, refundPercent: 0 },
      ]],
    ];
    for (const [key, value] of settingRows) {
      await tx`INSERT INTO setting (key, value_json, description_en)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, 'Demo placeholder — replace with real business data')`;
    }

    // --- branches ----------------------------------------------------------
    const branchIds = {};
    for (const b of BRANCHES) {
      const id = uuidv7();
      branchIds[b.slug] = id;
      await tx`INSERT INTO branch
        (id, slug, name_en, name_ar, city, city_ar, region, region_ar, address_en, address_ar,
         latitude, longitude, phone, email, working_hours, is_service_area, is_demo_data, is_active)
        VALUES (${id}, ${b.slug}, ${b.nameEn}, ${b.nameAr}, ${b.city}, ${b.cityAr},
                ${b.region}, ${b.regionAr}, ${b.addressEn}, ${b.addressAr},
                ${b.lat}, ${b.lng}, ${b.phone}, ${"info@example.com"},
                ${JSON.stringify({ "sun-thu": "07:00-18:00", sat: "07:00-14:00", fri: "closed" })}::jsonb,
                TRUE, TRUE, TRUE)`;
    }

    // --- transport rates ---------------------------------------------------
    for (const branchSlug of Object.keys(branchIds)) {
      for (const [transportClass, cfg] of Object.entries(TRANSPORT_CLASSES)) {
        for (const [index, band] of DISTANCE_BANDS.entries()) {
          const mob = cfg.base + cfg.perBand * index;
          await tx`INSERT INTO transport_rate
            (id, branch_id, transport_class, distance_band_km_from, distance_band_km_to,
             mobilisation_halalas, demobilisation_halalas, low_bed_surcharge_halalas,
             escort_surcharge_halalas, is_active)
            VALUES (${uuidv7()}, ${branchIds[branchSlug]}, ${transportClass},
                    ${band.from}, ${band.to},
                    ${sar(mob)}, ${sar(Math.round(mob * 0.9))},
                    ${sar(cfg.lowBed)}, ${sar(cfg.escort)}, TRUE)`;
        }
      }
    }

    // --- categories --------------------------------------------------------
    const categoryIds = {};
    for (const c of CATEGORIES) {
      const id = uuidv7();
      categoryIds[c.slug] = id;
      await tx`INSERT INTO equipment_category
        (id, slug, name_en, name_ar, description_en, description_ar, filter_schema, sort_order,
         is_active, meta_title_en, meta_title_ar, meta_description_en, meta_description_ar)
        VALUES (${id}, ${c.slug}, ${c.nameEn}, ${c.nameAr}, ${c.descEn}, ${c.descAr},
                ${JSON.stringify(c.filters)}::jsonb, ${c.sort}, TRUE,
                ${`${c.nameEn} for Rent in Saudi Arabia`},
                ${`${c.nameAr} للإيجار في المملكة العربية السعودية`},
                ${c.descEn}, ${c.descAr})`;
    }

    // --- classes, specs, rates, units --------------------------------------
    let assetCounter = 0;
    const branchSlugs = Object.keys(branchIds);

    for (const cls of CLASSES) {
      const classId = uuidv7();

      await tx`INSERT INTO equipment_class
        (id, category_id, slug, name_en, name_ar, manufacturer, model,
         description_en, description_ar, specs, capacity_kg, min_rental_days,
         mobilisation_buffer_days, demobilisation_buffer_days, deposit_halalas,
         requires_operator, operator_included, fuel_policy, transport_class,
         requires_low_bed, requires_escort, instant_bookable,
         inclusions_en, inclusions_ar, exclusions_en, exclusions_ar,
         safety_notes_en, safety_notes_ar,
         meta_title_en, meta_title_ar, meta_description_en, meta_description_ar,
         is_demo_data, is_active)
        VALUES (${classId}, ${categoryIds[cls.category]}, ${cls.slug}, ${cls.nameEn}, ${cls.nameAr},
                ${cls.manufacturer}, ${cls.model}, ${cls.descEn}, ${cls.descAr},
                ${JSON.stringify(cls.specs)}::jsonb, ${cls.capacityKg}, ${cls.minDays},
                ${cls.mobBuffer}, ${cls.demobBuffer}, ${sar(cls.deposit)},
                ${cls.requiresOperator}, ${cls.requiresOperator}, ${cls.fuel}, ${cls.transportClass},
                ${cls.lowBed}, ${cls.escort}, ${cls.instant},
                ${JSON.stringify(cls.incEn)}::jsonb, ${JSON.stringify(cls.incAr)}::jsonb,
                ${JSON.stringify(cls.excEn)}::jsonb, ${JSON.stringify(cls.excAr)}::jsonb,
                ${"Equipment suitability for a specific lift must be confirmed by a qualified lifting engineer. A lift plan, ground bearing assessment and site survey remain the customer's responsibility."},
                ${"يجب أن يؤكد مهندس رفع مؤهل مدى ملاءمة المعدة لعملية رفع محددة. وتظل خطة الرفع وتقييم تحمل التربة ومسح الموقع من مسؤولية العميل."},
                ${`${cls.nameEn} Rental in Saudi Arabia | Check Availability`},
                ${`إيجار ${cls.nameAr} في السعودية | تحقق من التوفر`},
                ${cls.descEn.slice(0, 300)}, ${cls.descAr.slice(0, 300)},
                TRUE, TRUE)`;

      // Display specs, localised.
      const SPEC_LABELS = {
        capacityKg: ["Rated capacity", "الحمولة المقدرة", "t", 1000],
        maxBoomM: ["Main boom length", "طول الذراع الرئيسي", "m", 1],
        maxRadiusM: ["Maximum radius", "أقصى نصف قطر", "m", 1],
        liftHeightM: ["Lift height", "ارتفاع الرفع", "m", 1],
        workingHeightM: ["Working height", "ارتفاع العمل", "m", 1],
        platformCapacityKg: ["Platform capacity", "حمولة المنصة", "kg", 1],
        horizontalReachM: ["Horizontal reach", "المدى الأفقي", "m", 1],
        operatingWeightKg: ["Operating weight", "وزن التشغيل", "kg", 1],
        transportWeightKg: ["Transport weight", "وزن النقل", "kg", 1],
        bucketM3: ["Bucket capacity", "سعة الدلو", "m³", 1],
        enginePowerKw: ["Engine power", "قدرة المحرك", "kW", 1],
        maxDigDepthM: ["Maximum dig depth", "أقصى عمق حفر", "m", 1],
        outputKva: ["Output", "القدرة", "kVA", 1],
        fuelTankL: ["Fuel tank", "خزان الوقود", "L", 1],
        freeAirDeliveryCfm: ["Free air delivery", "تدفق الهواء الحر", "cfm", 1],
        workingPressureBar: ["Working pressure", "ضغط التشغيل", "bar", 1],
        maxFlowM3h: ["Maximum flow", "أقصى تدفق", "m³/h", 1],
        maxHeadM: ["Maximum head", "أقصى ارتفاع ضخ", "m", 1],
        payloadKg: ["Payload", "الحمولة", "kg", 1],
        deckLengthM: ["Deck length", "طول السطح", "m", 1],
        deckHeightM: ["Deck height", "ارتفاع السطح", "m", 1],
        noiseDbAt7m: ["Noise level at 7 m", "مستوى الضوضاء على بعد 7 م", "dB(A)", 1],
        axles: ["Axles", "عدد المحاور", null, 1],
        transportLoads: ["Transport loads", "عدد أحمال النقل", null, 1],
      };

      let specOrder = 0;
      const allSpecs = { capacityKg: cls.capacityKg, ...cls.specs };
      for (const [key, value] of Object.entries(allSpecs)) {
        const meta = SPEC_LABELS[key];
        if (!meta || value === undefined || value === null) continue;
        // A zero is not a specification. "Output: 0 kVA" on a water pump reads
        // as a machine that produces nothing, rather than as a machine that
        // does not have that property at all.
        if (Number(value) === 0) continue;

        const [labelEn, labelAr, unit, divisor] = meta;

        // Capacity in tonnes for the crawler crane, kilograms for the pump.
        // Dividing everything by 1000 renders a 150 kg pump as "0.15 t".
        let displayValue;
        let displayUnit = unit;
        if (key === "capacityKg" && Number(value) < 1000) {
          displayValue = String(Number(value));
          displayUnit = "kg";
        } else {
          displayValue = divisor > 1 ? String(Number(value) / divisor) : String(value);
        }
        await tx`INSERT INTO class_spec
          (id, class_id, label_en, label_ar, value_en, value_ar, unit, is_comparable, sort_order)
          VALUES (${uuidv7()}, ${classId}, ${labelEn}, ${labelAr},
                  ${displayValue}, ${displayValue}, ${displayUnit}, TRUE, ${specOrder++})`;
      }

      // Rate card + the three duration tiers. The engine picks whichever tier
      // is cheapest for the customer's actual duration.
      const rateCardId = uuidv7();
      await tx`INSERT INTO rate_card (id, class_id, branch_id, currency, valid_from, is_active)
        VALUES (${rateCardId}, ${classId}, NULL, 'SAR', now() - interval '30 days', TRUE)`;

      for (const [tier, rate] of Object.entries(cls.rates)) {
        const minDays = tier === "daily" ? 1 : tier === "weekly" ? 7 : 28;
        await tx`INSERT INTO rate_tier (id, rate_card_id, tier, min_days, rate_halalas)
          VALUES (${uuidv7()}, ${rateCardId}, ${tier}, ${minDays}, ${sar(rate)})`;
      }

      // Physical units, spread across branches. Every one is a distinct
      // serialised machine with its own availability — this distinction is
      // what makes the availability engine possible at all.
      const prefix = cls.category.slice(0, 3).toUpperCase();
      const unitCount = cls.instant ? 3 + (assetCounter % 3) : 2;
      for (let i = 0; i < unitCount; i++) {
        assetCounter += 1;
        const branchSlug = branchSlugs[(assetCounter + i) % branchSlugs.length];
        const unitId = uuidv7();
        const year = 2019 + ((assetCounter + i) % 6);
        await tx`INSERT INTO equipment_unit
          (id, class_id, branch_id, asset_code, serial_number, year_of_manufacture,
           engine_hours, status, last_inspection_at, next_inspection_due_at,
           acquisition_date, is_demo_data, is_active)
          VALUES (${unitId}, ${classId}, ${branchIds[branchSlug]},
                  ${`${prefix}-${String(assetCounter).padStart(5, "0")}`},
                  ${`DEMO-SN-${String(assetCounter).padStart(6, "0")}`},
                  ${year}, ${800 + ((assetCounter * 137) % 9000)}, 'available',
                  now() - interval '45 days', now() + interval '135 days',
                  ${`${year}-03-01`}, TRUE, TRUE)`;
      }
    }

    // --- add-ons -----------------------------------------------------------
    for (const addon of ADDONS) {
      await tx`INSERT INTO addon_option
        (id, class_id, code, name_en, name_ar, description_en, description_ar,
         pricing_model, rate_halalas, is_taxable, max_quantity, sort_order, is_active)
        VALUES (${uuidv7()}, NULL, ${addon.code}, ${addon.nameEn}, ${addon.nameAr},
                ${addon.descEn}, ${addon.descAr}, ${addon.model}, ${sar(addon.rate)},
                TRUE, ${addon.max}, ${addon.sort}, TRUE)`;
    }

    // --- FAQs --------------------------------------------------------------
    for (const [index, faq] of FAQS.entries()) {
      await tx`INSERT INTO faq
        (id, question_en, question_ar, answer_en, answer_ar, sort_order, is_published)
        VALUES (${uuidv7()}, ${faq.qEn}, ${faq.qAr}, ${faq.aEn}, ${faq.aAr}, ${String(index)}, TRUE)`;
    }

    // --- users -------------------------------------------------------------
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe_Dev_Only_123";
    const adminHash = await argonHash(adminPassword, {
      memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32,
    });

    const adminId = uuidv7();
    await tx`INSERT INTO "user"
      (id, email, email_verified_at, full_name, password_hash, preferred_locale,
       is_platform_admin, status)
      VALUES (${adminId}, ${(process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase()},
              now(), 'Demo Administrator', ${adminHash}, 'en', TRUE, 'active')`;

    const customerId = uuidv7();
    await tx`INSERT INTO "user"
      (id, email, email_verified_at, phone, full_name, password_hash, preferred_locale,
       is_platform_admin, status)
      VALUES (${customerId}, 'customer@example.com', now(), '+966500000001',
              'Demo Customer', ${adminHash}, 'en', FALSE, 'active')`;

    const companyId = uuidv7();
    await tx`INSERT INTO company
      (id, name_en, name_ar, vat_number, cr_number, billing_address_en, billing_city,
       contact_email, contact_phone, status, credit_limit_halalas, credit_terms_days,
       approval_threshold_halalas)
      VALUES (${companyId}, 'Demo Contracting Co.', 'شركة المقاولات التجريبية',
              '300000000000011', '1010000011', 'Demo billing address, Riyadh', 'Riyadh',
              'procurement@example.com', '+966110000001', 'active',
              ${sar(500000)}, 30, ${sar(50000)})`;

    await tx`INSERT INTO company_member (id, company_id, user_id, role, status, joined_at)
      VALUES (${uuidv7()}, ${companyId}, ${customerId}, 'owner', 'active', now())`;

    await tx`INSERT INTO project_site
      (id, company_id, owner_user_id, name, city, address_line, latitude, longitude,
       contact_name, contact_phone, access_notes, is_active)
      VALUES (${uuidv7()}, ${companyId}, NULL, 'Demo Tower Project', 'Riyadh',
              'Plot 12, Demo District, Riyadh', '24.7136', '46.6753',
              'Site Engineer', '+966500000002',
              'Gate 3 access only. Overhead 33 kV line along the north boundary — confirm clearance before setting up.',
              TRUE)`;

    // --- promotional coupon (demo) ------------------------------------------
    await tx`INSERT INTO coupon
      (id, code, description_en, description_ar, discount_type, value,
       min_subtotal_halalas, max_discount_halalas, valid_from, valid_to,
       max_redemptions, redemption_count, per_customer_limit, is_active)
      VALUES (${uuidv7()}, 'DEMO10', 'Demo 10% promotion', 'عرض تجريبي بخصم 10٪',
              'percent', 1000, ${sar(2000)}, ${sar(5000)},
              now() - interval '1 day', now() + interval '180 days',
              100, 0, 1, TRUE)`;

    // --- articles ----------------------------------------------------------
    for (const article of ARTICLES) {
      const groupId = uuidv7();
      await tx`INSERT INTO article
        (id, slug, locale, translation_group_id, title, excerpt, body_markdown,
         meta_title, meta_description, status, published_at, author_user_id)
        VALUES (${uuidv7()}, ${article.slugEn}, 'en', ${groupId}, ${article.titleEn},
                ${article.excerptEn}, ${article.bodyEn}, ${article.titleEn},
                ${article.excerptEn}, 'published', now() - interval '14 days', ${adminId})`;
      await tx`INSERT INTO article
        (id, slug, locale, translation_group_id, title, excerpt, body_markdown,
         meta_title, meta_description, status, published_at, author_user_id)
        VALUES (${uuidv7()}, ${article.slugAr}, 'ar', ${groupId}, ${article.titleAr},
                ${article.excerptAr}, ${article.bodyAr}, ${article.titleAr},
                ${article.excerptAr}, 'published', now() - interval '14 days', ${adminId})`;
    }

    // --- testimonials, projects, credentials -------------------------------
    //
    // DEMO PLACEHOLDERS. The database refuses to publish a testimonial or a
    // named-client project without `consent_obtained` (see migration 0002), so
    // the flag is set here alongside a note saying exactly what these are.
    // Every row is `is_demo_data = true`, which makes the UI badge it.
    //
    // Publishing a real client's words or name without written permission is a
    // commercial problem and a PDPL problem. Replace these with real,
    // consented references before launch.
    const DEMO_CONSENT =
      "DEMO PLACEHOLDER - not a real client reference. No consent obtained. Replace before launch.";

    const TESTIMONIALS = [
      {
        quoteEn:
          "We used to lose half a day getting a straight answer on whether a 100-tonne machine was free. Now the dates are on the screen and the price includes mobilisation, so I can put a number in the variation order before I leave the site.",
        quoteAr:
          "\u0643\u0646\u0627 \u0646\u0636\u064a\u0651\u0639 \u0646\u0635\u0641 \u064a\u0648\u0645 \u0644\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0625\u062c\u0627\u0628\u0629 \u0648\u0627\u0636\u062d\u0629 \u0639\u0646 \u062a\u0648\u0641\u0631 \u0631\u0627\u0641\u0639\u0629 100 \u0637\u0646. \u0627\u0644\u0622\u0646 \u0627\u0644\u062a\u0648\u0627\u0631\u064a\u062e \u0638\u0627\u0647\u0631\u0629 \u0623\u0645\u0627\u0645\u064a \u0648\u0627\u0644\u0633\u0639\u0631 \u064a\u0634\u0645\u0644 \u0627\u0644\u062a\u0639\u0628\u0626\u0629 \u0648\u0627\u0644\u0646\u0642\u0644\u060c \u0641\u0623\u0633\u062a\u0637\u064a\u0639 \u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0631\u0642\u0645 \u0641\u064a \u0623\u0645\u0631 \u0627\u0644\u062a\u063a\u064a\u064a\u0631 \u0642\u0628\u0644 \u0645\u063a\u0627\u062f\u0631\u0629 \u0627\u0644\u0645\u0648\u0642\u0639.",
        authorName: "Demo Reference A",
        roleEn: "Project Engineer",
        roleAr: "\u0645\u0647\u0646\u062f\u0633 \u0645\u0634\u0631\u0648\u0639",
        company: "Demo Contracting Co.",
        contextEn: "Mid-rise residential \u00b7 Riyadh",
        contextAr: "\u0645\u0634\u0631\u0648\u0639 \u0633\u0643\u0646\u064a \u00b7 \u0627\u0644\u0631\u064a\u0627\u0636",
      },
      {
        quoteEn:
          "The part that mattered to procurement was the paperwork. A PO number, a cost centre and a VAT invoice on the same day the machine was booked, instead of chasing an email thread for a week.",
        quoteAr:
          "\u0645\u0627 \u0643\u0627\u0646 \u0645\u0647\u0645\u0627\u064b \u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a \u0647\u0648 \u0627\u0644\u0645\u0633\u062a\u0646\u062f\u0627\u062a. \u0631\u0642\u0645 \u0623\u0645\u0631 \u0634\u0631\u0627\u0621 \u0648\u0645\u0631\u0643\u0632 \u062a\u0643\u0644\u0641\u0629 \u0648\u0641\u0627\u062a\u0648\u0631\u0629 \u0636\u0631\u064a\u0628\u064a\u0629 \u0641\u064a \u0627\u0644\u064a\u0648\u0645 \u0646\u0641\u0633\u0647 \u0627\u0644\u0630\u064a \u062d\u064f\u062c\u0632\u062a \u0641\u064a\u0647 \u0627\u0644\u0645\u0639\u062f\u0629.",
        authorName: "Demo Reference B",
        roleEn: "Procurement Manager",
        roleAr: "\u0645\u062f\u064a\u0631 \u0645\u0634\u062a\u0631\u064a\u0627\u062a",
        company: "Demo Industrial Services",
        contextEn: "Petrochemical maintenance \u00b7 Jubail",
        contextAr: "\u0635\u064a\u0627\u0646\u0629 \u0628\u062a\u0631\u0648\u0643\u064a\u0645\u0627\u0648\u064a\u0629 \u00b7 \u0627\u0644\u062c\u0628\u064a\u0644",
      },
      {
        quoteEn:
          "Being told upfront that the rental was dry, and exactly what the low-bed would cost, meant no argument at the end of the month. That is rarer than it should be in this business.",
        quoteAr:
          "\u0645\u0639\u0631\u0641\u0629 \u0623\u0646 \u0627\u0644\u0625\u064a\u062c\u0627\u0631 \u063a\u064a\u0631 \u0634\u0627\u0645\u0644 \u0644\u0644\u0648\u0642\u0648\u062f \u0648\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u0645\u0642\u0637\u0648\u0631\u0629 \u0627\u0644\u0645\u0646\u062e\u0641\u0636\u0629 \u0645\u0633\u0628\u0642\u0627\u064b \u064a\u0639\u0646\u064a \u0639\u062f\u0645 \u0648\u062c\u0648\u062f \u062e\u0644\u0627\u0641 \u0641\u064a \u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u0634\u0647\u0631.",
        authorName: "Demo Reference C",
        roleEn: "Site Manager",
        roleAr: "\u0645\u062f\u064a\u0631 \u0645\u0648\u0642\u0639",
        company: null,
        contextEn: "Infrastructure \u00b7 Eastern Province",
        contextAr: "\u0628\u0646\u064a\u0629 \u062a\u062d\u062a\u064a\u0629 \u00b7 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0631\u0642\u064a\u0629",
      },
    ];

    for (const [index, t] of TESTIMONIALS.entries()) {
      await tx`INSERT INTO testimonial
        (id, quote_en, quote_ar, author_name, author_role_en, author_role_ar,
         company_name, context_en, context_ar, consent_obtained, consent_note,
         sort_order, is_published, is_demo_data, created_by_user_id)
        VALUES (${uuidv7()}, ${t.quoteEn}, ${t.quoteAr}, ${t.authorName},
                ${t.roleEn}, ${t.roleAr}, ${t.company}, ${t.contextEn}, ${t.contextAr},
                TRUE, ${DEMO_CONSENT}, ${index}, TRUE, TRUE, ${adminId})`;
    }

    const PROJECTS = [
      {
        slug: "demo-tower-steel-erection",
        titleEn: "Structural steel erection, 18-storey tower",
        titleAr: "\u062a\u0631\u0643\u064a\u0628 \u0627\u0644\u0647\u064a\u0627\u0643\u0644 \u0627\u0644\u0645\u0639\u062f\u0646\u064a\u0629 \u0644\u0628\u0631\u062c \u0645\u0646 18 \u0637\u0627\u0628\u0642\u0627\u064b",
        summaryEn:
          "Six weeks of steel erection on a constrained city-centre plot. A 200 tonne all-terrain crane worked from a single set-up position because the site had no room to reposition, so radius rather than capacity drove the selection.",
        summaryAr:
          "\u0633\u062a\u0629 \u0623\u0633\u0627\u0628\u064a\u0639 \u0645\u0646 \u0623\u0639\u0645\u0627\u0644 \u062a\u0631\u0643\u064a\u0628 \u0627\u0644\u0647\u064a\u0627\u0643\u0644 \u0627\u0644\u0645\u0639\u062f\u0646\u064a\u0629 \u0641\u064a \u0645\u0648\u0642\u0639 \u0645\u062d\u062f\u0648\u062f \u0648\u0633\u0637 \u0627\u0644\u0645\u062f\u064a\u0646\u0629. \u0639\u0645\u0644\u062a \u0631\u0627\u0641\u0639\u0629 \u0628\u062d\u0645\u0648\u0644\u0629 200 \u0637\u0646 \u0645\u0646 \u0645\u0648\u0642\u0639 \u062a\u062c\u0647\u064a\u0632 \u0648\u0627\u062d\u062f\u060c \u0644\u0630\u0627 \u0643\u0627\u0646 \u0646\u0635\u0641 \u0627\u0644\u0642\u0637\u0631 \u0644\u0627 \u0627\u0644\u062d\u0645\u0648\u0644\u0629 \u0647\u0648 \u0627\u0644\u0645\u062d\u062f\u062f \u0644\u0644\u0627\u062e\u062a\u064a\u0627\u0631.",
        client: "Demo Contracting Co.",
        sectorEn: "Commercial construction",
        sectorAr: "\u0625\u0646\u0634\u0627\u0621\u0627\u062a \u062a\u062c\u0627\u0631\u064a\u0629",
        city: "Riyadh",
        cityAr: "\u0627\u0644\u0631\u064a\u0627\u0636",
        year: 2025,
        durationDays: 42,
        equipment: ["all-terrain-crane-200t", "telehandler-17m"],
        metrics: [
          { labelEn: "Heaviest lift", labelAr: "\u0623\u062b\u0642\u0644 \u0639\u0645\u0644\u064a\u0629 \u0631\u0641\u0639", value: "38 t" },
          { labelEn: "Working radius", labelAr: "\u0646\u0635\u0641 \u0642\u0637\u0631 \u0627\u0644\u0639\u0645\u0644", value: "26 m" },
          { labelEn: "Duration", labelAr: "\u0627\u0644\u0645\u062f\u0629", value: "42 days" },
        ],
      },
      {
        slug: "demo-refinery-shutdown",
        titleEn: "Refinery shutdown support",
        titleAr: "\u062f\u0639\u0645 \u0625\u064a\u0642\u0627\u0641 \u0645\u0635\u0641\u0627\u0629 \u0644\u0644\u0635\u064a\u0627\u0646\u0629",
        summaryEn:
          "Vessel removal and replacement during a planned turnaround. Machines were staged to a fixed hourly window because a shutdown has no tolerance for a late arrival, so mobilisation was scheduled around the permit rather than the other way round.",
        summaryAr:
          "\u0625\u0632\u0627\u0644\u0629 \u0648\u0627\u0633\u062a\u0628\u062f\u0627\u0644 \u0623\u0648\u0639\u064a\u0629 \u0623\u062b\u0646\u0627\u0621 \u0625\u064a\u0642\u0627\u0641 \u0645\u062e\u0637\u0637 \u0644\u0644\u0635\u064a\u0627\u0646\u0629. \u062c\u064f\u0647\u0632\u062a \u0627\u0644\u0645\u0639\u062f\u0627\u062a \u0648\u0641\u0642 \u0646\u0627\u0641\u0630\u0629 \u0632\u0645\u0646\u064a\u0629 \u0645\u062d\u062f\u062f\u0629 \u0644\u0623\u0646 \u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0625\u064a\u0642\u0627\u0641 \u0644\u0627 \u062a\u062d\u062a\u0645\u0644 \u0623\u064a \u062a\u0623\u062e\u064a\u0631.",
        client: null,
        sectorEn: "Petrochemical",
        sectorAr: "\u0628\u062a\u0631\u0648\u0643\u064a\u0645\u0627\u0648\u064a\u0627\u062a",
        city: "Jubail",
        cityAr: "\u0627\u0644\u062c\u0628\u064a\u0644",
        year: 2025,
        durationDays: 14,
        equipment: ["all-terrain-crane-100t", "boom-truck-15t", "low-bed-trailer-60t"],
        metrics: [
          { labelEn: "Machines deployed", labelAr: "\u0627\u0644\u0645\u0639\u062f\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0629", value: "5" },
          { labelEn: "Shutdown window", labelAr: "\u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0625\u064a\u0642\u0627\u0641", value: "14 days" },
          { labelEn: "Late arrivals", labelAr: "\u062d\u0627\u0644\u0627\u062a \u0627\u0644\u062a\u0623\u062e\u064a\u0631", value: "0" },
        ],
      },
      {
        slug: "demo-warehouse-earthworks",
        titleEn: "Bulk earthworks, distribution warehouse",
        titleAr: "\u0623\u0639\u0645\u0627\u0644 \u062d\u0641\u0631 \u0643\u0628\u064a\u0631\u0629 \u0644\u0645\u0633\u062a\u0648\u062f\u0639 \u062a\u0648\u0632\u064a\u0639",
        summaryEn:
          "Site clearance and bulk excavation on a greenfield logistics plot, running two excavators and a wheel loader against a fixed handover date.",
        summaryAr:
          "\u062a\u062c\u0647\u064a\u0632 \u0627\u0644\u0645\u0648\u0642\u0639 \u0648\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u062d\u0641\u0631 \u0627\u0644\u0643\u0628\u064a\u0631\u0629 \u0641\u064a \u0623\u0631\u0636 \u0644\u0648\u062c\u0633\u062a\u064a\u0629 \u062c\u062f\u064a\u062f\u0629\u060c \u0628\u062a\u0634\u063a\u064a\u0644 \u062d\u0641\u0627\u0631\u064a\u0646 \u0648\u0644\u0648\u062f\u0631 \u0628\u0639\u062c\u0644.",
        client: "Demo Logistics Group",
        sectorEn: "Logistics and warehousing",
        sectorAr: "\u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0644\u0648\u062c\u0633\u062a\u064a\u0629 \u0648\u0627\u0644\u062a\u062e\u0632\u064a\u0646",
        city: "Jeddah",
        cityAr: "\u062c\u062f\u0629",
        year: 2024,
        durationDays: 60,
        equipment: ["excavator-36t", "excavator-20t", "wheel-loader-3m3"],
        metrics: [
          { labelEn: "Material moved", labelAr: "\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u0648\u0627\u062f \u0627\u0644\u0645\u0646\u0642\u0648\u0644\u0629", value: "48,000 m3" },
          { labelEn: "Machines", labelAr: "\u0639\u062f\u062f \u0627\u0644\u0645\u0639\u062f\u0627\u062a", value: "3" },
          { labelEn: "Duration", labelAr: "\u0627\u0644\u0645\u062f\u0629", value: "60 days" },
        ],
      },
    ];

    for (const [index, project] of PROJECTS.entries()) {
      await tx`INSERT INTO project
        (id, slug, title_en, title_ar, summary_en, summary_ar, client_name,
         sector_en, sector_ar, city, city_ar, year, duration_days,
         equipment_used, metrics, consent_obtained, consent_note,
         sort_order, is_published, is_demo_data)
        VALUES (${uuidv7()}, ${project.slug}, ${project.titleEn}, ${project.titleAr},
                ${project.summaryEn}, ${project.summaryAr}, ${project.client},
                ${project.sectorEn}, ${project.sectorAr}, ${project.city}, ${project.cityAr},
                ${project.year}, ${project.durationDays},
                ${JSON.stringify(project.equipment)}::jsonb,
                ${JSON.stringify(project.metrics)}::jsonb,
                TRUE, ${DEMO_CONSENT}, ${index}, TRUE, TRUE)`;
    }

    // Credentials are seeded UNVERIFIED and UNPUBLISHED on purpose. The
    // database refuses to publish one without `verified_at`, and inventing a
    // certification for a site aimed at procurement teams who actually check
    // would be the worst possible false trust signal. The admin fills these in
    // once the real certificates exist.
    const CREDENTIALS = [
      {
        nameEn: "Third-party lifting equipment inspection",
        nameAr: "\u0641\u062d\u0635 \u0645\u0639\u062f\u0627\u062a \u0627\u0644\u0631\u0641\u0639 \u0645\u0646 \u0637\u0631\u0641 \u062b\u0627\u0644\u062b",
        issuerEn: "Accredited inspection body",
        issuerAr: "\u062c\u0647\u0629 \u0641\u062d\u0635 \u0645\u0639\u062a\u0645\u062f\u0629",
      },
      {
        nameEn: "ISO 9001 Quality Management",
        nameAr: "\u0622\u064a\u0632\u0648 9001 \u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062c\u0648\u062f\u0629",
        issuerEn: "Certification body",
        issuerAr: "\u062c\u0647\u0629 \u0625\u0635\u062f\u0627\u0631 \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a",
      },
      {
        nameEn: "ISO 45001 Occupational Health and Safety",
        nameAr: "\u0622\u064a\u0632\u0648 45001 \u0644\u0644\u0635\u062d\u0629 \u0648\u0627\u0644\u0633\u0644\u0627\u0645\u0629 \u0627\u0644\u0645\u0647\u0646\u064a\u0629",
        issuerEn: "Certification body",
        issuerAr: "\u062c\u0647\u0629 \u0625\u0635\u062f\u0627\u0631 \u0627\u0644\u0634\u0647\u0627\u062f\u0627\u062a",
      },
    ];

    for (const [index, c] of CREDENTIALS.entries()) {
      await tx`INSERT INTO credential
        (id, name_en, name_ar, issuer_en, issuer_ar, verified_at, sort_order,
         is_published, is_demo_data)
        VALUES (${uuidv7()}, ${c.nameEn}, ${c.nameAr}, ${c.issuerEn}, ${c.issuerAr},
                NULL, ${index}, FALSE, TRUE)`;
    }

    // --- a maintenance blackout, so the availability engine has something
    //     real to exclude rather than only ever returning "everything free".
    const [firstUnit] = await tx`SELECT id FROM equipment_unit ORDER BY asset_code LIMIT 1`;
    if (firstUnit) {
      const blackoutId = uuidv7();
      await tx`INSERT INTO unit_blackout (id, unit_id, period, reason, notes, created_by_user_id)
        VALUES (${blackoutId}, ${firstUnit.id},
                tstzrange(now() + interval '10 days', now() + interval '17 days'),
                'maintenance', 'Scheduled 500-hour service (demo data)', ${adminId})`;
      await tx`INSERT INTO maintenance_record
        (id, unit_id, blackout_id, type, description, cost_halalas, performed_by,
         started_at, next_due_at)
        VALUES (${uuidv7()}, ${firstUnit.id}, ${blackoutId}, 'scheduled_service',
                '500-hour service: filters, hydraulic check, load test (demo data)',
                ${sar(4200)}, 'Demo Workshop', now() + interval '10 days',
                now() + interval '190 days')`;
    }
  });

  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM equipment_category) AS categories,
      (SELECT COUNT(*) FROM equipment_class)    AS classes,
      (SELECT COUNT(*) FROM equipment_unit)     AS units,
      (SELECT COUNT(*) FROM branch)             AS branches,
      (SELECT COUNT(*) FROM rate_tier)          AS rate_tiers,
      (SELECT COUNT(*) FROM transport_rate)     AS transport_rates,
      (SELECT COUNT(*) FROM addon_option)       AS addons,
      (SELECT COUNT(*) FROM article)            AS articles,
      (SELECT COUNT(*) FROM faq)                AS faqs
  `;

  const c = counts[0];
  console.log("Seeded:");
  console.log(`  ${c.categories} categories, ${c.classes} equipment classes, ${c.units} physical units`);
  console.log(`  ${c.branches} branches, ${c.rate_tiers} rate tiers, ${c.transport_rates} transport rates`);
  console.log(`  ${c.addons} add-ons, ${c.articles} articles, ${c.faqs} FAQs`);
  console.log("\nDemo sign-in:");
  console.log(`  admin:    ${process.env.SEED_ADMIN_EMAIL || "admin@example.com"}`);
  console.log(`  customer: customer@example.com`);
  console.log(`  password: ${process.env.SEED_ADMIN_PASSWORD || "ChangeMe_Dev_Only_123"}`);
  console.log("\nAll equipment is FICTIONAL demo data and is flagged as such in the UI.");

  // The demo photographs live in class_image and are fetched separately, so a
  // reset silently leaves every machine on its generated illustration. Saying
  // so here beats wondering later why the photographs disappeared.
  const [imageRow] = await sql`SELECT count(*)::int AS count FROM class_image`;
  if (!imageRow || imageRow.count === 0) {
    console.log(
      [
        "",
        "No equipment photographs are loaded, so every machine shows its generated",
        "technical illustration. Run `node scripts/fetch-demo-images.mjs` to pull",
        "freely-licensed Wikimedia photos (attribution is recorded and rendered),",
        "or load the real fleet's own.",
      ].join("\n"),
    );
  }
}

main()
  .then(() => sql.end())
  .catch(async (error) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });
