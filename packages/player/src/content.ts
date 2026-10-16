import type { Module, StringCatalog } from "@ldm/schema";

/**
 * What the builder embeds in index.html (<script type="application/json" id="ldm-content">):
 * a validated module plus the string catalogs of its default locale. The player never reads raw YAML.
 * Other locales ship as `locales/<locale>.js` packs, loaded on demand (ADR 0007): the first screen
 * stays light whatever the number of languages, and a <script src> still works from file://.
 */
export interface CompiledContent {
  format: 1;
  /** Delivery target chosen at build time: decides which tracker the player uses. */
  target: "web" | "scorm12" | "scorm2004";
  module: Module;
  /** Module strings, keyed by module locale (the default locale at first, packs added when loaded). */
  strings: Record<string, StringCatalog>;
  /** Player interface strings, keyed by module locale, plus "en" (the fallback). */
  ui: Record<string, StringCatalog>;
}

/** Everything one locale needs: module strings and player interface strings. */
export interface LocalePack {
  strings: StringCatalog;
  ui: StringCatalog;
}

export const CONTENT_ELEMENT_ID = "ldm-content";
/** Folder of the locale packs, next to index.html. */
export const LOCALES_DIR = "locales";
/** Global object each pack script registers itself on: `self.ldmLocales[locale] = pack`. */
export const LOCALES_GLOBAL = "ldmLocales";
