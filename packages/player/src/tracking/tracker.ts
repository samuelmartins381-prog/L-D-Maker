// What the player reports, whatever the standard. Adapters: scorm12, scorm2004 (LMS), standalone (browser storage).
import type { Score } from "../grading.ts";

export interface Progress {
  /** Every screen has been viewed. */
  allViewed: boolean;
  /** The module has scored questions. */
  assessed: boolean;
  score: Score;
  /** Share of screens viewed, 0–1 (SCORM 2004 progress_measure). */
  viewedRatio: number;
  /** Module rule: is passing required for the module to count as completed? */
  completion: "all-screens" | "all-screens-and-passed";
  screenIndex: number;
  /** Learner time in this session, in seconds. */
  sessionSeconds: number;
}

export interface Interaction {
  id: string;
  /** SCORM interaction type: an answer set ("choice") or an ordered answer ("sequencing"). */
  type: "choice" | "sequencing";
  /** Choice positions in the module (0-based): SCORM 1.2 only accepts single-character responses. */
  response: number[];
  correctResponse: number[];
  /** Choice ids, as SCORM 2004 accepts (more readable in LMS reports). */
  responseIds: string[];
  correctResponseIds: string[];
  correct: boolean;
  objectiveIds: string[];
  /** When the final answer was given. */
  at: Date;
}

export interface TrackerStart {
  suspend: string | null;
  /** Passing threshold set by the LMS, 0–100, overriding the module's own when present. */
  masteryScore: number | null;
  /** Learner's language preference held by the LMS (cmi.student_preference.language / cmi.learner_preference.language). */
  language: string | null;
}

export interface Tracker {
  readonly kind: "scorm12" | "scorm2004" | "standalone";
  start(): TrackerStart;
  save(suspend: string, progress: Progress): void;
  recordInteraction(interaction: Interaction): void;
  /** Ends the session. No call is allowed afterwards. */
  finish(suspend: string, progress: Progress): void;
}

export type LessonStatus = "incomplete" | "completed" | "passed" | "failed";

/**
 * SCORM 1.2 has a single status field. Without assessment: completed once every screen is viewed.
 * With assessment: passed/failed once every screen is viewed and every scored question is final.
 */
export function lessonStatus(p: Progress): LessonStatus {
  if (!p.allViewed) return "incomplete";
  if (!p.assessed) return "completed";
  if (!p.score.complete) return "incomplete";
  return p.score.passed ? "passed" : "failed";
}

/** SCORM 1.2 CMITimespan: HHHH:MM:SS.SS */
export function scorm12Timespan(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(4, "0")}:${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
}

/** SCORM 1.2 CMITime: HH:MM:SS */
export function scorm12Time(d: Date): string {
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}
