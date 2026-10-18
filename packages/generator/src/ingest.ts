// Reads the project sources into Markdown with traceability anchors (ADR 0013):
//   <!-- src:<file>#p3 -->        PDF page 3
//   <!-- src:<file>#slide-5 -->   slide 5
//   <!-- src:<file>#h-<slug> -->  heading (PDF, DOCX, Markdown, text)
// The storyboard cites these anchors for everything it plans, so no content comes from nowhere.
// The readers are plain JavaScript (readers/), so the desktop Studio needs no external program.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { paths, sha256 } from "./project.ts";
import { readDocx } from "./readers/docx.ts";
import { readPdf } from "./readers/pdf.ts";
import { readPptx } from "./readers/pptx.ts";
import type { ReadResult } from "./readers/types.ts";

export type SourceKind = "pdf" | "docx" | "pptx" | "md" | "txt";

export interface Anchor {
  /** "<file>#<place>", the form cited by the storyboard. */
  id: string;
  /** First words found at that place (heading, slide title or page start). */
  label: string;
}

export interface IngestedSource {
  file: string;
  kind: SourceKind;
  /** sha256 of the source file: ingest is stale when a source changes. */
  hash: string;
  /** Markdown file, relative to ingest/. */
  markdown: string;
  anchors: Anchor[];
  words: number;
  /** Extracted images, relative to ingest/. */
  media: string[];
}

/** Bumped when the readers change what they extract: older readings are then read again. */
export const READER_VERSION = 2;

export interface IngestIndex {
  /** Absent before version 2 (images were extracted at full size). */
  readerVersion?: number;
  sources: IngestedSource[];
  words: number;
  /** Reading time of the raw sources at 200 words per minute. */
  readingMinutes: number;
}

export class IngestError extends Error {}

const KINDS: Record<string, SourceKind> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".pptx": "pptx",
  ".md": "md",
  ".markdown": "md",
  ".txt": "txt",
};

/** Heading slug for anchors: lowercase ASCII, accents removed, words joined by "-". */
export function slugify(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

/** Puts an anchor before every Markdown heading (unique slugs). */
export function anchorHeadings(markdown: string, file: string): string {
  const seen = new Map<string, number>();
  return markdown.replace(/^(#{1,6})\s+(.+)$/gm, (line, _h, title: string) => {
    const base = slugify(title.replace(/[*_`]/g, ""));
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const slug = n === 1 ? base : `${base}-${n}`;
    return `<!-- src:${file}#h-${slug} -->\n${line}`;
  });
}

/** Anchors found in an anchored Markdown text, with the first words that follow each one. */
export function listAnchors(markdown: string): Anchor[] {
  const anchors: Anchor[] = [];
  const lines = markdown.split("\n");
  for (const [i, line] of lines.entries()) {
    const m = /^<!-- src:(\S+) -->$/.exec(line.trim());
    if (!m) continue;
    // Label: the first line of text after the anchor (skipping blank lines and other anchors).
    const next =
      lines
        .slice(i + 1)
        .find((l) => l.trim() && !l.trim().startsWith("<!--")) ?? "";
    anchors.push({
      id: m[1] as string,
      label: next
        .replace(/^#+\s*/, "")
        .trim()
        .slice(0, 80),
    });
  }
  return anchors;
}

const countWords = (markdown: string) =>
  markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/[#*_`>|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

const READERS: Partial<
  Record<SourceKind, (data: Uint8Array) => Promise<ReadResult>>
> = { pdf: readPdf, docx: readDocx, pptx: readPptx };

/** Turns the readers' page and slide markers into anchors, then anchors the headings. */
export function anchorSource(markdown: string, file: string): string {
  return anchorHeadings(
    markdown
      .replace(/<!-- page (\d+) -->/g, `<!-- src:${file}#p$1 -->`)
      .replace(/<!-- slide (\d+) -->/g, `<!-- src:${file}#slide-$1 -->`),
    file,
  );
}

async function readSource(
  kind: SourceKind,
  raw: Buffer,
  file: string,
  mediaDir: string,
): Promise<string> {
  const reader = READERS[kind];
  if (!reader) return anchorHeadings(raw.toString("utf8"), file);
  let result: ReadResult;
  try {
    result = await reader(new Uint8Array(raw));
  } catch (e) {
    throw new IngestError(`${file}: cannot be read (${(e as Error).message})`);
  }
  if (result.media.length) await mkdir(mediaDir, { recursive: true });
  for (const m of result.media) await writeFile(join(mediaDir, m.name), m.data);
  // Slide titles are already headings of the slide anchor: no second anchor for them.
  return kind === "pptx"
    ? result.markdown.replace(
        /<!-- slide (\d+) -->/g,
        `<!-- src:${file}#slide-$1 -->`,
      )
    : anchorSource(result.markdown, file);
}

async function listMedia(dir: string, ingestDir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter((e) => e.isFile())
      .map((e) =>
        join(e.parentPath, e.name)
          .slice(ingestDir.length + 1)
          .split("\\")
          .join("/"),
      )
      .sort();
  } catch {
    return [];
  }
}

/** Reads every source of the project into ingest/ and writes ingest/ingest.json. */
export async function ingestProject(dir: string): Promise<IngestIndex> {
  const p = paths(dir);
  const files = (await readdir(p.sources).catch(() => []))
    .filter((f) => KINDS[extname(f).toLowerCase()])
    .sort();
  if (files.length === 0)
    throw new IngestError(
      `${p.sources}: no source to read (.pdf, .docx, .pptx, .md, .txt)`,
    );
  await rm(p.ingest, { recursive: true, force: true });
  await mkdir(p.ingest, { recursive: true });
  const sources: IngestedSource[] = [];
  for (const file of files) {
    const kind = KINDS[extname(file).toLowerCase()] as SourceKind;
    const src = join(p.sources, file);
    const mediaDir = join(p.ingest, "media", file.replace(/\.[^.]+$/, ""));
    const raw = await readFile(src);
    const markdown = await readSource(kind, raw, file, mediaDir);
    const out = `${file}.md`;
    await writeFile(join(p.ingest, out), `${markdown.trim()}\n`);
    sources.push({
      file,
      kind,
      hash: sha256(raw),
      markdown: out,
      anchors: listAnchors(markdown),
      words: countWords(markdown),
      media: await listMedia(mediaDir, p.ingest),
    });
  }
  const words = sources.reduce((n, s) => n + s.words, 0);
  const index: IngestIndex = {
    readerVersion: READER_VERSION,
    sources,
    words,
    readingMinutes: Math.round(words / 200),
  };
  await writeFile(p.ingestIndex, `${JSON.stringify(index, null, 2)}\n`);
  return index;
}

export async function loadIngest(dir: string): Promise<IngestIndex | null> {
  try {
    return JSON.parse(await readFile(paths(dir).ingestIndex, "utf8"));
  } catch {
    return null;
  }
}

/** Sources added, removed or changed since the last ingest (empty when up to date). */
export async function staleSources(
  dir: string,
  index: IngestIndex,
): Promise<string[]> {
  const p = paths(dir);
  const files = (await readdir(p.sources).catch(() => [])).filter(
    (f) => KINDS[extname(f).toLowerCase()],
  );
  // Read by older readers: every source is read again.
  if ((index.readerVersion ?? 1) < READER_VERSION)
    return index.sources.map((s) => s.file).sort();
  const known = new Map(index.sources.map((s) => [s.file, s.hash]));
  const stale = files.filter((f) => !known.has(f));
  for (const f of files)
    if (
      known.has(f) &&
      known.get(f) !== sha256(await readFile(join(p.sources, f)))
    )
      stale.push(f);
  for (const f of known.keys()) if (!files.includes(f)) stale.push(f);
  return stale.sort();
}
