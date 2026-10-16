import type { Block, Screen, Section } from "@ldm/schema";
import { getContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import type { CompiledContent } from "./content.ts";
import { directionOf, interpolate, negotiateLocale } from "./locale.ts";

export interface ScreenRef {
  section: Section;
  sectionIndex: number;
  screen: Screen;
}

/** Player state: current locale and screen, visited screens, text lookup. */
export class Player {
  readonly content: CompiledContent;
  readonly screens: ScreenRef[];
  locale = $state("");
  index = $state(0);
  readonly visited = new SvelteSet<string>();

  readonly current = $derived.by(() => this.screens[this.index] as ScreenRef);
  readonly dir = $derived(directionOf(this.locale));
  readonly percent = $derived.by(() =>
    Math.round((this.visited.size / this.screens.length) * 100),
  );

  constructor(
    content: CompiledContent,
    requestedLocales: readonly (string | null | undefined)[],
  ) {
    this.content = content;
    this.screens = content.module.sections.flatMap((section, sectionIndex) =>
      section.screens.map((screen) => ({ section, sectionIndex, screen })),
    );
    const { locales, defaultLocale } = content.module;
    this.locale = negotiateLocale(locales, defaultLocale, requestedLocales);
    this.goTo(0);
  }

  /** Module text for a string key. A missing key shows the key itself (validation prevents this). */
  t = (key: string): string => this.content.strings[this.locale]?.[key] ?? key;

  /** Player interface text, falling back to English then to the key. */
  ui = (key: string, params?: Record<string, string | number>): string => {
    const lang = this.locale.split("-")[0] ?? "";
    const template =
      this.content.ui[this.locale]?.[key] ??
      this.content.ui[lang]?.[key] ??
      this.content.ui.en?.[key] ??
      key;
    return interpolate(template, params);
  };

  goTo(index: number): void {
    if (index < 0 || index >= this.screens.length) return;
    this.index = index;
    this.visited.add(this.current.screen.id);
  }

  get isFirst(): boolean {
    return this.index === 0;
  }

  get isLast(): boolean {
    return this.index === this.screens.length - 1;
  }
}

export const PLAYER_KEY = Symbol("player");
export const usePlayer = (): Player => getContext<Player>(PLAYER_KEY);

export type { Block };
