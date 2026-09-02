/**
 * Money.
 *
 * Every monetary value in this system is an integer number of halalas
 * (1 SAR = 100 halalas), carried as `bigint`. There is no float anywhere in the
 * money path.
 *
 * This is not fastidiousness. `0.1 + 0.2 !== 0.3` on a VAT line produces an
 * invoice that does not foot, which in Saudi Arabia is a tax defect and not
 * merely a display bug. Integers make the arithmetic exact and the tests
 * meaningful.
 */

export type Halalas = bigint;

export const ZERO: Halalas = 0n;

/** Parts-per-million, so 15% VAT is 150_000 and stays an integer. */
export type Ppm = number;

export function sar(amount: number): Halalas {
  if (!Number.isFinite(amount)) throw new RangeError(`Not a finite SAR amount: ${amount}`);
  // Round at the boundary where a human-entered decimal becomes canonical.
  return BigInt(Math.round(amount * 100));
}

export function sum(values: readonly Halalas[]): Halalas {
  return values.reduce<Halalas>((acc, v) => acc + v, ZERO);
}

/**
 * Multiply by a parts-per-million rate, rounding half-up.
 *
 * Half-up (rather than banker's rounding) is used because it is what invoice
 * recipients and tax authorities expect: 0.5 halalas rounds up, always.
 */
export function applyPpm(amount: Halalas, ppm: Ppm): Halalas {
  if (!Number.isInteger(ppm) || ppm < 0) throw new RangeError(`Invalid ppm: ${ppm}`);
  const numerator = amount * BigInt(ppm);
  const denominator = 1_000_000n;
  return roundHalfUpDivide(numerator, denominator);
}

/** Integer division rounding half away from zero. */
export function roundHalfUpDivide(numerator: Halalas, denominator: Halalas): Halalas {
  if (denominator === 0n) throw new RangeError("Division by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absNumerator / absDenominator;
  const remainder = absNumerator % absDenominator;
  const rounded = remainder * 2n >= absDenominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** Never let a computed charge go negative — a discount cannot pay the customer. */
export function clampToZero(amount: Halalas): Halalas {
  return amount < ZERO ? ZERO : amount;
}

export function min(a: Halalas, b: Halalas): Halalas {
  return a < b ? a : b;
}

export function max(a: Halalas, b: Halalas): Halalas {
  return a > b ? a : b;
}

/**
 * Format for display. The ONLY place halalas become a decimal string.
 *
 * Arabic uses Eastern Arabic numerals and places the currency according to the
 * locale's own conventions; delegating to Intl is what makes the Arabic side
 * read as native rather than as a translated English page.
 */
export function formatMoney(amount: Halalas, locale: "en" | "ar", currency = "SAR"): string {
  const asNumber = Number(amount) / 100;
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber);
}

/** Compact form for cards and listings: "SAR 2,000/day". */
export function formatMoneyCompact(amount: Halalas, locale: "en" | "ar", currency = "SAR"): string {
  const asNumber = Number(amount) / 100;
  const hasFraction = amount % 100n !== 0n;
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    style: "currency",
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(asNumber);
}

/**
 * bigint does not survive JSON. Money crossing a serialization boundary
 * (Server Component -> Client Component, or an API response) travels as a
 * decimal string and is parsed back with `parseHalalas`.
 */
export function serializeHalalas(amount: Halalas): string {
  return amount.toString();
}

export function parseHalalas(value: string | number | bigint): Halalas {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RangeError(`Unsafe halalas value: ${value}`);
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value)) throw new RangeError(`Not an integer halalas string: ${value}`);
  return BigInt(value);
}
