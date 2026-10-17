import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Module } from "@ldm/schema";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { conformToStoryboard } from "./conform.ts";
import type { IngestIndex } from "./ingest.ts";
import { saveProject } from "./project.ts";
import {
  assertApproved,
  checkStoryboard,
  GateError,
  loadStoryboard,
  type Storyboard,
} from "./storyboard.ts";

const ingest: IngestIndex = {
  words: 100,
  readingMinutes: 1,
  sources: [
    {
      file: "g.pdf",
      kind: "pdf",
      hash: "x",
      markdown: "g.pdf.md",
      words: 100,
      media: [],
      anchors: [
        { id: "g.pdf#h-a", label: "A" },
        { id: "g.pdf#h-b", label: "B" },
      ],
    },
  ],
};
const project = { id: "demo", durationMinutes: 10 };

const q = (id: string, scored = true) => ({
  id,
  type: "question" as const,
  variant: "single" as const,
  scored,
  intent: "Vérifier",
  content: "Question",
  objectives: ["o1"],
  sourceRefs: ["g.pdf#h-a"],
  choices: [
    { text: "Bonne", correct: true },
    { text: "Piège", correct: false, misconception: "Idée reçue" },
  ],
});

/** A storyboard that passes every check. */
function valid(): Storyboard {
  return {
    schemaVersion: "0.1",
    module: {
      id: "demo",
      title: "Démo",
      audience: "Conseillers",
      durationMinutes: 10,
      defaultLocale: "fr",
    },
    objectives: [
      {
        id: "o1",
        bloom: "understand",
        text: "Comprendre",
        sourceRefs: ["g.pdf#h-a"],
      },
    ],
    assessment: { passingScore: 60 },
    openQuestions: [],
    sections: [
      {
        id: "s1",
        title: "Section",
        screens: [
          {
            id: "sc1",
            title: "Apprendre",
            minutes: 4,
            blocks: [
              {
                id: "b1",
                type: "narrative",
                role: "worked-example",
                intent: "Montrer",
                content: "Exemple",
                objectives: ["o1"],
                sourceRefs: ["g.pdf#h-b"],
              },
              q("p1", false),
            ],
          },
          {
            id: "sc2",
            title: "Évaluer",
            minutes: 6,
            blocks: [
              q("q1"),
              q("q2"),
              q("q3"),
              {
                id: "sum",
                type: "summary",
                role: "self-regulation",
                intent: "Ancrer",
                content: "Routine",
                objectives: [],
                sourceRefs: [],
              },
            ],
          },
        ],
      },
    ],
  };
}
const codes = (sb: Storyboard, ix: IngestIndex | null = ingest) =>
  checkStoryboard(sb, ix, project).map((i) => i.code);

describe("checkStoryboard", () => {
  it("accepts a storyboard that follows every rule", () => {
    expect(checkStoryboard(valid(), ingest, project)).toEqual([]);
  });

  it("requires every content block to cite existing source anchors", () => {
    const sb = valid();
    const b1 = sb.sections[0]?.screens[0]?.blocks[0];
    if (b1) b1.sourceRefs = ["g.pdf#h-zzz"];
    expect(codes(sb)).toContain("source-ref");
    if (b1) b1.sourceRefs = [];
    expect(codes(sb)).toContain("unsourced");
    expect(codes(valid(), null)).toContain("ingest");
  });

  it("checks alignment, the number of items and the tolerance of the threshold", () => {
    const sb = valid();
    const sc2 = sb.sections[0]?.screens[1];
    if (sc2)
      sc2.blocks = sc2.blocks.filter((b) => b.id !== "q2" && b.id !== "q3");
    expect(codes(sb)).toEqual(
      expect.arrayContaining(["assessment-items", "assessment-tolerance"]),
    );
    if (sc2) sc2.blocks = sc2.blocks.filter((b) => b.id !== "q1");
    expect(codes(sb)).toContain("alignment");
  });

  it("checks answer keys, distractor rationales and question-only fields", () => {
    const sb = valid();
    const q1 = sb.sections[0]?.screens[1]?.blocks[0];
    if (q1?.choices) {
      q1.choices = [
        { text: "A", correct: true },
        { text: "B", correct: true },
      ];
    }
    expect(codes(sb)).toContain("answer-key");
    if (q1)
      q1.choices = [
        { text: "A", correct: true },
        { text: "B", correct: false },
      ];
    expect(codes(sb)).toContain("distractor");
    const b1 = sb.sections[0]?.screens[0]?.blocks[0];
    if (b1) b1.variant = "single";
    expect(codes(sb)).toContain("question-fields");
  });

  it("applies the audit rules: worked example first, self-regulation, image-only assessment, duration", () => {
    const sb = valid();
    const b1 = sb.sections[0]?.screens[0]?.blocks[0];
    if (b1) delete b1.role;
    const sum = sb.sections[0]?.screens[1]?.blocks[3];
    if (sum) delete sum.role;
    for (const b of sb.sections[0]?.screens[1]?.blocks ?? [])
      if (b.type === "question") {
        b.variant = "hotspot";
        b.media = "Schéma";
      }
    const sc1 = sb.sections[0]?.screens[0];
    if (sc1) sc1.minutes = 20;
    expect(codes(sb)).toEqual(
      expect.arrayContaining([
        "worked-example",
        "self-regulation",
        "visual-only-assessment",
        "duration",
      ]),
    );
  });
});

describe("Sam's gate", () => {
  it("refuses to go on until the storyboard is approved, and after any later change", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ldm-gate-"));
    mkdirSync(join(dir, "ingest"));
    writeFileSync(join(dir, "ingest", "ingest.json"), JSON.stringify(ingest));
    await saveProject(dir, {
      schemaVersion: "0.1",
      id: "demo",
      title: "Démo",
      audience: "Conseillers",
      durationMinutes: 10,
      defaultLocale: "fr",
      locales: ["fr"],
      approvals: {},
    });
    writeFileSync(join(dir, "storyboard.yaml"), stringify(valid()));
    await expect(assertApproved(dir)).rejects.toThrow(/not approved/);

    const { hash } = await loadStoryboard(dir);
    await saveProject(dir, {
      schemaVersion: "0.1",
      id: "demo",
      title: "Démo",
      audience: "Conseillers",
      durationMinutes: 10,
      defaultLocale: "fr",
      locales: ["fr"],
      approvals: { storyboard: { hash, at: "2026-10-17", by: "Sam" } },
    });
    await expect(assertApproved(dir)).resolves.toMatchObject({
      module: { id: "demo" },
    });

    const changed = valid();
    changed.assessment.passingScore = 50;
    writeFileSync(join(dir, "storyboard.yaml"), stringify(changed));
    await expect(assertApproved(dir)).rejects.toThrow(GateError);
  });
});

describe("conformToStoryboard", () => {
  /** The module a faithful writer would produce from valid(). */
  function moduleOf(sb: Storyboard): Module {
    return {
      schemaVersion: "0.1",
      id: sb.module.id,
      version: "1.0.0",
      defaultLocale: "fr",
      locales: ["fr"],
      meta: { title: "t", description: "d", durationMinutes: 10 },
      objectives: sb.objectives.map((o) => ({
        id: o.id,
        bloom: o.bloom,
        text: "k",
      })),
      assessment: {
        passingScore: sb.assessment.passingScore,
        completion: "all-screens",
      },
      sections: sb.sections.map((s) => ({
        id: s.id,
        title: "k",
        screens: s.screens.map((sc) => ({
          id: sc.id,
          title: "k",
          blocks: sc.blocks.map((b) =>
            b.type === "question"
              ? {
                  id: b.id,
                  type: "question",
                  variant: b.variant ?? "single",
                  prompt: "k",
                  choices: (b.choices ?? []).map((c, i) => ({
                    id: `c${i}`,
                    text: "k",
                    correct: c.correct,
                    feedback: "k",
                  })),
                  objectives: b.objectives,
                  scored: b.scored ?? true,
                  attempts: 1,
                  shuffle: true,
                }
              : b.type === "summary"
                ? { id: b.id, type: "summary", points: ["k"] }
                : { id: b.id, type: "narrative", body: "k", layout: "text" },
          ),
        })),
      })),
    } as Module;
  }

  it("accepts a module that implements the storyboard, and lists every gap", () => {
    const sb = valid();
    const m = moduleOf(sb);
    expect(conformToStoryboard(m, sb)).toEqual([]);
    const sc2 = m.sections[0]?.screens[1];
    if (sc2) sc2.blocks = sc2.blocks.slice(1); // q1 dropped
    const p1 = m.sections[0]?.screens[0]?.blocks[1];
    if (p1?.type === "question") p1.scored = true; // practice turned into assessment
    // Gaps come in reading order: screen 1 (p1), then screen 2.
    expect(conformToStoryboard(m, sb).map((g) => g.where)).toEqual([
      "blocks (p1)",
      "screens (sc2)",
    ]);
  });
});
