import { describe, expect, it } from "vitest";
import type { Score } from "../grading.ts";
import { findScorm12Api, type Scorm12Api, Scorm12Tracker } from "./scorm12.ts";
import { lessonStatus, type Progress, scorm12Timespan } from "./tracker.ts";

function mockApi(initial: Record<string, string> = {}) {
  const data: Record<string, string> = {
    "cmi.core.lesson_status": "not attempted",
    "cmi.interactions._count": "0",
    ...initial,
  };
  const calls: string[] = [];
  const api: Scorm12Api = {
    LMSInitialize: () => {
      calls.push("init");
      return "true";
    },
    LMSFinish: () => {
      calls.push("finish");
      return "true";
    },
    LMSGetValue: (k) => data[k] ?? "",
    LMSSetValue: (k, v) => {
      data[k] = v;
      return "true";
    },
    LMSCommit: () => {
      calls.push("commit");
      return "true";
    },
    LMSGetLastError: () => "0",
    LMSGetErrorString: () => "",
  };
  return { api, data, calls };
}

const score = (s: Partial<Score> = {}): Score => ({
  raw: 0,
  max: 0,
  scaled: 1,
  complete: true,
  passed: true,
  ...s,
});
const progress = (p: Partial<Progress> = {}): Progress => ({
  allViewed: false,
  assessed: false,
  score: score(),
  viewedRatio: 0,
  completion: "all-screens",
  screenIndex: 0,
  sessionSeconds: 0,
  ...p,
});

describe("lessonStatus", () => {
  it("maps progress to the single SCORM 1.2 status", () => {
    expect(lessonStatus(progress())).toBe("incomplete");
    expect(lessonStatus(progress({ allViewed: true }))).toBe("completed");
    expect(
      lessonStatus(
        progress({
          allViewed: true,
          assessed: true,
          score: score({ complete: false }),
        }),
      ),
    ).toBe("incomplete");
    expect(
      lessonStatus(
        progress({
          allViewed: true,
          assessed: true,
          score: score({ passed: true }),
        }),
      ),
    ).toBe("passed");
    expect(
      lessonStatus(
        progress({
          allViewed: true,
          assessed: true,
          score: score({ passed: false }),
        }),
      ),
    ).toBe("failed");
  });

  it("formats session time as CMITimespan", () => {
    expect(scorm12Timespan(3725.5)).toBe("0001:02:05.50");
  });
});

describe("Scorm12Tracker", () => {
  it("initializes, marks the attempt incomplete and returns resume data and mastery score", () => {
    const { api, data } = mockApi({
      "cmi.suspend_data": "2|x",
      "cmi.student_data.mastery_score": "70",
      "cmi.student_preference.language": "ar",
    });
    const start = new Scorm12Tracker(api).start();
    expect(start).toEqual({ suspend: "2|x", masteryScore: 70, language: "ar" });
    expect(data["cmi.core.lesson_status"]).toBe("incomplete");
  });

  it("saves status, location, score, time and exit, then commits", () => {
    const { api, data, calls } = mockApi();
    const t = new Scorm12Tracker(api);
    t.start();
    t.save(
      "S",
      progress({
        assessed: true,
        screenIndex: 3,
        sessionSeconds: 61,
        score: score({
          max: 6,
          raw: 5,
          scaled: 5 / 6,
          complete: false,
          passed: false,
        }),
      }),
    );
    expect(data).toMatchObject({
      "cmi.core.lesson_status": "incomplete",
      "cmi.core.lesson_location": "3",
      "cmi.suspend_data": "S",
      "cmi.core.score.raw": "83",
      "cmi.core.score.max": "100",
      "cmi.core.session_time": "0000:01:01.00",
      "cmi.core.exit": "suspend",
    });
    expect(calls.at(-1)).toBe("commit");
  });

  it("clears exit when done and refuses calls after finish", () => {
    const { api, data, calls } = mockApi();
    const t = new Scorm12Tracker(api);
    t.start();
    t.finish("S", progress({ allViewed: true }));
    expect(data["cmi.core.lesson_status"]).toBe("completed");
    expect(data["cmi.core.exit"]).toBe("");
    expect(calls.slice(-2)).toEqual(["commit", "finish"]);
    t.save("T", progress());
    expect(data["cmi.suspend_data"]).toBe("S");
  });

  it("never sends suspend data over 4,096 characters", () => {
    const { api, data } = mockApi();
    const t = new Scorm12Tracker(api);
    t.start();
    const original = console.error;
    console.error = () => {};
    t.save("x".repeat(5000), progress());
    console.error = original;
    expect(data["cmi.suspend_data"]).toBeUndefined();
  });

  it("records choice interactions after the existing ones", () => {
    const { api, data } = mockApi({ "cmi.interactions._count": "2" });
    const t = new Scorm12Tracker(api);
    t.start();
    t.recordInteraction({
      id: "q-signals",
      type: "choice",
      response: [0, 2],
      correctResponse: [0, 1],
      correct: false,
      responseIds: ["a", "c"],
      correctResponseIds: ["a", "b"],
      objectiveIds: ["obj-signs"],
      at: new Date(2026, 0, 1, 9, 5, 7),
    });
    expect(data).toMatchObject({
      "cmi.interactions.2.id": "q-signals",
      "cmi.interactions.2.type": "choice",
      "cmi.interactions.2.student_response": "a,c",
      "cmi.interactions.2.correct_responses.0.pattern": "a,b",
      "cmi.interactions.2.result": "wrong",
      "cmi.interactions.2.time": "09:05:07",
      "cmi.interactions.2.objectives.0.id": "obj-signs",
    });
  });

  it("records a sequence in the learner's order", () => {
    const { api, data } = mockApi();
    const t = new Scorm12Tracker(api);
    t.start();
    t.recordInteraction({
      id: "q-steps",
      type: "sequencing",
      response: [2, 0, 1],
      correctResponse: [0, 1, 2],
      responseIds: ["c", "a", "b"],
      correctResponseIds: ["a", "b", "c"],
      correct: false,
      objectiveIds: [],
      at: new Date(2026, 0, 1, 9, 5, 7),
    });
    expect(data).toMatchObject({
      "cmi.interactions.0.type": "sequencing",
      "cmi.interactions.0.student_response": "c,a,b",
      "cmi.interactions.0.correct_responses.0.pattern": "a,b,c",
    });
  });
});

describe("findScorm12Api", () => {
  it("climbs parents and skips cross-origin frames", () => {
    const { api } = mockApi();
    const top = { API: api } as unknown as Window;
    Object.assign(top, { parent: top, opener: null, top });
    const crossOrigin = {} as Window;
    Object.defineProperty(crossOrigin, "API", {
      get: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    Object.assign(crossOrigin, { parent: top });
    const content = {
      parent: crossOrigin,
      top,
      opener: null,
    } as unknown as Window;
    expect(findScorm12Api(content)).toBe(api);
  });

  it("returns null outside an LMS", () => {
    const alone = {} as Window;
    Object.assign(alone, { parent: alone, top: alone, opener: null });
    expect(findScorm12Api(alone)).toBeNull();
  });
});
