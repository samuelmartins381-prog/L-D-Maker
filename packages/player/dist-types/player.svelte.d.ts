import type { Block, Screen, Section } from "@ldm/schema";
import { SvelteSet } from "svelte/reactivity";
import type { CompiledContent } from "./content.ts";
export interface ScreenRef {
  section: Section;
  sectionIndex: number;
  screen: Screen;
}
/** Player state: current locale and screen, visited screens, text lookup. */
export declare class Player {
  readonly content: CompiledContent;
  readonly screens: ScreenRef[];
  locale: string;
  index: number;
  readonly visited: SvelteSet<string>;
  readonly current: ScreenRef;
  readonly dir: "ltr" | "rtl";
  readonly percent: number;
  constructor(
    content: CompiledContent,
    requestedLocales: readonly (string | null | undefined)[],
  );
  /** Module text for a string key. A missing key shows the key itself (validation prevents this). */
  t: (key: string) => string;
  /** Player interface text, falling back to English then to the key. */
  ui: (key: string, params?: Record<string, string | number>) => string;
  goTo(index: number): void;
  get isFirst(): boolean;
  get isLast(): boolean;
}
export declare const PLAYER_KEY: unique symbol;
export declare const usePlayer: () => Player;
export type { Block };
