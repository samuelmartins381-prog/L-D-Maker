import { getContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { directionOf, interpolate, negotiateLocale } from "./locale.js";
/** Player state: current locale and screen, visited screens, text lookup. */
export class Player {
  content;
  screens;
  locale = $state("");
  index = $state(0);
  visited = new SvelteSet();
  current = $derived.by(() => this.screens[this.index]);
  dir = $derived(directionOf(this.locale));
  percent = $derived.by(() =>
    Math.round((this.visited.size / this.screens.length) * 100),
  );
  constructor(content, requestedLocales) {
    this.content = content;
    this.screens = content.module.sections.flatMap((section, sectionIndex) =>
      section.screens.map((screen) => ({ section, sectionIndex, screen })),
    );
    const { locales, defaultLocale } = content.module;
    this.locale = negotiateLocale(locales, defaultLocale, requestedLocales);
    this.goTo(0);
  }
  /** Module text for a string key. A missing key shows the key itself (validation prevents this). */
  t = (key) => this.content.strings[this.locale]?.[key] ?? key;
  /** Player interface text, falling back to English then to the key. */
  ui = (key, params) => {
    const lang = this.locale.split("-")[0] ?? "";
    const template =
      this.content.ui[this.locale]?.[key] ??
      this.content.ui[lang]?.[key] ??
      this.content.ui.en?.[key] ??
      key;
    return interpolate(template, params);
  };
  goTo(index) {
    if (index < 0 || index >= this.screens.length) return;
    this.index = index;
    this.visited.add(this.current.screen.id);
  }
  get isFirst() {
    return this.index === 0;
  }
  get isLast() {
    return this.index === this.screens.length - 1;
  }
}
export const PLAYER_KEY = Symbol("player");
export const usePlayer = () => getContext(PLAYER_KEY);
