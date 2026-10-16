import { describe, expect, it } from "vitest";
import type { Score } from "../grading.ts";
import {
  completionStatus,
  findScorm2004Api,
  isoDuration,
  isoTimestamp,
  type Scorm2004Api,
  Scorm2004Tracker,
  successStatus,
} from "./scorm2004.ts";
import type { Progress } from "./tracker.ts";

function mockApi(initial: Record<string, string> = {}) {
  const data: Record<string, string> = {
    "cmi.completion_status": "unknown",
    "cmi.interactions._count": "0",
    ...initial,
  };
  const calls: string[] = [];
  const api: Scorm2004Api = {
    Initialize: () => {
      calls.push("Initialize");
      return "true";
    },
    Terminate: () => {
      calls.push("Terminate");
      return "true";
    },
    GetValue: (k) => data[k] ?? "",
    SetValue: (k, v) => {
      data[k] = v;
      return "true";
    },
    Commit: () => {
      calls.push("Commit");
      return "true";
    },
    GetLastError: () => "0",
    GetErrorString: () => "",
    GetDiagnostic: () => "",
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

describe("SCORM 2004 status", () => {
  it("separates completion from success", () => {
    expect(completionStatus(progress())).toBe("incomplete");
    expect(completionStatus(progress({ allViewed: true }))).toBe("completed");
    expect(successStatus(progress({ allViewed: true }))).toBe("unknown");
    const failed = progress({
      allViewed: true,
      assessed: true,
      score: score({ passed: false }),
    });
    expect(completionStatus(failed)).toBe("completed");
    expect(successStatus(failed)).toBe("failed");
    expect(
      successStatus(
        progress({ assessed: true, score: score({ complete: false }) }),
      ),
    ).toBe("unknown");
  });

  it("requires passing for completion when the module says so", () => {
    const failed = progress({
      allViewed: true,
      assessed: true,
      completion: "all-screens-and-passed",
      score: score({ passed: false }),
    });
    expect(completionStatus(failed)).toBe("incomplete");
    expect(
      completionStatus({ ...failed, score: score({ passed: true }) }),
    ).toBe("completed");
  });

  it("formats durations and timestamps in ISO 8601", () => {
    expect(isoDuration(3725.5)).toBe("PT1H2M5.5S");
    expect(isoDuration(0)).toBe("PT0S");
    expect(isoTimestamp(new Date(Date.UTC(2026, 0, 1, 9, 5, 7, 450)))).toBe(
      "2026-01-01T09:05:07.45Z",
    );
  });
});

describe("Scorm2004Tracker", () => {
  it("initializes, marks the attempt incomplete and reads resume data, passing score and language", () => {
    const { api, data, calls } = mockApi({
      "cmi.suspend_data": "2|x",
      "cmi.scaled_passing_score": "0.8",
      "cmi.learner_preference.language": "ja",
    });
    expect(new Scorm2004Tracker(api).start()).toEqual({
      suspend: "2|x",
      masteryScore: 80,
      language: "ja",
    });
    expect(data["cmi.completion_status"]).toBe("incomplete");
    expect(calls).toEqual(["Initialize"]);
  });

  it("keeps a completed status on resume", () => {
    const { api, data } = mockApi({ "cmi.completion_status": "completed" });
    new Scorm2004Tracker(api).start();
    expect(data["cmi.completion_status"]).toBe("completed");
  });

  it("saves completion, success, scaled score, progress, location, time and exit, then commits", () => {
    const { api, data, calls } = mockApi();
    const t = new Scorm2004Tracker(api);
    t.start();
    t.save(
      "S",
      progress({
        assessed: true,
        viewedRatio: 0.5,
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
      "cmi.completion_status": "incomplete",
      "cmi.success_status": "unknown",
      "cmi.progress_measure": "0.50",
      "cmi.location": "3",
      "cmi.suspend_data": "S",
      "cmi.score.scaled": "0.8333",
      "cmi.score.raw": "83",
      "cmi.session_time": "PT1M1S",
      "cmi.exit": "suspend",
    });
    expect(calls.at(-1)).toBe("Commit");
  });

  it("closes the attempt normally when completed, then terminates and ignores later calls", () => {
    const { api, data, calls } = mockApi();
    const t = new Scorm2004Tracker(api);
    t.start();
    t.finish("S", progress({ allViewed: true, viewedRatio: 1 }));
    expect(data["cmi.completion_status"]).toBe("completed");
    expect(data["cmi.exit"]).toBe("normal");
    expect(calls.slice(-2)).toEqual(["Commit", "Terminate"]);
    t.save("T", progress());
    expect(data["cmi.suspend_data"]).toBe("S");
  });

  it("records choice interactions with ids and the [,] delimiter", () => {
    const { api, data } = mockApi({ "cmi.interactions._count": "1" });
    const t = new Scorm2004Tracker(api);
    t.start();
    t.recordInteraction({
      id: "q-signals",
      type: "choice",
      response: [0, 2],
      correctResponse: [0, 1],
      responseIds: ["a", "c"],
      correctResponseIds: ["a", "b"],
      correct: false,
      objectiveIds: ["obj-signs"],
      at: new Date(Date.UTC(2026, 0, 1, 9, 5, 7)),
    });
    expect(data).toMatchObject({
      "cmi.interactions.1.id": "q-signals",
      "cmi.interactions.1.type": "choice",
      "cmi.interactions.1.learner_response": "a[,]c",
      "cmi.interactions.1.correct_responses.0.pattern": "a[,]b",
      "cmi.interactions.1.result": "incorrect",
      "cmi.interactions.1.timestamp": "2026-01-01T09:05:07.00Z",
      "cmi.interactions.1.objectives.0.id": "obj-signs",
    });
  });

  it("records a sequence in the learner's order", () => {
    const { api, data } = mockApi();
    const t = new Scorm2004Tracker(api);
    t.start();
    t.recordInteraction({
      id: "q-steps",
      type: "sequencing",
      response: [2, 0, 1],
      correctResponse: [0, 1, 2],
      responseIds: ["stop", "report", "change"],
      correctResponseIds: ["report", "change", "stop"],
      correct: false,
      objectiveIds: [],
      at: new Date(Date.UTC(2026, 0, 1, 9, 5, 7)),
    });
    expect(data).toMatchObject({
      "cmi.interactions.0.type": "sequencing",
      "cmi.interactions.0.learner_response": "stop[,]report[,]change",
      "cmi.interactions.0.correct_responses.0.pattern":
        "report[,]change[,]stop",
    });
  });

  it("finds API_1484_11 through the opener (LMS that open the SCO in a popup)", () => {
    const { api } = mockApi();
    const lms = { API_1484_11: api } as unknown as Window;
    Object.assign(lms, { parent: lms, top: lms, opener: null });
    const popup = {} as Window;
    Object.assign(popup, { parent: popup, top: popup, opener: lms });
    expect(findScorm2004Api(popup)).toBe(api);
  });
});
