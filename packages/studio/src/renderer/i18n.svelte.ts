// Interface texts of the Studio: one flat catalogue per language, same keys everywhere (tested).
import type { StudioLocale } from "../shared/api.ts";
import en from "./ui/en.json";
import fr from "./ui/fr.json";

export type Key = keyof typeof fr;
const catalogs: Record<StudioLocale, Record<Key, string>> = { fr, en };

const state = $state<{ locale: StudioLocale }>({ locale: "fr" });

export function setLocale(locale: StudioLocale): void {
  state.locale = locale;
  document.documentElement.lang = locale;
}

export function locale(): StudioLocale {
  return state.locale;
}

export function t(
  key: Key,
  params: Record<string, string | number> = {},
): string {
  const nf = new Intl.NumberFormat(state.locale);
  return catalogs[state.locale][key].replace(
    /\{(\w+)\}/g,
    (m, name: string) => {
      const v = params[name];
      return v === undefined ? m : typeof v === "number" ? nf.format(v) : v;
    },
  );
}

/** Keys built from data (profiles, locales…): checked against the catalogue at run time. */
export function tk(
  key: string,
  params?: Record<string, string | number>,
): string {
  return key in catalogs[state.locale] ? t(key as Key, params) : key;
}

export function hasKey(key: string): boolean {
  return key in catalogs[state.locale];
}
