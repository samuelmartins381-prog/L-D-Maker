// Locale negotiation and text direction. Pure functions: unit-tested without a browser.
const RTL_LANGUAGES = new Set([
  "ar",
  "he",
  "fa",
  "ur",
  "ps",
  "yi",
  "dv",
  "ckb",
]);
export function languageOf(locale) {
  return locale.split("-")[0]?.toLowerCase() ?? locale;
}
export function directionOf(locale) {
  return RTL_LANGUAGES.has(languageOf(locale)) ? "rtl" : "ltr";
}
/**
 * Picks the module locale to display: an explicit request (URL, LMS) wins, then the learner's
 * browser preferences, then the module default. Matches exact tags first, then by language.
 */
export function negotiateLocale(available, fallback, requested) {
  const wanted = requested.filter((r) => !!r);
  for (const r of wanted) {
    const exact = available.find((a) => a.toLowerCase() === r.toLowerCase());
    if (exact) return exact;
  }
  for (const r of wanted) {
    const byLanguage = available.find((a) => languageOf(a) === languageOf(r));
    if (byLanguage) return byLanguage;
  }
  return fallback;
}
/** Replaces {name} placeholders. Unknown placeholders are left visible so they get noticed. */
export function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}
