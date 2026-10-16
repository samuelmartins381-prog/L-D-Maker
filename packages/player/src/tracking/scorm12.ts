// SCORM 1.2 run-time adapter (content side). Spec: ADL SCORM 1.2 Run-Time Environment, §3.
import {
  type Interaction,
  lessonStatus,
  type Progress,
  scorm12Time,
  scorm12Timespan,
  type Tracker,
  type TrackerStart,
} from "./tracker.ts";

export interface Scorm12Api {
  LMSInitialize(arg: ""): string;
  LMSFinish(arg: ""): string;
  LMSGetValue(element: string): string;
  LMSSetValue(element: string, value: string): string;
  LMSCommit(arg: ""): string;
  LMSGetLastError(): string;
  LMSGetErrorString(code: string): string;
}

const MAX_SUSPEND = 4096;
const MAX_HOPS = 10;

function apiIn(win: Window): Scorm12Api | null {
  try {
    const api = (win as unknown as { API?: Scorm12Api }).API;
    return api && typeof api.LMSInitialize === "function" ? api : null;
  } catch {
    // Cross-origin frame (e.g. SAP SuccessFactors header, KBA 2808684): skip it and keep climbing.
    return null;
  }
}

/** Looks for window.API in this window, its parents, then the opener and its parents. */
export function findScorm12Api(start: Window = window): Scorm12Api | null {
  const climb = (from: Window | null): Scorm12Api | null => {
    let win = from;
    for (let hops = 0; win && hops <= MAX_HOPS; hops++) {
      const api = apiIn(win);
      if (api) return api;
      let parent: Window | null = null;
      try {
        parent = win.parent;
      } catch {
        parent = null;
      }
      if (!parent || parent === win) break;
      win = parent;
    }
    return null;
  };
  let opener: Window | null = null;
  try {
    opener = start.top?.opener ?? start.opener ?? null;
  } catch {
    opener = null;
  }
  return climb(start) ?? climb(opener);
}

const letter = (i: number) =>
  i < 26 ? String.fromCharCode(97 + i) : String(i - 26);

export class Scorm12Tracker implements Tracker {
  readonly kind = "scorm12";
  readonly #api: Scorm12Api;
  #interactionIndex = 0;
  #finished = false;

  constructor(api: Scorm12Api) {
    this.#api = api;
  }

  #set(element: string, value: string): void {
    if (this.#api.LMSSetValue(element, value) !== "true") {
      const code = this.#api.LMSGetLastError();
      console.warn(
        `[scorm12] LMSSetValue(${element}) failed: ${code} ${this.#api.LMSGetErrorString(code)}`,
      );
    }
  }

  start(): TrackerStart {
    this.#api.LMSInitialize("");
    if (this.#api.LMSGetValue("cmi.core.lesson_status") === "not attempted")
      this.#set("cmi.core.lesson_status", "incomplete");
    const count = Number.parseInt(
      this.#api.LMSGetValue("cmi.interactions._count"),
      10,
    );
    this.#interactionIndex = Number.isFinite(count) ? count : 0;
    const mastery = Number.parseFloat(
      this.#api.LMSGetValue("cmi.student_data.mastery_score"),
    );
    return {
      suspend: this.#api.LMSGetValue("cmi.suspend_data") || null,
      masteryScore: Number.isFinite(mastery) ? mastery : null,
      language:
        this.#api.LMSGetValue("cmi.student_preference.language") || null,
    };
  }

  #write(suspend: string, p: Progress): void {
    const status = lessonStatus(p);
    this.#set("cmi.core.lesson_status", status);
    this.#set("cmi.core.lesson_location", String(p.screenIndex));
    if (suspend.length <= MAX_SUSPEND) this.#set("cmi.suspend_data", suspend);
    else
      console.error(
        `[scorm12] suspend data too long (${suspend.length} > ${MAX_SUSPEND}), not saved`,
      );
    if (p.assessed && p.score.max > 0) {
      this.#set("cmi.core.score.min", "0");
      this.#set("cmi.core.score.max", "100");
      this.#set("cmi.core.score.raw", String(Math.round(p.score.scaled * 100)));
    }
    this.#set("cmi.core.session_time", scorm12Timespan(p.sessionSeconds));
    this.#set("cmi.core.exit", status === "incomplete" ? "suspend" : "");
  }

  save(suspend: string, progress: Progress): void {
    if (this.#finished) return;
    this.#write(suspend, progress);
    this.#api.LMSCommit("");
  }

  recordInteraction(i: Interaction): void {
    if (this.#finished) return;
    // Interactions are optional in SCORM 1.2: an LMS that rejects them must not break tracking.
    const n = this.#interactionIndex++;
    const base = `cmi.interactions.${n}`;
    this.#set(`${base}.id`, i.id);
    for (const [k, o] of i.objectiveIds.entries())
      this.#set(`${base}.objectives.${k}.id`, o);
    this.#set(`${base}.time`, scorm12Time(i.at));
    this.#set(`${base}.type`, "choice");
    this.#set(
      `${base}.correct_responses.0.pattern`,
      i.correctResponse.map(letter).join(","),
    );
    this.#set(`${base}.weighting`, "1");
    this.#set(`${base}.student_response`, i.response.map(letter).join(","));
    this.#set(`${base}.result`, i.correct ? "correct" : "wrong");
  }

  finish(suspend: string, progress: Progress): void {
    if (this.#finished) return;
    this.#write(suspend, progress);
    this.#api.LMSCommit("");
    this.#api.LMSFinish("");
    this.#finished = true;
  }
}
