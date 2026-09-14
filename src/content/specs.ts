import type { Localized, Machine, SpecKey } from "./catalog";

/**
 * How each specification is named and printed.
 *
 * Units stay in Latin script in both languages ("50 t", "12 m"), matching how
 * they appear on the machines, load charts and datasheets that Arabic-speaking
 * engineers read every day. Numbers are formatted per locale by the caller.
 */

type SpecFormat =
  | { kind: "number"; unit?: string; decimals?: number }
  /** Stored in kg; printed in tonnes at 1000 kg and above. */
  | { kind: "mass" }
  | { kind: "enum"; values: Record<string, Localized> };

export interface SpecDefinition {
  label: Localized;
  format: SpecFormat;
}

export const SPEC_DEFINITIONS: Record<SpecKey, SpecDefinition> = {
  capacityKg: { label: { en: "Rated capacity", ar: "الحمولة المقننة" }, format: { kind: "mass" } },
  maxBoomM: { label: { en: "Main boom length", ar: "طول الذراع الرئيسي" }, format: { kind: "number", unit: "m" } },
  maxRadiusM: { label: { en: "Maximum radius", ar: "أقصى نصف قطر" }, format: { kind: "number", unit: "m" } },
  driveType: {
    label: { en: "Type", ar: "النوع" },
    format: {
      kind: "enum",
      values: {
        all_terrain: { en: "All-terrain", ar: "جميع التضاريس" },
        rough_terrain: { en: "Rough terrain", ar: "التضاريس الوعرة" },
        truck: { en: "Truck-mounted", ar: "مركبة على شاحنة" },
        crawler: { en: "Crawler", ar: "زاحفة" },
      },
    },
  },
  axles: { label: { en: "Axles", ar: "المحاور" }, format: { kind: "number" } },
  transportWeightKg: { label: { en: "Road weight", ar: "وزن النقل" }, format: { kind: "mass" } },
  transportLoads: { label: { en: "Transport loads", ar: "أحمال النقل" }, format: { kind: "number" } },
  deckLengthM: { label: { en: "Deck length", ar: "طول السطح" }, format: { kind: "number", unit: "m", decimals: 1 } },
  liftHeightM: { label: { en: "Lift height", ar: "ارتفاع الرفع" }, format: { kind: "number", unit: "m", decimals: 1 } },
  fuelType: {
    label: { en: "Power", ar: "مصدر الطاقة" },
    format: {
      kind: "enum",
      values: {
        diesel: { en: "Diesel", ar: "ديزل" },
        lpg: { en: "LPG", ar: "غاز" },
        electric: { en: "Electric", ar: "كهربائي" },
      },
    },
  },
  tyreType: {
    label: { en: "Tyres", ar: "الإطارات" },
    format: {
      kind: "enum",
      values: {
        pneumatic: { en: "Pneumatic", ar: "هوائية" },
        solid: { en: "Solid", ar: "صلبة" },
      },
    },
  },
  operatingWeightKg: { label: { en: "Operating weight", ar: "وزن التشغيل" }, format: { kind: "mass" } },
  bucketM3: { label: { en: "Bucket capacity", ar: "سعة الدلو" }, format: { kind: "number", unit: "m³", decimals: 1 } },
  enginePowerKw: { label: { en: "Engine power", ar: "قدرة المحرك" }, format: { kind: "number", unit: "kW" } },
  maxDigDepthM: { label: { en: "Dig depth", ar: "عمق الحفر" }, format: { kind: "number", unit: "m", decimals: 1 } },
  workingHeightM: { label: { en: "Working height", ar: "ارتفاع العمل" }, format: { kind: "number", unit: "m", decimals: 1 } },
  platformHeightM: { label: { en: "Platform height", ar: "ارتفاع المنصة" }, format: { kind: "number", unit: "m", decimals: 1 } },
  platformCapacityKg: { label: { en: "Platform capacity", ar: "حمولة المنصة" }, format: { kind: "number", unit: "kg" } },
  horizontalReachM: { label: { en: "Horizontal reach", ar: "المدى الأفقي" }, format: { kind: "number", unit: "m", decimals: 1 } },
  outputKva: { label: { en: "Output", ar: "القدرة" }, format: { kind: "number", unit: "kVA" } },
  fuelTankL: { label: { en: "Fuel tank", ar: "خزان الوقود" }, format: { kind: "number", unit: "L" } },
  noiseDbAt7m: { label: { en: "Noise at 7 m", ar: "الضوضاء على بعد 7 م" }, format: { kind: "number", unit: "dB(A)" } },
  freeAirDeliveryCfm: { label: { en: "Air delivery", ar: "تدفق الهواء" }, format: { kind: "number", unit: "cfm" } },
  workingPressureBar: { label: { en: "Working pressure", ar: "ضغط التشغيل" }, format: { kind: "number", unit: "bar" } },
  maxFlowM3h: { label: { en: "Maximum flow", ar: "أقصى تدفق" }, format: { kind: "number", unit: "m³/h" } },
  maxHeadM: { label: { en: "Maximum head", ar: "أقصى ارتفاع ضخ" }, format: { kind: "number", unit: "m" } },
  payloadKg: { label: { en: "Payload", ar: "الحمولة" }, format: { kind: "mass" } },
  deckHeightM: { label: { en: "Deck height", ar: "ارتفاع السطح" }, format: { kind: "number", unit: "m", decimals: 2 } },
};

/**
 * The order specs appear in a table: the defining numbers first, logistics last.
 * Anything not listed falls to the end in its stored order.
 */
const SPEC_ORDER: SpecKey[] = [
  "capacityKg", "payloadKg", "liftHeightM", "workingHeightM", "platformHeightM", "horizontalReachM",
  "maxBoomM", "maxRadiusM", "operatingWeightKg", "bucketM3", "maxDigDepthM", "outputKva",
  "freeAirDeliveryCfm", "maxFlowM3h", "maxHeadM", "platformCapacityKg", "enginePowerKw",
  "workingPressureBar", "driveType", "fuelType", "tyreType", "deckLengthM", "deckHeightM",
  "axles", "fuelTankL", "noiseDbAt7m", "transportWeightKg", "transportLoads",
];

export interface FormattedSpec {
  key: SpecKey;
  label: string;
  value: string;
}

export function formatSpecValue(
  key: SpecKey,
  raw: number | string,
  locale: "en" | "ar",
): string {
  const { format } = SPEC_DEFINITIONS[key];
  const intl = locale === "ar" ? "ar-SA" : "en-SA";
  // Latin digits in both locales: a capacity is read against a datasheet, and
  // mixing Arabic-Indic digits with Latin units ("٥٠ t") hurts scanning.
  const number = (value: number, decimals = 0) =>
    new Intl.NumberFormat(`${intl}-u-nu-latn`, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    }).format(value);

  switch (format.kind) {
    case "enum":
      return format.values[String(raw)]?.[locale] ?? String(raw);
    case "mass": {
      const kg = Number(raw);
      return kg >= 1000 ? `${number(kg / 1000, 1)} t` : `${number(kg)} kg`;
    }
    case "number":
      return format.unit
        ? `${number(Number(raw), format.decimals ?? 0)} ${format.unit}`
        : number(Number(raw), format.decimals ?? 0);
  }
}

export function formattedSpecs(machine: Machine, locale: "en" | "ar"): FormattedSpec[] {
  const keys = Object.keys(machine.specs) as SpecKey[];
  const rank = (key: SpecKey) => {
    const index = SPEC_ORDER.indexOf(key);
    return index === -1 ? SPEC_ORDER.length : index;
  };
  return keys
    .sort((a, b) => rank(a) - rank(b))
    .map((key) => ({
      key,
      label: SPEC_DEFINITIONS[key].label[locale],
      value: formatSpecValue(key, machine.specs[key] as number | string, locale),
    }));
}
