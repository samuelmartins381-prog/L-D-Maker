import type { Module, Question } from "@ldm/schema";
import { describe, expect, it } from "vitest";
import {
  attemptsLeft,
  initialAnswer,
  isFinal,
  moduleScore,
  shuffled,
  submit,
  toggle,
} from "./grading.ts";

const choice = (id: string, correct: boolean) => ({
  id,
  text: `t.${id}`,
  correct,
  feedback: `f.${id}`,
});
const single: Question = {
  id: "q1",
  type: "question",
  variant: "single",
  prompt: "p",
  choices: [choice("a", false), choice("b", true), choice("c", false)],
  objectives: ["o"],
  scored: true,
  attempts: 1,
  shuffle: false,
};
const multiple: Question = {
  ...single,
  id: "q2",
  variant: "multiple",
  attempts: 2,
  choices: [choice("a", true), choice("b", true), choice("c", false)],
};

describe("question grading", () => {
  it("hotspot questions are graded like single choice (one marker at a time)", () => {
    const hotspot: Question = { ...single, id: "q3", variant: "hotspot" };
    let s = initialAnswer(hotspot);
    s = toggle(hotspot, s, "a");
    s = toggle(hotspot, s, "b");
    expect(s.selected).toEqual(["b"]);
    expect(submit(hotspot, s).correct).toBe(true);
  });

  it("single choice replaces the selection", () => {
    let s = initialAnswer(single);
    s = toggle(single, s, "a");
    s = toggle(single, s, "b");
    expect(s.selected).toEqual(["b"]);
    expect(submit(single, s)).toMatchObject({ correct: true, attempts: 1 });
  });

  it("multiple choice is all-or-nothing", () => {
    let s = toggle(multiple, initialAnswer(multiple), "a");
    s = submit(multiple, s);
    expect(s.correct).toBe(false);
    expect(isFinal(multiple, s)).toBe(false);
    expect(attemptsLeft(multiple, s)).toBe(1);
    s = submit(multiple, toggle(multiple, s, "b"));
    expect(s).toMatchObject({ correct: true, attempts: 2 });
    expect(isFinal(multiple, s)).toBe(true);
  });

  it("locks the answer once final", () => {
    const s = submit(single, toggle(single, initialAnswer(single), "a"));
    expect(isFinal(single, s)).toBe(true);
    expect(toggle(single, s, "b")).toBe(s);
    expect(submit(single, s)).toBe(s);
  });

  it("does not submit an empty selection or the same selection twice", () => {
    const empty = initialAnswer(multiple);
    expect(submit(multiple, empty)).toBe(empty);
    const once = submit(multiple, toggle(multiple, empty, "a"));
    expect(submit(multiple, once)).toBe(once);
  });

  it("shuffles deterministically with a given rng and keeps every item", () => {
    const rng = () => 0;
    expect(shuffled(["a", "b", "c"], rng)).toEqual(["b", "c", "a"]);
    expect(
      initialAnswer({ ...single, shuffle: true }, rng).order.sort(),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("moduleScore", () => {
  const module = {
    assessment: { passingScore: 50, completion: "all-screens" },
    sections: [
      {
        screens: [
          {
            blocks: [
              single,
              multiple,
              { ...single, id: "practice", scored: false },
            ],
          },
        ],
      },
    ],
  } as unknown as Module;

  it("counts only final scored answers and applies the passing score", () => {
    const answers = new Map([
      [single.id, submit(single, toggle(single, initialAnswer(single), "b"))],
    ]);
    expect(moduleScore(module, answers)).toMatchObject({
      raw: 1,
      max: 2,
      complete: false,
      passed: false,
    });
    const wrong = submit(
      multiple,
      toggle(multiple, initialAnswer(multiple), "c"),
    );
    answers.set(multiple.id, submit(multiple, toggle(multiple, wrong, "a")));
    expect(moduleScore(module, answers)).toMatchObject({
      raw: 1,
      max: 2,
      scaled: 0.5,
      complete: true,
      passed: true,
    });
  });
});
