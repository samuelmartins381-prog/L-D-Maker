import type { Module, StringCatalog } from "@ldm/schema";
/**
 * What the builder embeds in index.html (<script type="application/json" id="ldm-content">):
 * a validated module plus the string catalogs it needs. The player never reads raw YAML.
 */
export interface CompiledContent {
  format: 1;
  module: Module;
  /** Module strings, keyed by locale. */
  strings: Record<string, StringCatalog>;
  /** Player interface strings (buttons, labels), keyed by locale. */
  ui: Record<string, StringCatalog>;
}
export declare const CONTENT_ELEMENT_ID = "ldm-content";
