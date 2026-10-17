import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  anchorHeadings,
  ingestProject,
  listAnchors,
  slugify,
  staleSources,
} from "./ingest.ts";

const DEMO = new URL("../../../projects/mouvement-mecanique", import.meta.url)
  .pathname;
const has = (cmd: string, arg = "--version") => !spawnSync(cmd, [arg]).error;
const tools =
  has("pandoc") && has("markitdown", "--help") && has("pdfinfo", "-v");

/** A throwaway copy of the demo project, so ingest can write freely. */
function demoCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "ldm-gen-"));
  cpSync(join(DEMO, "project.yaml"), join(dir, "project.yaml"));
  cpSync(join(DEMO, "sources"), join(dir, "sources"), { recursive: true });
  return dir;
}

describe("anchors", () => {
  it("slugs headings without accents and keeps them unique", () => {
    expect(slugify("2. L'énergie : le barillet")).toBe(
      "2-l-energie-le-barillet",
    );
    const md = anchorHeadings("# Titre\n\ntexte\n\n## Titre\n", "a.md");
    expect(listAnchors(md)).toEqual([
      { id: "a.md#h-titre", label: "Titre" },
      { id: "a.md#h-titre-2", label: "Titre" },
    ]);
  });

  it("labels an anchor with the first text line after it, skipping other anchors", () => {
    const md = "<!-- src:g.pdf#p1 -->\n\n<!-- src:g.pdf#h-intro -->\n# Intro\n";
    expect(listAnchors(md).map((a) => a.label)).toEqual(["Intro", "Intro"]);
  });
});

describe.skipIf(!tools)("ingestProject on the demo sources", () => {
  it("reads PDF, PPTX and DOCX into anchored Markdown with their media", async () => {
    const dir = demoCopy();
    const index = await ingestProject(dir);
    const byFile = Object.fromEntries(index.sources.map((s) => [s.file, s]));
    const pdf = byFile["guide-mouvement.pdf"];
    const pptx = byFile["argumentaire.pptx"];
    const docx = byFile["notes-terrain.docx"];
    // PDF: one anchor per page and per heading recognised by font size.
    expect(pdf?.anchors.map((a) => a.id)).toEqual(
      expect.arrayContaining([
        "guide-mouvement.pdf#p1",
        "guide-mouvement.pdf#h-5-la-regulation-le-balancier-spiral",
      ]),
    );
    // PPTX: one anchor per slide, image taken from the archive.
    expect(pptx?.anchors).toHaveLength(10);
    expect(pptx?.anchors[5]?.label).toMatch(/moins précis qu'un quartz/);
    expect(pptx?.media).toEqual(["media/argumentaire/image1.png"]);
    // DOCX: one anchor per heading.
    expect(docx?.anchors[0]?.id).toBe(
      "notes-terrain.docx#h-combien-de-temps-tient-elle-si-je-ne-la-porte-pas",
    );
    const text = await readFile(
      join(dir, "ingest", "guide-mouvement.pdf.md"),
      "utf8",
    );
    expect(text).toMatch(
      /28 800 alternances par heure correspondent à 4 hertz/,
    );
    expect(index.words).toBeGreaterThan(1000);
  });

  it("detects sources changed, added or removed since the last ingest", async () => {
    const dir = demoCopy();
    const index = await ingestProject(dir);
    expect(await staleSources(dir, index)).toEqual([]);
    writeFileSync(join(dir, "sources", "extra.md"), "# Ajout\n");
    expect(await staleSources(dir, index)).toEqual(["extra.md"]);
  });
});
