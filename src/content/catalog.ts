/**
 * THE EQUIPMENT CATALOGUE.
 *
 * The single source of truth for every category and machine on the site:
 * pages, cards, the fleet strip, the sitemap, structured data and the enquiry
 * form's equipment list are all generated from this file. Adding a machine is
 * an entry here plus an `equipment/<slug>` entry in images.json, built with
 * `npm run images:prepare`; a test fails if the photo is missing.
 *
 * Deliberately free of framework imports, so next.config.ts can read slugs to
 * build redirects.
 *
 * CONFIRM AGAINST THE REAL FLEET. These classes and specifications came from
 * the original demo catalogue. Manufacturer and model are shown as a "typical
 * model, or equivalent" — how rental firms describe a class they may fill with
 * more than one make. Remove any machine the business does not rent.
 */

export type Localized = { en: string; ar: string };
export type LocalizedList = { en: string[]; ar: string[] };

export type SpecKey =
  | "capacityKg" | "maxBoomM" | "maxRadiusM" | "driveType" | "axles" | "transportWeightKg"
  | "transportLoads" | "deckLengthM" | "liftHeightM" | "fuelType" | "tyreType"
  | "operatingWeightKg" | "bucketM3" | "enginePowerKw" | "maxDigDepthM" | "workingHeightM"
  | "platformHeightM" | "platformCapacityKg" | "horizontalReachM" | "outputKva" | "fuelTankL"
  | "noiseDbAt7m" | "freeAirDeliveryCfm" | "workingPressureBar" | "maxFlowM3h" | "maxHeadM"
  | "payloadKg" | "deckHeightM";

export interface Category {
  slug: string;
  name: Localized;
  /** One line for cards. */
  summary: Localized;
  /** Two or three sentences for the category page. */
  intro: Localized;
  /** What people also call it — the words they actually type into search. */
  alsoKnownAs: LocalizedList;
  /** The spec shown on each machine's rating plate in this category. */
  plateSpec: SpecKey;
}

export interface Machine {
  slug: string;
  category: string;
  name: Localized;
  typicalModel: { manufacturer: string; model: string };
  description: Localized;
  specs: Partial<Record<SpecKey, number | string>>;
  /** included: supplied with a certified operator. optional: bare, operator on request. */
  operator: "included" | "optional";
  included: LocalizedList;
  notIncluded: LocalizedList;
}

export const CATEGORIES: Category[] = [
  {
    slug: "mobile-cranes",
    name: { en: "Mobile Cranes", ar: "رافعات متحركة" },
    summary: { en: "All-terrain, rough-terrain and truck-mounted cranes for lifting on constrained sites.", ar: "رافعات لجميع التضاريس والتضاريس الوعرة ورافعات الشاحنات لأعمال الرفع في المواقع المحدودة." },
    intro: { en: "All-terrain mobile cranes drive to site on public roads, set up on outriggers and are lifting within hours. They suit short hires, several lift positions and tight urban or plant access.", ar: "تصل رافعات جميع التضاريس المتحركة إلى الموقع عبر الطرق العامة، وتُجهَّز على الدعامات وتبدأ الرفع خلال ساعات. وهي مناسبة للإيجارات القصيرة وتعدد مواقع الرفع والمداخل الضيقة في المدن والمصانع." },
    alsoKnownAs: { en: ["mobile crane","all-terrain crane"], ar: ["كرين","ونش"] },
    plateSpec: "capacityKg",
  },
  {
    slug: "crawler-cranes",
    name: { en: "Crawler Cranes", ar: "رافعات زاحفة" },
    summary: { en: "Heavy-lift crawler cranes for sustained duty on prepared ground.", ar: "رافعات زاحفة للرفع الثقيل والعمل المستمر على أرض مجهزة." },
    intro: { en: "Crawler cranes arrive in sections, are assembled on site and then work for weeks on prepared ground. Choose one for sustained heavy lifting at long radius.", ar: "تصل الرافعات الزاحفة على أجزاء، وتُركَّب في الموقع، ثم تعمل لأسابيع على أرض مجهزة. اخترها لأعمال الرفع الثقيلة المستمرة عند نصف قطر طويل." },
    alsoKnownAs: { en: ["lattice boom crane"], ar: ["كرين زاحف","رافعة جنزير"] },
    plateSpec: "capacityKg",
  },
  {
    slug: "boom-trucks",
    name: { en: "Boom Trucks", ar: "شاحنات ذات ذراع" },
    summary: { en: "Truck-mounted knuckle and telescopic boom cranes for load-and-carry work.", ar: "شاحنات مزودة بذراع تلسكوبي أو مفصلي لأعمال التحميل والنقل." },
    intro: { en: "A crane and a flatbed in one vehicle. Boom trucks load, carry and place materials without a separate crane and transport booking.", ar: "رافعة وشاحنة مسطحة في مركبة واحدة. تقوم الشاحنات ذات الذراع بتحميل المواد ونقلها ووضعها دون الحاجة إلى رافعة ونقل منفصلين." },
    alsoKnownAs: { en: ["truck-mounted crane","HIAB"], ar: ["ونش","بوم ترك"] },
    plateSpec: "capacityKg",
  },
  {
    slug: "forklifts",
    name: { en: "Forklifts", ar: "رافعات شوكية" },
    summary: { en: "Diesel, LPG and electric forklifts from warehouse to heavy industrial duty.", ar: "رافعات شوكية ديزل وغاز وكهربائية للمستودعات والأعمال الصناعية الثقيلة." },
    intro: { en: "Diesel forklifts from general yard duty up to heavy industrial handling of steel, containers and plant components.", ar: "رافعات شوكية تعمل بالديزل، من أعمال الساحات العامة إلى المناولة الصناعية الثقيلة للحديد والحاويات ومكونات المعدات." },
    alsoKnownAs: { en: ["forklift truck"], ar: ["فوركلفت","رافعة شوكية"] },
    plateSpec: "capacityKg",
  },
  {
    slug: "telehandlers",
    name: { en: "Telehandlers", ar: "رافعات تلسكوبية" },
    summary: { en: "Telescopic handlers for placing loads at height and reach on site.", ar: "رافعات تلسكوبية لوضع الأحمال على ارتفاع ومدى في الموقع." },
    intro: { en: "Telehandlers lift palletised materials to height and reach over obstacles, so upper floors and roofs can be loaded without a crane.", ar: "ترفع الرافعات التلسكوبية المواد على المنصات إلى الارتفاعات وتتجاوز العوائق، فيمكن تحميل الطوابق العليا والأسطح دون رافعة." },
    alsoKnownAs: { en: ["telescopic handler","reach forklift"], ar: ["تليهاندلر","رافعة تلسكوبية"] },
    plateSpec: "liftHeightM",
  },
  {
    slug: "excavators",
    name: { en: "Excavators", ar: "حفارات" },
    summary: { en: "Tracked excavators for bulk earthworks, trenching and demolition support.", ar: "حفارات مجنزرة لأعمال الحفر والخنادق ودعم الهدم." },
    intro: { en: "Tracked excavators for bulk earthworks, trenching, loading trucks and supporting demolition, from general-purpose to large mass-excavation machines.", ar: "حفارات مجنزرة لأعمال الحفر الكبيرة والخنادق وتحميل الشاحنات ودعم أعمال الهدم، من الأحجام متعددة الاستخدامات إلى معدات الحفر الضخمة." },
    alsoKnownAs: { en: ["tracked excavator","digger"], ar: ["بوكلين","حفار"] },
    plateSpec: "operatingWeightKg",
  },
  {
    slug: "wheel-loaders",
    name: { en: "Wheel Loaders", ar: "لوادر بعجل" },
    summary: { en: "Wheel loaders for stockpiling, loading and site haulage.", ar: "لوادر بعجل للتكديس والتحميل والنقل داخل الموقع." },
    intro: { en: "Wheel loaders move stockpiles, load trucks and keep material flowing around quarries, batching plants and large sites.", ar: "تنقل اللوادر ذات العجل أكوام المواد وتحمّل الشاحنات وتحافظ على حركة المواد في المحاجر ومحطات الخلط والمواقع الكبيرة." },
    alsoKnownAs: { en: ["front-end loader","shovel"], ar: ["شيول","لودر"] },
    plateSpec: "bucketM3",
  },
  {
    slug: "backhoe-loaders",
    name: { en: "Backhoe Loaders", ar: "حفارات لودر" },
    summary: { en: "Combined loader and backhoe machines for utilities and general site work.", ar: "معدات تجمع بين اللودر والحفار لأعمال المرافق والأعمال العامة." },
    intro: { en: "One machine that digs at the back and loads at the front. Backhoe loaders are the standard choice for utilities, trenching and smaller sites.", ar: "معدة واحدة تحفر من الخلف وتحمّل من الأمام. الحفار اللودر هو الخيار المعتاد لأعمال المرافق والخنادق والمواقع الأصغر." },
    alsoKnownAs: { en: ["JCB","backhoe"], ar: ["جي سي بي","باكهو"] },
    plateSpec: "maxDigDepthM",
  },
  {
    slug: "manlifts",
    name: { en: "Manlifts / MEWPs", ar: "رافعات أفراد" },
    summary: { en: "Articulating and telescopic boom lifts for elevated access.", ar: "رافعات ذات ذراع مفصلي أو تلسكوبي للوصول إلى المرتفعات." },
    intro: { en: "Articulating and telescopic boom lifts put people and tools safely at height, reaching up and over structures, pipe racks and plant.", ar: "ترفع رافعات الأفراد ذات الذراع المفصلي أو التلسكوبي العمال ومعداتهم بأمان إلى المرتفعات، مع الوصول فوق الهياكل وحوامل الأنابيب والمعدات." },
    alsoKnownAs: { en: ["boom lift","cherry picker","MEWP"], ar: ["مان لفت","رافعة أفراد"] },
    plateSpec: "workingHeightM",
  },
  {
    slug: "scissor-lifts",
    name: { en: "Scissor Lifts", ar: "رافعات مقصية" },
    summary: { en: "Vertical platform lifts for indoor and slab-level access work.", ar: "رافعات منصات عمودية للأعمال الداخلية والوصول على مستوى البلاطة." },
    intro: { en: "Scissor lifts raise a wide, stable platform straight up. Electric models produce no emissions at the platform, so they suit indoor and enclosed work.", ar: "ترفع الرافعات المقصية منصة واسعة ومستقرة بشكل عمودي. والطرازات الكهربائية لا تصدر انبعاثات عند المنصة، لذا تناسب الأعمال الداخلية والمغلقة." },
    alsoKnownAs: { en: ["scissor platform"], ar: ["سيزر لفت","رافعة مقصية"] },
    plateSpec: "platformHeightM",
  },
  {
    slug: "generators",
    name: { en: "Generators", ar: "مولدات كهربائية" },
    summary: { en: "Silenced diesel generator sets for temporary and standby site power.", ar: "مولدات ديزل صامتة للطاقة المؤقتة والاحتياطية في الموقع." },
    intro: { en: "Silenced diesel generator sets for temporary site power, events and standby supply while permanent power is installed or repaired.", ar: "مولدات ديزل صامتة لتوفير الطاقة المؤقتة للمواقع والفعاليات، وللتغذية الاحتياطية أثناء تركيب الكهرباء الدائمة أو إصلاحها." },
    alsoKnownAs: { en: ["genset","diesel generator"], ar: ["مولد كهرباء","ماطور"] },
    plateSpec: "outputKva",
  },
  {
    slug: "air-compressors",
    name: { en: "Air Compressors", ar: "ضواغط هواء" },
    summary: { en: "Portable diesel screw compressors for breaking, blasting and tooling.", ar: "ضواغط هواء ديزل متنقلة لأعمال التكسير والتنظيف والمعدات الهوائية." },
    intro: { en: "Towable diesel compressors that power pneumatic breakers, sandblasting and air tools where there is no site air supply.", ar: "ضواغط هواء ديزل قابلة للسحب تشغّل كسارات الهواء المضغوط والسفع الرملي والعدد الهوائية في المواقع التي لا يتوفر فيها هواء مضغوط." },
    alsoKnownAs: { en: ["portable compressor"], ar: ["كمبروسر","ضاغط هواء"] },
    plateSpec: "freeAirDeliveryCfm",
  },
  {
    slug: "dewatering-pumps",
    name: { en: "Dewatering Pumps", ar: "مضخات نزح المياه" },
    summary: { en: "Diesel-driven pumps for excavation dewatering and bypass duty.", ar: "مضخات تعمل بالديزل لنزح المياه من الحفريات وأعمال التحويل." },
    intro: { en: "Self-priming diesel pumps that keep excavations dry and bypass sewers and drainage during repairs.", ar: "مضخات ديزل ذاتية التحضير تحافظ على جفاف الحفريات وتحوّل مياه الصرف والتصريف أثناء أعمال الإصلاح." },
    alsoKnownAs: { en: ["trash pump","diesel pump"], ar: ["مضخة نزح","طرمبة ماء"] },
    plateSpec: "maxFlowM3h",
  },
  {
    slug: "low-bed-trailers",
    name: { en: "Low-bed & Hydraulic Trailers", ar: "مقطورات منخفضة وهيدروليكية" },
    summary: { en: "Low-bed and modular hydraulic trailers for plant and abnormal loads.", ar: "مقطورات منخفضة ومقطورات هيدروليكية معيارية لنقل المعدات والأحمال غير الاعتيادية." },
    intro: { en: "Low-bed trailers with a prime mover and licensed driver for moving tracked plant, crane components and abnormal loads between sites.", ar: "مقطورات منخفضة مع رأس قاطرة وسائق مرخص لنقل المعدات المجنزرة وأجزاء الرافعات والأحمال غير الاعتيادية بين المواقع." },
    alsoKnownAs: { en: ["lowboy","low loader"], ar: ["لوبد","مقطورة منخفضة"] },
    plateSpec: "payloadKg",
  },
];

export const MACHINES: Machine[] = [
  {
    slug: "all-terrain-crane-50t",
    category: "mobile-cranes",
    name: { en: "50 Tonne All-Terrain Crane", ar: "رافعة جميع التضاريس 50 طن" },
    typicalModel: { manufacturer: "Liebherr", model: "LTM 1050-3.1" },
    description: { en: "Three-axle all-terrain crane suited to urban and industrial sites where access is tight. Fast set-up and good road mobility between lifts.", ar: "رافعة جميع التضاريس بثلاثة محاور مناسبة للمواقع الحضرية والصناعية ذات المداخل الضيقة. سرعة في التجهيز وقدرة جيدة على التنقل بين عمليات الرفع." },
    specs: { capacityKg: 50000, maxBoomM: 38, maxRadiusM: 34, driveType: "all_terrain", axles: 3, transportWeightKg: 36000 },
    operator: "included",
    included: { en: ["Certified crane operator","Standard rigging (slings and shackles)","Routine servicing during hire","Third-party inspection certificate"], ar: ["مشغل رافعة معتمد","معدات ربط قياسية (أحزمة ومشابك)","الصيانة الدورية أثناء فترة الإيجار","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Fuel","Site preparation and ground bearing assessment","Lift plan and method statement","Permits and road closures","Standby time outside agreed shift"], ar: ["الوقود","تجهيز الموقع وتقييم تحمل التربة","خطة الرفع وبيان الطريقة","التصاريح وإغلاق الطرق","وقت الانتظار خارج الوردية المتفق عليها"] },
  },
  {
    slug: "all-terrain-crane-100t",
    category: "mobile-cranes",
    name: { en: "100 Tonne All-Terrain Crane", ar: "رافعة جميع التضاريس 100 طن" },
    typicalModel: { manufacturer: "Liebherr", model: "LTM 1100-4.2" },
    description: { en: "Four-axle all-terrain crane covering the majority of mid-rise construction and plant maintenance lifts. Long telescopic boom with a strong load chart at radius.", ar: "رافعة جميع التضاريس بأربعة محاور تغطي معظم عمليات الرفع في المباني متوسطة الارتفاع وصيانة المصانع. ذراع تلسكوبي طويل مع جدول أحمال قوي عند نصف القطر." },
    specs: { capacityKg: 100000, maxBoomM: 60, maxRadiusM: 56, driveType: "all_terrain", axles: 4, transportWeightKg: 48000 },
    operator: "included",
    included: { en: ["Certified crane operator","Standard rigging (slings and shackles)","Routine servicing during hire","Third-party inspection certificate"], ar: ["مشغل رافعة معتمد","معدات ربط قياسية (أحزمة ومشابك)","الصيانة الدورية أثناء فترة الإيجار","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Fuel","Site preparation and ground bearing assessment","Lift plan and method statement","Permits and road closures","Standby time outside agreed shift"], ar: ["الوقود","تجهيز الموقع وتقييم تحمل التربة","خطة الرفع وبيان الطريقة","التصاريح وإغلاق الطرق","وقت الانتظار خارج الوردية المتفق عليها"] },
  },
  {
    slug: "all-terrain-crane-200t",
    category: "mobile-cranes",
    name: { en: "200 Tonne All-Terrain Crane", ar: "رافعة جميع التضاريس 200 طن" },
    typicalModel: { manufacturer: "Grove", model: "GMK5200-1" },
    description: { en: "Five-axle heavy class crane for structural steel, vessel setting and major plant work. Requires prepared ground and a documented lift plan.", ar: "رافعة من الفئة الثقيلة بخمسة محاور لأعمال الهياكل المعدنية وتركيب الأوعية والأعمال الصناعية الكبرى. تتطلب أرضاً مجهزة وخطة رفع موثقة." },
    specs: { capacityKg: 200000, maxBoomM: 78, maxRadiusM: 70, driveType: "all_terrain", axles: 5, transportWeightKg: 72000 },
    operator: "included",
    included: { en: ["Certified crane operator","Rigger and banksman","Counterweight transport","Third-party inspection certificate"], ar: ["مشغل رافعة معتمد","فني ربط ومشير","نقل الأثقال الموازنة","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Fuel","Ground bearing pressure assessment and matting","Lift plan and method statement","Permits, escorts and road closures","Standby time outside agreed shift"], ar: ["الوقود","تقييم ضغط تحمل التربة والحصائر","خطة الرفع وبيان الطريقة","التصاريح والمرافقة وإغلاق الطرق","وقت الانتظار خارج الوردية المتفق عليها"] },
  },
  {
    slug: "crawler-crane-300t",
    category: "crawler-cranes",
    name: { en: "300 Tonne Crawler Crane", ar: "رافعة زاحفة 300 طن" },
    typicalModel: { manufacturer: "Liebherr", model: "LR 1300" },
    description: { en: "Lattice-boom crawler crane for sustained heavy lifting on prepared ground. Mobilisation is planned per project because it depends on a route survey, permits and the number of transport loads.", ar: "رافعة زاحفة بذراع شبكي للرفع الثقيل المستمر على أرض مجهزة. يتم تخطيط النقل والتعبئة لكل مشروع لأنها تعتمد على دراسة المسار والتصاريح وعدد أحمال النقل." },
    specs: { capacityKg: 300000, maxBoomM: 96, maxRadiusM: 84, driveType: "crawler", transportLoads: 14 },
    operator: "included",
    included: { en: ["Certified crane operator","Assembly and dismantling crew","Third-party inspection certificate"], ar: ["مشغل رافعة معتمد","طاقم التركيب والفك","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Fuel","Assist crane for assembly","Ground preparation and crane mats","Lift plan and method statement","Permits, escorts and route survey"], ar: ["الوقود","رافعة مساعدة للتركيب","تجهيز الأرض وحصائر الرافعة","خطة الرفع وبيان الطريقة","التصاريح والمرافقة ودراسة المسار"] },
  },
  {
    slug: "boom-truck-15t",
    category: "boom-trucks",
    name: { en: "15 Tonne Boom Truck", ar: "شاحنة ذات ذراع 15 طن" },
    typicalModel: { manufacturer: "Hiab", model: "X-HiPro 548" },
    description: { en: "Truck-mounted knuckle boom crane with a flatbed body. Ideal for load-and-carry duties, delivering materials and placing plant where a dedicated crane is not justified.", ar: "رافعة ذات ذراع مفصلي مركبة على شاحنة بصندوق مسطح. مثالية لأعمال التحميل والنقل وتوصيل المواد ووضع المعدات حيث لا تستدعي الحاجة رافعة مخصصة." },
    specs: { capacityKg: 15000, maxBoomM: 19, maxRadiusM: 18, driveType: "truck", deckLengthM: 7.2 },
    operator: "included",
    included: { en: ["Certified operator","Fuel","Standard slings and chains","Flatbed body"], ar: ["مشغل معتمد","الوقود","أحزمة وسلاسل قياسية","صندوق مسطح"] },
    notIncluded: { en: ["Overtime beyond 10-hour shift","Permits for abnormal loads","Waiting time on site"], ar: ["العمل الإضافي بعد وردية 10 ساعات","تصاريح الأحمال غير الاعتيادية","وقت الانتظار في الموقع"] },
  },
  {
    slug: "forklift-3t-diesel",
    category: "forklifts",
    name: { en: "3 Tonne Diesel Forklift", ar: "رافعة شوكية ديزل 3 طن" },
    typicalModel: { manufacturer: "Toyota", model: "8FD30" },
    description: { en: "General-purpose diesel counterbalance forklift for yard and warehouse handling. Pneumatic tyres suit unsealed ground.", ar: "رافعة شوكية ديزل متوازنة للأغراض العامة لأعمال المناولة في الساحات والمستودعات. الإطارات الهوائية مناسبة للأرضيات غير المعبدة." },
    specs: { capacityKg: 3000, liftHeightM: 4.5, fuelType: "diesel", tyreType: "pneumatic", operatingWeightKg: 4400 },
    operator: "optional",
    included: { en: ["Standard forks","Routine servicing during hire","Third-party inspection certificate"], ar: ["شوكات قياسية","الصيانة الدورية أثناء فترة الإيجار","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Fuel","Attachments beyond standard forks","Damage to forks or tyres"], ar: ["الوقود","الملحقات غير الشوكات القياسية","الأضرار التي تلحق بالشوكات أو الإطارات"] },
  },
  {
    slug: "forklift-16t-diesel",
    category: "forklifts",
    name: { en: "16 Tonne Diesel Forklift", ar: "رافعة شوكية ديزل 16 طن" },
    typicalModel: { manufacturer: "Hyster", model: "H16XM-12" },
    description: { en: "Heavy industrial forklift for handling containers, steel sections and plant components in ports and industrial yards.", ar: "رافعة شوكية صناعية ثقيلة لمناولة الحاويات والمقاطع المعدنية ومكونات المعدات في الموانئ والساحات الصناعية." },
    specs: { capacityKg: 16000, liftHeightM: 5.5, fuelType: "diesel", tyreType: "pneumatic", operatingWeightKg: 23000 },
    operator: "included",
    included: { en: ["Certified operator","Standard forks","Routine servicing during hire","Third-party inspection certificate"], ar: ["مشغل معتمد","شوكات قياسية","الصيانة الدورية أثناء فترة الإيجار","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Fuel","Attachments beyond standard forks","Permits for transport","Overtime beyond 10-hour shift"], ar: ["الوقود","الملحقات غير الشوكات القياسية","تصاريح النقل","العمل الإضافي بعد وردية 10 ساعات"] },
  },
  {
    slug: "telehandler-17m",
    category: "telehandlers",
    name: { en: "17 m Telehandler", ar: "رافعة تلسكوبية 17 متر" },
    typicalModel: { manufacturer: "JCB", model: "540-170" },
    description: { en: "Telescopic handler with 4 tonne capacity and 17 metre lift height. Handles palletised materials at height without a crane.", ar: "رافعة تلسكوبية بحمولة 4 أطنان وارتفاع رفع 17 متراً. تتعامل مع المواد المرصوصة على المنصات في الارتفاعات دون الحاجة إلى رافعة." },
    specs: { capacityKg: 4000, liftHeightM: 17, fuelType: "diesel", tyreType: "pneumatic", operatingWeightKg: 11000 },
    operator: "optional",
    included: { en: ["Standard forks","Routine servicing during hire","Third-party inspection certificate"], ar: ["شوكات قياسية","الصيانة الدورية أثناء فترة الإيجار","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Fuel","Jib or bucket attachments","Damage to tyres"], ar: ["الوقود","ملحقات الذراع أو الدلو","الأضرار التي تلحق بالإطارات"] },
  },
  {
    slug: "excavator-20t",
    category: "excavators",
    name: { en: "20 Tonne Tracked Excavator", ar: "حفار مجنزر 20 طن" },
    typicalModel: { manufacturer: "Caterpillar", model: "320" },
    description: { en: "The general-purpose size class for bulk earthworks, trenching and loading. Quick coupler fitted as standard.", ar: "فئة الحجم متعددة الاستخدامات لأعمال الحفر الكبيرة والخنادق والتحميل. مزود بوصلة سريعة كتجهيز قياسي." },
    specs: { operatingWeightKg: 20200, bucketM3: 1.19, enginePowerKw: 122, maxDigDepthM: 6.7 },
    operator: "optional",
    included: { en: ["General purpose bucket","Quick coupler","Routine servicing during hire"], ar: ["دلو للأغراض العامة","وصلة سريعة","الصيانة الدورية أثناء فترة الإيجار"] },
    notIncluded: { en: ["Fuel","Breaker or specialist attachments","Track damage from unsuitable ground"], ar: ["الوقود","الكسارة أو الملحقات المتخصصة","أضرار الجنزير الناتجة عن أرض غير مناسبة"] },
  },
  {
    slug: "excavator-36t",
    category: "excavators",
    name: { en: "36 Tonne Tracked Excavator", ar: "حفار مجنزر 36 طن" },
    typicalModel: { manufacturer: "Komatsu", model: "PC360LC-11" },
    description: { en: "Large tracked excavator for mass excavation, rock handling and heavy demolition support.", ar: "حفار مجنزر كبير لأعمال الحفر الضخمة ومناولة الصخور ودعم أعمال الهدم الثقيلة." },
    specs: { operatingWeightKg: 36500, bucketM3: 2.1, enginePowerKw: 202, maxDigDepthM: 7.8 },
    operator: "included",
    included: { en: ["Certified operator","General purpose bucket","Routine servicing during hire"], ar: ["مشغل معتمد","دلو للأغراض العامة","الصيانة الدورية أثناء فترة الإيجار"] },
    notIncluded: { en: ["Fuel","Breaker or specialist attachments","Transport permits","Overtime beyond 10-hour shift"], ar: ["الوقود","الكسارة أو الملحقات المتخصصة","تصاريح النقل","العمل الإضافي بعد وردية 10 ساعات"] },
  },
  {
    slug: "wheel-loader-3m3",
    category: "wheel-loaders",
    name: { en: "3 m³ Wheel Loader", ar: "لودر بعجل 3 م³" },
    typicalModel: { manufacturer: "Volvo", model: "L120H" },
    description: { en: "Mid-size wheel loader for stockpile handling, truck loading and general site logistics.", ar: "لودر بعجل متوسط الحجم لمناولة الأكوام وتحميل الشاحنات والخدمات اللوجستية العامة في الموقع." },
    specs: { operatingWeightKg: 20400, bucketM3: 3, enginePowerKw: 195 },
    operator: "optional",
    included: { en: ["General purpose bucket","Routine servicing during hire"], ar: ["دلو للأغراض العامة","الصيانة الدورية أثناء فترة الإيجار"] },
    notIncluded: { en: ["Fuel","Specialist attachments","Tyre damage"], ar: ["الوقود","الملحقات المتخصصة","أضرار الإطارات"] },
  },
  {
    slug: "backhoe-loader",
    category: "backhoe-loaders",
    name: { en: "Backhoe Loader", ar: "حفار لودر" },
    typicalModel: { manufacturer: "JCB", model: "3CX" },
    description: { en: "Combined loader and backhoe for utilities, trenching and general site work where a single versatile machine is preferable to two.", ar: "معدة تجمع بين اللودر والحفار لأعمال المرافق والخنادق والأعمال العامة حيث تكون معدة واحدة متعددة الاستخدامات أفضل من اثنتين." },
    specs: { operatingWeightKg: 8200, bucketM3: 1, enginePowerKw: 81, maxDigDepthM: 5.5 },
    operator: "optional",
    included: { en: ["Loader bucket and backhoe bucket","Routine servicing during hire"], ar: ["دلو اللودر ودلو الحفار","الصيانة الدورية أثناء فترة الإيجار"] },
    notIncluded: { en: ["Fuel","Breaker attachment","Tyre damage"], ar: ["الوقود","ملحق الكسارة","أضرار الإطارات"] },
  },
  {
    slug: "boom-lift-26m",
    category: "manlifts",
    name: { en: "26 m Articulating Boom Lift", ar: "رافعة أفراد مفصلية 26 متر" },
    typicalModel: { manufacturer: "Genie", model: "Z-80/60" },
    description: { en: "Diesel articulating boom lift with up-and-over reach for elevated access around structures and plant.", ar: "رافعة أفراد مفصلية تعمل بالديزل بمدى وصول فوق العوائق للوصول إلى المرتفعات حول الهياكل والمعدات." },
    specs: { workingHeightM: 26.4, platformHeightM: 24.4, horizontalReachM: 18.3, platformCapacityKg: 227, fuelType: "diesel" },
    operator: "optional",
    included: { en: ["Harness anchor points","Routine servicing during hire","Third-party inspection certificate"], ar: ["نقاط تثبيت الحزام","الصيانة الدورية أثناء فترة الإيجار","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Fuel","Fall-arrest harnesses","Ground preparation"], ar: ["الوقود","أحزمة منع السقوط","تجهيز الأرض"] },
  },
  {
    slug: "scissor-lift-12m",
    category: "scissor-lifts",
    name: { en: "12 m Electric Scissor Lift", ar: "رافعة مقصية كهربائية 12 متر" },
    typicalModel: { manufacturer: "JLG", model: "4069LE" },
    description: { en: "Electric rough-terrain scissor lift. Zero emissions at the platform makes it suitable for indoor and enclosed work.", ar: "رافعة مقصية كهربائية للتضاريس الوعرة. انعدام الانبعاثات عند المنصة يجعلها مناسبة للأعمال الداخلية والمغلقة." },
    specs: { platformHeightM: 12.2, workingHeightM: 14.2, platformCapacityKg: 350, fuelType: "electric" },
    operator: "optional",
    included: { en: ["Charger","Routine servicing during hire","Third-party inspection certificate"], ar: ["الشاحن","الصيانة الدورية أثناء فترة الإيجار","شهادة فحص من طرف ثالث"] },
    notIncluded: { en: ["Site power for charging","Fall-arrest harnesses"], ar: ["الطاقة الكهربائية في الموقع للشحن","أحزمة منع السقوط"] },
  },
  {
    slug: "generator-500kva",
    category: "generators",
    name: { en: "500 kVA Diesel Generator", ar: "مولد ديزل 500 كيلو فولت أمبير" },
    typicalModel: { manufacturer: "Cummins", model: "C500D5" },
    description: { en: "Silenced 500 kVA generator set in a weatherproof canopy with integral fuel tank. Suitable for prime and standby site power.", ar: "مولد كهربائي صامت بقدرة 500 كيلو فولت أمبير في هيكل مقاوم للعوامل الجوية مع خزان وقود مدمج. مناسب للطاقة الأساسية والاحتياطية في الموقع." },
    specs: { outputKva: 500, fuelTankL: 990, enginePowerKw: 400, noiseDbAt7m: 75 },
    operator: "optional",
    included: { en: ["Weatherproof canopy","Integral fuel tank","Routine servicing during hire"], ar: ["هيكل مقاوم للعوامل الجوية","خزان وقود مدمج","الصيانة الدورية أثناء فترة الإيجار"] },
    notIncluded: { en: ["Fuel","Distribution board and cabling","Electrical connection by a licensed electrician","Earthing installation"], ar: ["الوقود","لوحة التوزيع والكابلات","التوصيل الكهربائي بواسطة كهربائي مرخص","تركيب التأريض"] },
  },
  {
    slug: "air-compressor-375cfm",
    category: "air-compressors",
    name: { en: "375 cfm Air Compressor", ar: "ضاغط هواء 375 قدم مكعب/دقيقة" },
    typicalModel: { manufacturer: "Atlas Copco", model: "XATS 375" },
    description: { en: "Towable diesel screw compressor for pneumatic breakers, sand blasting and general site tooling.", ar: "ضاغط هواء لولبي يعمل بالديزل وقابل للسحب لكسارات الهواء المضغوط والسفع الرملي والمعدات العامة في الموقع." },
    specs: { fuelTankL: 235, freeAirDeliveryCfm: 375, workingPressureBar: 7 },
    operator: "optional",
    included: { en: ["Towing hitch","Routine servicing during hire"], ar: ["وصلة القطر","الصيانة الدورية أثناء فترة الإيجار"] },
    notIncluded: { en: ["Fuel","Air hoses and tooling","Towing vehicle"], ar: ["الوقود","خراطيم الهواء والمعدات","مركبة القطر"] },
  },
  {
    slug: "dewatering-pump-6in",
    category: "dewatering-pumps",
    name: { en: "6 inch Dewatering Pump", ar: "مضخة نزح مياه 6 بوصة" },
    typicalModel: { manufacturer: "Selwood", model: "S150" },
    description: { en: "Diesel-driven self-priming pump for excavation dewatering and sewer bypass. Handles solids in suspension.", ar: "مضخة ذاتية التحضير تعمل بالديزل لنزح مياه الحفريات وتحويل مياه الصرف. تتعامل مع المواد الصلبة العالقة." },
    specs: { fuelTankL: 210, maxFlowM3h: 200, maxHeadM: 24 },
    operator: "optional",
    included: { en: ["Suction strainer","Routine servicing during hire"], ar: ["مصفاة الشفط","الصيانة الدورية أثناء فترة الإيجار"] },
    notIncluded: { en: ["Fuel","Hoses and fittings","Discharge permits"], ar: ["الوقود","الخراطيم والوصلات","تصاريح التصريف"] },
  },
  {
    slug: "low-bed-trailer-60t",
    category: "low-bed-trailers",
    name: { en: "60 Tonne Low-bed Trailer", ar: "مقطورة منخفضة 60 طن" },
    typicalModel: { manufacturer: "Faymonville", model: "MegaMAX" },
    description: { en: "Low-bed semi-trailer supplied with a prime mover and licensed driver for moving tracked plant and abnormal loads. Escort vehicles can be arranged where the load requires them.", ar: "مقطورة منخفضة تُوفَّر مع رأس قاطرة وسائق مرخص لنقل المعدات المجنزرة والأحمال غير الاعتيادية. يمكن ترتيب مركبات المرافقة عندما تتطلب الحمولة ذلك." },
    specs: { payloadKg: 60000, deckLengthM: 13.6, deckHeightM: 0.85 },
    operator: "included",
    included: { en: ["Prime mover and licensed driver","Fuel","Load securing equipment"], ar: ["رأس القاطرة وسائق مرخص","الوقود","معدات تأمين الحمولة"] },
    notIncluded: { en: ["Abnormal load permits","Escort vehicles","Loading and unloading crane","Waiting time"], ar: ["تصاريح الأحمال غير الاعتيادية","مركبات المرافقة","رافعة التحميل والتفريغ","وقت الانتظار"] },
  },
];
