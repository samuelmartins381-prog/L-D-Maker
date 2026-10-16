import type { Module } from "@ldm/schema";
import { describe, expect, it } from "vitest";
import type { AnswerState } from "../grading.ts";
import { decodeSuspend, encodeSuspend, type ResumeState } from "./suspend.ts";

function moduleWith(
  screens: number,
  questionsPerScreen: number,
  choices = 4,
): Module {
  return {
    id: "m",
    version: "1.0.0",
    sections: [
      {
        screens: Array.from({ length: screens }, (_, s) => ({
          id: `s${s}`,
          blocks: Array.from({ length: questionsPerScreen }, (_, q) => ({
            id: `q${s}-${q}`,
            type: "question",
            choices: Array.from({ length: choices }, (_, c) => ({
              id: `c${c}`,
            })),
          })),
        })),
      },
    ],
  } as unknown as Module;
}

describe("suspend data", () => {
  const m = moduleWith(3, 1, 3);
  const state: ResumeState = {
    locale: "ar",
    index: 2,
    visited: ["s0", "s2"],
    answers: new Map([
      [
        "q0-0",
        {
          order: ["c2", "c0", "c1"],
          selected: ["c0"],
          attempts: 1,
          correct: false,
        },
      ],
      [
        "q1-0",
        { order: ["c0", "c1", "c2"], selected: [], attempts: 0, correct: null },
      ],
    ]),
  };

  it("round-trips the learner state", () => {
    const encoded = encodeSuspend(m, state);
    expect(encoded).toBe("2|m@1.0.0|ar|2|5|201.0.1.0,012..0.-,");
    expect(decodeSuspend(m, encoded)).toEqual(state);
  });

  it("ignores data from another module, version or format, and corrupted data", () => {
    const encoded = encodeSuspend(m, state);
    expect(decodeSuspend({ ...m, version: "1.0.1" }, encoded)).toBeNull();
    expect(decodeSuspend(m, encoded.replace(/^2/, "1"))).toBeNull();
    expect(decodeSuspend(m, "garbage")).toBeNull();
    expect(decodeSuspend(m, "")).toBeNull();
    expect(decodeSuspend(m, encoded.replace("|2|5|", "|9|5|"))).toBeNull();
    expect(decodeSuspend(m, encoded.replace("201.", "221."))).toBeNull();
  });

  it("stays under 3,500 characters for a large module (SCORM 1.2 limit: 4,096)", () => {
    const big = moduleWith(60, 2, 8); // 60 screens, 120 questions with 8 choices each
    const answers = new Map<string, AnswerState>(
      (big.sections[0]?.screens ?? []).flatMap((s) =>
        s.blocks.map(
          (b) =>
            [
              b.id,
              {
                order: ["c7", "c6", "c5", "c4", "c3", "c2", "c1", "c0"],
                selected: ["c1", "c3", "c5"],
                attempts: 3,
                correct: false,
              } as AnswerState,
            ] as const,
        ),
      ),
    );
    const visited = (big.sections[0]?.screens ?? []).map((s) => s.id);
    const encoded = encodeSuspend(big, {
      locale: "zh-Hant-TW",
      index: 59,
      visited,
      answers,
    });
    expect(encoded.length).toBeLessThan(3500);
    expect(decodeSuspend(big, encoded)?.answers.size).toBe(120);
  });
});
