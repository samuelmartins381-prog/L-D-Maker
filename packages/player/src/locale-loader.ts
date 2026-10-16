import { LOCALES_DIR, LOCALES_GLOBAL, type LocalePack } from "./content.ts";

type Registry = Record<string, LocalePack | undefined>;
const registry = (): Registry => {
  const g = globalThis as unknown as Record<string, Registry | undefined>;
  g[LOCALES_GLOBAL] ??= {};
  return g[LOCALES_GLOBAL];
};

/**
 * Loads `locales/<locale>.js` with a <script> element (fetch is blocked on file://). The pack
 * registers itself on a global object; the promise rejects if the file is missing or empty.
 */
export function loadLocalePack(locale: string): Promise<LocalePack> {
  const ready = registry()[locale];
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${LOCALES_DIR}/${encodeURIComponent(locale)}.js`;
    script.onload = () => {
      const pack = registry()[locale];
      if (pack) resolve(pack);
      else reject(new Error(`${script.src} did not register locale ${locale}`));
    };
    script.onerror = () => reject(new Error(`cannot load ${script.src}`));
    document.head.append(script);
  });
}
