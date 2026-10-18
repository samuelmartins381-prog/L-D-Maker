// French typography applied by code, not left to the model: non-breaking spaces before high
// punctuation and inside guillemets, between a number and its unit, and a narrow no-break space
// between groups of thousands (as in the demo module).
const NBSP = "\u00a0";
const NNBSP = "\u202f";

export function frenchTypography(text: string): string {
  return (
    text
      // Spaces before ; : ! ? and », after «.
      .replace(/[ \u00a0\u202f]+([;:!?»])/g, `${NBSP}$1`)
      .replace(/«[ \u00a0\u202f]*/g, `«${NBSP}`)
      .replace(/([^\s«])»/g, `$1${NBSP}»`)
      // Thousands already spaced: 28 800, 1 000 000.
      .replace(/(?<![\d.,])\d{1,3}(?:[ \u00a0]\d{3})+(?!\d)/g, (n) =>
        n.replace(/[ \u00a0]/g, NNBSP),
      )
      // Five digits or more, not spaced (years and four-digit numbers are left alone).
      .replace(/(?<![\d.,])\d{5,}(?![\d.,])/g, (n) =>
        n.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP),
      )
      // A number and a short unit or word that follows it: 4 h, 80 %, 20 min, 7 ans.
      .replace(/(\d) (?=%|[A-Za-zµ°€$]{1,4}\b)/g, `$1${NBSP}`)
  );
}

/** Typography of a whole catalogue, for the languages that have rules here. */
export function applyTypography(
  locale: string,
  strings: Record<string, string>,
): Record<string, string> {
  if (locale !== "fr" && !locale.startsWith("fr-")) return strings;
  return Object.fromEntries(
    Object.entries(strings).map(([k, v]) => [k, frenchTypography(v)]),
  );
}
