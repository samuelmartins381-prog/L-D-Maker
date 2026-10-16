import { describe, expect, it } from "vitest";
import { loadModuleSource } from "./load.ts";
import { type ModuleSource, validateModule } from "./validate.ts";

// Minimal valid module; each test breaks one thing and checks the matching issue code.
function fixture(): ModuleSource & {
  module: any;
  strings: { fr: Record<string, string>; en?: Record<string, string> };
} {
  const strings = {
    "m.title": "Titre",
    "m.desc": "Description",
    o1: "Objectif",
    s1: "Section",
    sc1: "Écran",
    body: "Texte",
    "q.p": "Question ?",
    "q.a": "A",
    "q.a.fb": "Retour A",
    "q.b": "B",
    "q.b.fb": "Retour B",
  };
  return {
    module: {
      schemaVersion: "0.1",
      id: "demo",
      version: "1.0.0",
      defaultLocale: "fr",
      locales: ["fr", "en"],
      meta: { title: "m.title", description: "m.desc", durationMinutes: 5 },
      objectives: [{ id: "o1", bloom: "apply", text: "o1" }],
      assessment: { passingScore: 80 },
      sections: [
        {
          id: "s1",
          title: "s1",
          screens: [
            {
              id: "sc1",
              title: "sc1",
              blocks: [
                { id: "n1", type: "narrative", body: "body" },
                {
                  id: "q1",
                  type: "question",
                  variant: "single",
                  prompt: "q.p",
                  objectives: ["o1"],
                  choices: [
                    { id: "a", text: "q.a", correct: true, feedback: "q.a.fb" },
                    {
                      id: "b",
                      text: "q.b",
                      correct: false,
                      feedback: "q.b.fb",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    strings: { fr: { ...strings }, en: { ...strings } },
    mediaFiles: [],
  };
}

const codes = (src: ModuleSource) =>
  validateModule(src).issues.map((i) => i.code);

describe("validateModule", () => {
  it("accepts a minimal valid module and applies defaults", () => {
    const result = validateModule(fixture());
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.module?.assessment.completion).toBe("all-screens");
  });

  it("rejects structural errors with a precise path", () => {
    const src = fixture();
    src.module.sections[0].screens[0].blocks[0].type = "carousel";
    const result = validateModule(src);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toContain("sections.0.screens.0.blocks.0");
  });

  it("rejects unknown fields (typos must not be silently ignored)", () => {
    const src = fixture();
    src.module.meta.titel = "m.title";
    expect(codes(src)).toContain("schema");
  });

  it("requires defaultLocale to be one of the locales", () => {
    const src = fixture();
    src.module.defaultLocale = "de";
    expect(codes(src)).toContain("schema");
  });

  it("detects duplicate ids across the module", () => {
    const src = fixture();
    src.module.sections[0].screens[0].blocks[1].id = "n1";
    expect(codes(src)).toContain("duplicate-id");
  });

  it("checks the answer key of single and multiple choice questions", () => {
    const src = fixture();
    src.module.sections[0].screens[0].blocks[1].choices[1].correct = true;
    expect(codes(src)).toContain("answer-key");

    const multi = fixture();
    const q = multi.module.sections[0].screens[0].blocks[1];
    q.variant = "multiple";
    q.choices[1].correct = true; // all correct: no distractor
    expect(codes(multi)).toContain("answer-key");
  });

  it("enforces objective ↔ assessment alignment", () => {
    const unassessed = fixture();
    unassessed.module.objectives.push({
      id: "o2",
      bloom: "remember",
      text: "o1",
    });
    expect(codes(unassessed)).toContain("alignment");

    const orphan = fixture();
    orphan.module.sections[0].screens[0].blocks[1].objectives = [];
    expect(codes(orphan)).toContain("alignment");

    const unknown = fixture();
    unknown.module.sections[0].screens[0].blocks[1].objectives = ["nope"];
    expect(codes(unknown)).toContain("unknown-objective");
  });

  it("warns when a single mistake would fail the module", () => {
    const issues = validateModule(fixture()).issues;
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "assessment-tolerance",
        severity: "warning",
      }),
    );
  });

  it("does not count practice questions as assessment", () => {
    const src = fixture();
    src.module.sections[0].screens[0].blocks[1].scored = false;
    expect(codes(src)).toContain("alignment");
  });

  it("requires a feedback on every choice", () => {
    const src = fixture();
    delete src.module.sections[0].screens[0].blocks[1].choices[0].feedback;
    expect(codes(src)).toContain("schema");
  });

  it("reports missing, empty and unused strings per locale", () => {
    const src = fixture();
    delete src.strings.en?.["q.b.fb"];
    src.strings.fr.body = "  ";
    src.strings.fr.extra = "orphan";
    const issues = validateModule(src).issues;
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "missing-string",
        path: "strings/en.json",
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "empty-string",
        path: "strings/fr.json",
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "unused-string", severity: "warning" }),
    );
  });

  it("reports a missing catalog once", () => {
    const src = fixture();
    delete src.strings.en;
    expect(codes(src).filter((c) => c === "missing-catalog")).toHaveLength(1);
  });

  it("requires alt text unless the image is decorative, and checks the file exists", () => {
    const src = fixture();
    src.module.sections[0].screens[0].blocks[0].media = {
      kind: "image",
      src: "media/a.png",
    };
    expect(codes(src)).toEqual(
      expect.arrayContaining(["image-alt", "media-missing"]),
    );

    const ok = fixture();
    ok.module.sections[0].screens[0].blocks[0].media = {
      kind: "image",
      src: "media/a.png",
      decorative: true,
    };
    ok.mediaFiles = ["media/a.png"];
    expect(validateModule(ok).ok).toBe(true);
  });

  it("checks hotspots: image file, alt and item strings, unique ids, overlapping markers", () => {
    const src = fixture();
    const item = (id: string, x: number, y: number) => ({
      id,
      x,
      y,
      title: "body",
      body: "body",
    });
    src.module.sections[0].screens[0].blocks[0] = {
      id: "h1",
      type: "hotspots",
      image: { src: "media/m.svg", alt: "h.alt" },
      items: [item("a", 10, 10), item("b", 80, 80)],
    };
    expect(codes(src)).toEqual(
      expect.arrayContaining(["media-missing", "missing-string"]),
    );
    src.mediaFiles = ["media/m.svg"];
    src.strings.fr["h.alt"] = "Vue du mouvement";
    (src.strings.en as Record<string, string>)["h.alt"] = "Movement view";
    // The fixture's single scored question always triggers "assessment-tolerance": not checked here.
    const own = () => codes(src).filter((c) => c !== "assessment-tolerance");
    expect(own()).toEqual([]);

    const block = src.module.sections[0].screens[0].blocks[0];
    block.items = [item("a", 10, 10), item("a", 12, 13)];
    expect(own()).toEqual(["hotspot-overlap", "duplicate-id"]);
    block.items = [item("a", 10, 10), item("b", 101, 10)];
    expect(own()).toEqual(["schema"]);
  });
});

describe("demo module", () => {
  it("examples/phishing-basics is valid with no warnings", async () => {
    const dir = new URL("../../../examples/phishing-basics", import.meta.url)
      .pathname;
    const result = validateModule(await loadModuleSource(dir));
    expect(result.issues).toEqual([]);
  });
});
