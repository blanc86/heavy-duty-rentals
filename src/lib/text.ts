/**
 * Keeps a number on the same line as the word after it — "100 t", "3.2 km",
 * "7 weeks", "300 طن" — so a line never ends on a bare figure with its unit
 * stranded at the start of the next.
 */
export function keepNumbersWithUnits(text: string): string {
  return text.replace(/(\d) (?=[^\s\d])/g, "$1 ");
}
