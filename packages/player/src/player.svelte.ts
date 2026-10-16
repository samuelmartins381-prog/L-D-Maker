import type { Block, Question, Screen, Section } from "@ldm/schema";
import { getContext } from "svelte";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import type { CompiledContent, LocalePack } from "./content.ts";
import {
  type AnswerState,
  initialAnswer,
  moduleScore,
  submit,
  toggle,
} from "./grading.ts";
import { directionOf, interpolate, negotiateLocale } from "./locale.ts";
import type { ResumeState } from "./tracking/suspend.ts";

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
  /** Answers by question id, kept for the whole session (and later restored from the LMS). */
  readonly answers = new SvelteMap<string, AnswerState>();

  readonly current = $derived.by(() => this.screens[this.index] as ScreenRef);
  readonly dir = $derived(directionOf(this.locale));
  readonly percent = $derived.by(() =>
    Math.round((this.visited.size / this.screens.length) * 100),
  );

  /** Loads a locale that is not embedded (see locale-loader.ts; injectable for tests). */
  readonly #loadPack: (locale: string) => Promise<LocalePack>;
  /** Last locale asked for: when several loads overlap, only the latest request applies. */
  #wantedLocale = "";
  /** Settles once the latest locale request is applied (or has failed). */
  localeReady: Promise<void> = Promise.resolve();

  constructor(
    content: CompiledContent,
    requestedLocales: readonly (string | null | undefined)[],
    loadPack: (locale: string) => Promise<LocalePack> = () =>
      Promise.reject(new Error("no locale loader")),
  ) {
    this.#loadPack = loadPack;
    this.content = content;
    this.screens = content.module.sections.flatMap((section, sectionIndex) =>
      section.screens.map((screen) => ({ section, sectionIndex, screen })),
    );
    const { locales, defaultLocale } = content.module;
    this.passingScore = content.module.assessment.passingScore;
    this.locale = defaultLocale;
    this.setLocale(negotiateLocale(locales, defaultLocale, requestedLocales));
    // Every answer exists from the start (choice order fixed once), so rendering never writes state.
    for (const b of this.screens.flatMap((s) => s.screen.blocks)) {
      if (b.type === "question") this.answers.set(b.id, initialAnswer(b));
    }
    this.goTo(0);
  }

  /** Module text for a string key. A missing key shows the key itself (validation prevents this). */
  t = (key: string): string => this.content.strings[this.locale]?.[key] ?? key;

  /** Player interface text, falling back to English then to the key. */
  ui = (key: string, params?: Record<string, string | number>): string => {
    const template =
      this.content.ui[this.locale]?.[key] ?? this.content.ui.en?.[key] ?? key;
    return interpolate(template, params);
  };

  /**
   * Switches to a module locale, loading its pack first when it is not embedded. The screen keeps
   * the current locale while loading; a failed load is reported and changes nothing.
   */
  setLocale(locale: string): Promise<void> {
    if (!this.content.module.locales.includes(locale)) return this.localeReady;
    this.#wantedLocale = locale;
    const apply = () => {
      if (this.#wantedLocale === locale) this.locale = locale;
    };
    if (this.content.strings[locale]) {
      apply();
      this.localeReady = Promise.resolve();
    } else {
      this.localeReady = this.#loadPack(locale).then(
        (pack) => {
          this.content.strings[locale] = pack.strings;
          this.content.ui[locale] = pack.ui;
          apply();
        },
        (e: unknown) => {
          console.warn(`[ldm] locale ${locale} unavailable:`, e);
        },
      );
    }
    return this.localeReady;
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.screens.length) return;
    this.index = index;
    this.visited.add(this.current.screen.id);
  }

  /** Module threshold, unless the LMS imposes its own (SCORM mastery score). */
  passingScore = $state(0);
  /** Set once the learner ends the session with the Finish button. */
  finished = $state(false);
  readonly score = $derived.by(() =>
    moduleScore(this.content.module, this.answers, this.passingScore),
  );
  readonly allViewed = $derived.by(
    () => this.visited.size === this.screens.length,
  );

  restore(r: ResumeState): void {
    this.setLocale(r.locale);
    for (const id of r.visited) this.visited.add(id);
    for (const [id, a] of r.answers) this.answers.set(id, a);
    this.goTo(r.index);
  }

  snapshot(): ResumeState {
    return {
      locale: this.locale,
      index: this.index,
      visited: [...this.visited],
      answers: new Map(this.answers),
    };
  }

  answer(q: Question): AnswerState {
    return this.answers.get(q.id) ?? initialAnswer(q);
  }

  select(q: Question, choiceId: string): void {
    this.answers.set(q.id, toggle(q, this.answer(q), choiceId));
  }

  submit(q: Question): void {
    this.answers.set(q.id, submit(q, this.answer(q)));
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
