export declare function languageOf(locale: string): string;
export declare function directionOf(locale: string): "ltr" | "rtl";
/**
 * Picks the module locale to display: an explicit request (URL, LMS) wins, then the learner's
 * browser preferences, then the module default. Matches exact tags first, then by language.
 */
export declare function negotiateLocale(
  available: readonly string[],
  fallback: string,
  requested: readonly (string | null | undefined)[],
): string;
/** Replaces {name} placeholders. Unknown placeholders are left visible so they get noticed. */
export declare function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string;
