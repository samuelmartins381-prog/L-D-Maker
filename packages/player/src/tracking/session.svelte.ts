// Connects the player to a tracker: resume on start, save on every change, record final answers
// as interactions, close the session on Finish or when the page goes away.
import type { Question } from "@ldm/schema";
import { getContext } from "svelte";
import { isFinal } from "../grading.ts";
import type { Player } from "../player.svelte.ts";
import { decodeSuspend, encodeSuspend } from "./suspend.ts";
import type { Progress, Tracker } from "./tracker.ts";

export class Session {
  readonly #player: Player;
  readonly #tracker: Tracker;
  readonly #startedAt = Date.now();
  readonly #recorded = new Set<string>();
  readonly #questions: Question[];

  constructor(player: Player, tracker: Tracker) {
    this.#player = player;
    this.#tracker = tracker;
    const m = player.content.module;
    this.#questions = player.screens
      .flatMap((s) => s.screen.blocks)
      .filter((b): b is Question => b.type === "question");

    const start = tracker.start();
    if (start.masteryScore !== null) player.passingScore = start.masteryScore;
    const resume = decodeSuspend(m, start.suspend);
    if (resume) player.restore(resume);
    // Answers already final when resuming were recorded in a previous session.
    for (const q of this.#questions)
      if (isFinal(q, player.answer(q))) this.#recorded.add(q.id);

    $effect.root(() => {
      $effect(() => {
        const progress = this.progress();
        const suspend = encodeSuspend(m, player.snapshot());
        this.#recordNewAnswers();
        if (!player.finished) tracker.save(suspend, progress);
      });
    });

    addEventListener("pagehide", () => this.finish());
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && !player.finished)
        tracker.save(this.#suspend(), this.progress());
    });
  }

  get kind(): Tracker["kind"] {
    return this.#tracker.kind;
  }

  progress(): Progress {
    const p = this.#player;
    return {
      allViewed: p.allViewed,
      assessed: p.score.max > 0,
      score: p.score,
      screenIndex: p.index,
      sessionSeconds: (Date.now() - this.#startedAt) / 1000,
    };
  }

  #suspend(): string {
    return encodeSuspend(this.#player.content.module, this.#player.snapshot());
  }

  #recordNewAnswers(): void {
    for (const q of this.#questions) {
      const a = this.#player.answer(q);
      if (this.#recorded.has(q.id) || !isFinal(q, a)) continue;
      this.#recorded.add(q.id);
      const pos = (id: string) => q.choices.findIndex((c) => c.id === id);
      this.#tracker.recordInteraction({
        id: q.id,
        response: a.selected.map(pos).sort((x, y) => x - y),
        correctResponse: q.choices.flatMap((c, i) => (c.correct ? [i] : [])),
        correct: a.correct === true,
        objectiveIds: q.objectives,
        at: new Date(),
      });
    }
  }

  /** Ends the session (Finish button or page closing). Safe to call more than once. */
  finish(): void {
    if (this.#player.finished) return;
    this.#tracker.finish(this.#suspend(), this.progress());
    this.#player.finished = true;
  }
}

export const SESSION_KEY = Symbol("session");
export const useSession = (): Session => getContext<Session>(SESSION_KEY);
