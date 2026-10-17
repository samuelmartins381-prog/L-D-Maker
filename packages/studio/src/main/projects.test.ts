import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { NewProject } from "../shared/api.ts";
import {
  acquireLock,
  addSources,
  createProject,
  LOCK_FILE,
  LOCK_TTL_MS,
  listProjects,
  projectDetail,
  releaseLockSync,
} from "./projects.ts";

const DEMO = new URL(
  "../../../../projects/mouvement-mecanique/sources/",
  import.meta.url,
).pathname;

const input = (over: Partial<NewProject> = {}): NewProject => ({
  title: "Le spiral",
  client: "Maison",
  brief: "",
  audience: "Vente",
  durationMinutes: 15,
  defaultLocale: "fr",
  locales: ["en", "fr"],
  outputs: ["teach-on-mars"],
  theme: "lumiere",
  animation: "standard",
  questionTypes: ["single"],
  questionsPerObjective: 3,
  passingScore: 80,
  attempts: 1,
  formality: "formal",
  sources: [],
  ...over,
});

describe("projects in the shared folder", () => {
  it("creates a project with Sam's choices and lists it", async () => {
    const root = mkdtempSync(join(tmpdir(), "ldm-studio-"));
    const a = await createProject(
      root,
      input({ sources: [join(DEMO, "notes-terrain.docx")] }),
      "Sam",
    );
    const b = await createProject(root, input(), "Sam");
    expect(a.id).toBe("le-spiral");
    expect(b.id).toBe("le-spiral-2");
    expect(a.project.locales).toEqual(["fr", "en"]);
    expect(a.project.outputs).toEqual([{ profile: "teach-on-mars" }]);
    expect(a.project.assessment.questionTypes).toEqual(["single"]);
    expect(a.sources).toEqual([
      { file: "notes-terrain.docx", bytes: expect.any(Number) },
    ]);
    expect(a.state.ingest.state).toBe("missing");
    expect((await listProjects(root, "Sam")).map((p) => p.id).sort()).toEqual([
      "le-spiral",
      "le-spiral-2",
    ]);
  });

  it("refuses files it cannot read", async () => {
    const root = mkdtempSync(join(tmpdir(), "ldm-studio-"));
    await expect(
      createProject(root, input({ sources: ["/tmp/photo.heic"] }), "Sam"),
    ).rejects.toThrow(/unsupported file type: photo.heic/);
  });
});

describe("lock between Sam and Kylian", () => {
  it("keeps a project read-only while the other holds it, until it expires or is forced", async () => {
    const root = mkdtempSync(join(tmpdir(), "ldm-studio-"));
    const { dir } = await createProject(root, input(), "Sam");
    expect(await acquireLock(dir, "Kylian")).toMatchObject({ by: "Sam" });
    expect((await projectDetail(dir, "Kylian")).editable).toBe(false);
    await expect(
      addSources(dir, [join(DEMO, "notes-terrain.docx")], "Kylian"),
    ).rejects.toThrow(/locked by Sam/);
    // An old lock is forgotten.
    writeFileSync(
      join(dir, LOCK_FILE),
      JSON.stringify({
        by: "Sam",
        at: new Date(Date.now() - LOCK_TTL_MS - 1000).toISOString(),
      }),
    );
    expect(await acquireLock(dir, "Kylian")).toBeUndefined();
    expect(JSON.parse(readFileSync(join(dir, LOCK_FILE), "utf8")).by).toBe(
      "Kylian",
    );
    // Forced take-over, then release by its holder only.
    expect(await acquireLock(dir, "Sam", true)).toBeUndefined();
    releaseLockSync(dir, "Kylian");
    expect((await projectDetail(dir, "Kylian")).lockedBy?.by).toBe("Sam");
    releaseLockSync(dir, "Sam");
    expect((await projectDetail(dir, "Kylian")).editable).toBe(true);
  });
});
