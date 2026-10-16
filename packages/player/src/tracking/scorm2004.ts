// SCORM 2004 4th Edition run-time adapter (content side).
// Spec: ADL SCORM 2004 4th Edition Run-Time Environment (RTE) §3 (API) and §4 (data model).
import { findApi } from "./find-api.ts";
import type {
  Interaction,
  Progress,
  Tracker,
  TrackerStart,
} from "./tracker.ts";

export interface Scorm2004Api {
  Initialize(arg: ""): string;
  Terminate(arg: ""): string;
  GetValue(element: string): string;
  SetValue(element: string, value: string): string;
  Commit(arg: ""): string;
  GetLastError(): string;
  GetErrorString(code: string): string;
  GetDiagnostic(code: string): string;
}

/** SPM of cmi.suspend_data in 4th Edition. */
const MAX_SUSPEND = 64000;
/** Delimiter between choice ids in learner_response and correct_responses patterns (RTE §4.2.9). */
const LIST = "[,]";

const isScorm2004Api = (x: unknown): x is Scorm2004Api =>
  !!x && typeof (x as Scorm2004Api).Initialize === "function";

export const findScorm2004Api = (start: Window = window): Scorm2004Api | null =>
  findApi("API_1484_11", isScorm2004Api, start);

/** Completion: every screen viewed (and passed, when the module says completion requires it). */
export function completionStatus(p: Progress): "completed" | "incomplete" {
  if (!p.allViewed) return "incomplete";
  if (
    p.completion === "all-screens-and-passed" &&
    p.assessed &&
    !p.score.passed
  )
    return "incomplete";
  return "completed";
}

/** Success is independent of completion in SCORM 2004: unknown until every scored question is final. */
export function successStatus(p: Progress): "passed" | "failed" | "unknown" {
  if (!p.assessed || !p.score.complete) return "unknown";
  return p.score.passed ? "passed" : "failed";
}

/** timeinterval (second,10,2): ISO 8601 duration, e.g. PT1H2M5.5S */
export function isoDuration(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round((s % 60) * 100) / 100;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${sec}S`;
}

/**
 * time (second,10,0): YYYY[-MM[-DD[Thh[:mm[:ss[.s[TZD]]]]]]] (RTE §4.2). The time zone designator is
 * only allowed after the fraction of a second, so "…T09:05:07Z" is invalid: we send "…T09:05:07.45Z".
 */
export function isoTimestamp(d: Date): string {
  return `${d.toISOString().slice(0, 22)}Z`;
}

export class Scorm2004Tracker implements Tracker {
  readonly kind = "scorm2004";
  readonly #api: Scorm2004Api;
  #interactionIndex = 0;
  #finished = false;

  constructor(api: Scorm2004Api) {
    this.#api = api;
  }

  #set(element: string, value: string): void {
    if (this.#api.SetValue(element, value) !== "true") {
      const code = this.#api.GetLastError();
      console.warn(
        `[scorm2004] SetValue(${element}) failed: ${code} ${this.#api.GetErrorString(code)}`,
      );
    }
  }

  start(): TrackerStart {
    this.#api.Initialize("");
    if (this.#api.GetValue("cmi.completion_status") !== "completed")
      this.#set("cmi.completion_status", "incomplete");
    const count = Number.parseInt(
      this.#api.GetValue("cmi.interactions._count"),
      10,
    );
    this.#interactionIndex = Number.isFinite(count) ? count : 0;
    // cmi.scaled_passing_score comes from the manifest (imsss:minNormalizedMeasure) or the LMS, in [-1, 1].
    const passing = Number.parseFloat(
      this.#api.GetValue("cmi.scaled_passing_score"),
    );
    return {
      suspend: this.#api.GetValue("cmi.suspend_data") || null,
      masteryScore: Number.isFinite(passing) ? Math.round(passing * 100) : null,
      language: this.#api.GetValue("cmi.learner_preference.language") || null,
    };
  }

  #write(suspend: string, p: Progress): void {
    const completion = completionStatus(p);
    this.#set("cmi.completion_status", completion);
    this.#set("cmi.success_status", successStatus(p));
    this.#set("cmi.progress_measure", p.viewedRatio.toFixed(2));
    this.#set("cmi.location", String(p.screenIndex));
    if (suspend.length <= MAX_SUSPEND) this.#set("cmi.suspend_data", suspend);
    else
      console.error(
        `[scorm2004] suspend data too long (${suspend.length} > ${MAX_SUSPEND}), not saved`,
      );
    if (p.assessed && p.score.max > 0) {
      this.#set("cmi.score.scaled", p.score.scaled.toFixed(4));
      this.#set("cmi.score.raw", String(Math.round(p.score.scaled * 100)));
      this.#set("cmi.score.min", "0");
      this.#set("cmi.score.max", "100");
    }
    this.#set("cmi.session_time", isoDuration(p.sessionSeconds));
    // "suspend" keeps the attempt open so the LMS offers to resume; "normal" closes it.
    this.#set("cmi.exit", completion === "completed" ? "normal" : "suspend");
  }

  save(suspend: string, progress: Progress): void {
    if (this.#finished) return;
    this.#write(suspend, progress);
    this.#api.Commit("");
  }

  recordInteraction(i: Interaction): void {
    if (this.#finished) return;
    const base = `cmi.interactions.${this.#interactionIndex++}`;
    this.#set(`${base}.id`, i.id);
    this.#set(`${base}.type`, i.type);
    for (const [k, o] of i.objectiveIds.entries())
      this.#set(`${base}.objectives.${k}.id`, o);
    this.#set(`${base}.timestamp`, isoTimestamp(i.at));
    this.#set(
      `${base}.correct_responses.0.pattern`,
      i.correctResponseIds.join(LIST),
    );
    this.#set(`${base}.weighting`, "1");
    this.#set(`${base}.learner_response`, i.responseIds.join(LIST));
    this.#set(`${base}.result`, i.correct ? "correct" : "incorrect");
  }

  finish(suspend: string, progress: Progress): void {
    if (this.#finished) return;
    this.#write(suspend, progress);
    this.#api.Commit("");
    this.#api.Terminate("");
    this.#finished = true;
  }
}
