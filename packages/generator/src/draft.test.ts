import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Module, validateModule } from "@ldm/schema";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  DraftError,
  draftToModule,
  ModuleDraft,
  type ModuleFrame,
  moduleToDraft,
} from "./draft.ts";

const DEMO = new URL(
  "../../../projects/mouvement-mecanique/module",
  import.meta.url,
).pathname;
const demo = Module.parse(
  parse(readFileSync(join(DEMO, "module.yaml"), "utf8")),
);
const fr = JSON.parse(readFileSync(join(DEMO, "strings/fr.json"), "utf8"));

const frame: ModuleFrame = {
  id: demo.id,
  version: demo.version,
  defaultLocale: "fr",
  locales: ["fr"],
  durationMinutes: demo.meta.durationMinutes,
  passingScore: demo.assessment.passingScore,
  completion: demo.assessment.completion,
  bloom: Object.fromEntries(demo.objectives.map((o) => [o.id, o.bloom])),
};

describe("module drafts", () => {
  it("round-trips the demo module: same structure, same texts, valid", () => {
    const draft = moduleToDraft(demo, fr);
    expect(ModuleDraft.safeParse(draft).success).toBe(true);
    const { module, strings, copies } = draftToModule(draft, frame);
    expect(copies).toEqual([]);
    expect(moduleToDraft(module, strings)).toEqual(draft);
    const v = validateModule({
      module,
      strings: { fr: strings },
      mediaFiles: ["media/movement.svg"],
    });
    expect(v.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("copies the source images it uses into the module", () => {
    const draft = moduleToDraft(demo, fr);
    const block = draft.sections[1]?.screens[0]?.blocks[0];
    if (block?.type !== "hotspots") throw new Error("demo changed");
    block.image.src = "ingest/media/guide-mouvement/img-000.png";
    const { module, copies } = draftToModule(draft, frame);
    expect(copies).toEqual([
      {
        from: "ingest/media/guide-mouvement/img-000.png",
        to: "media/guide-mouvement-img-000.png",
      },
    ]);
    expect(JSON.stringify(module)).toContain(
      "media/guide-mouvement-img-000.png",
    );
  });

  it("refuses two texts on one key", () => {
    const draft = moduleToDraft(demo, fr);
    const s = draft.sections[0];
    if (!s) throw new Error("demo changed");
    s.id = "welcome"; // same id as its first screen
    expect(() => draftToModule(draft, frame)).toThrow(DraftError);
  });
});
