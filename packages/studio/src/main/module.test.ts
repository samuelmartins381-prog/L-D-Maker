import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { translationStatus } from "@ldm/generator";
import { describe, expect, it } from "vitest";
import { moduleTexts, saveModuleTexts } from "./module.ts";
import { acquireLock } from "./projects.ts";

const DEMO = new URL(
  "../../../../projects/mouvement-mecanique",
  import.meta.url,
).pathname;

function demo(): string {
  const dir = mkdtempSync(join(tmpdir(), "ldm-studio-module-"));
  for (const f of ["project.yaml", "module"])
    cpSync(join(DEMO, f), join(dir, f), { recursive: true });
  return dir;
}

describe("module texts", () => {
  it("lists every text once, grouped by screen, with what it is", async () => {
    const t = await moduleTexts(demo());
    expect(t.defaultLocale).toBe("fr");
    expect(t.groups[0]?.entries.map((e) => e.field).slice(0, 3)).toEqual([
      "title",
      "description",
      "objective",
    ]);
    const welcome = t.groups[1];
    expect(welcome?.entries[0]).toMatchObject({ field: "section" });
    expect(welcome?.entries[1]).toMatchObject({ field: "screen" });
    const keys = t.groups.flatMap((g) => g.entries.map((e) => e.key));
    expect(new Set(keys).size).toBe(keys.length);
    const fields = new Set(
      t.groups.flatMap((g) => g.entries.map((e) => e.field)),
    );
    for (const f of [
      "choice",
      "feedback",
      "item-title",
      "prompt",
      "point",
      "alt",
    ])
      expect(fields).toContain(f);
  });

  it("saves Sam's edits with French typography, and refuses them while Kylian holds the project", async () => {
    const dir = demo();
    const before = (await translationStatus(dir)).find(
      (s) => s.locale === "en",
    );
    const t = await saveModuleTexts(
      dir,
      { "meta.title": "Le mouvement : expliqué" },
      "Sam",
    );
    expect(t.groups[0]?.entries[0]?.text).toBe("Le mouvement : expliqué");
    const fr = JSON.parse(
      readFileSync(join(dir, "module/strings/fr.json"), "utf8"),
    );
    expect(fr["meta.title"]).toBe("Le mouvement : expliqué");
    // Never translated through the Studio: everything is due; the edit is part of it.
    expect(
      (await translationStatus(dir)).find((s) => s.locale === "en")?.pending,
    ).toBe(before?.pending);
    await expect(
      saveModuleTexts(dir, { "no.such": "x" }, "Sam"),
    ).rejects.toThrow(/unknown/);
    await acquireLock(dir, "Kylian");
    await expect(
      saveModuleTexts(dir, { "meta.title": "x" }, "Sam"),
    ).rejects.toThrow(/Kylian/);
  });
});
