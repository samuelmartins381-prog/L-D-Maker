// Standalone HTML5 (no LMS): progress kept in the learner's browser so they can resume.
import type { Tracker, TrackerStart } from "./tracker.ts";

export class StandaloneTracker implements Tracker {
  readonly kind = "standalone";
  readonly #key: string;

  constructor(moduleKey: string) {
    this.#key = `ldm:${moduleKey}`;
  }

  start(): TrackerStart {
    try {
      return {
        suspend: localStorage.getItem(this.#key),
        masteryScore: null,
        language: null,
      };
    } catch {
      return { suspend: null, masteryScore: null, language: null }; // storage blocked (private mode, policy)
    }
  }

  save(suspend: string): void {
    try {
      localStorage.setItem(this.#key, suspend);
    } catch {
      // Storage unavailable: the module still works, only resume is lost.
    }
  }

  recordInteraction(): void {}

  finish(suspend: string): void {
    this.save(suspend);
  }
}
