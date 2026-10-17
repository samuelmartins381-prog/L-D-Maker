// Reads the project sources into Markdown with traceability anchors (ADR 0013):
//   <!-- src:<file>#p3 -->        PDF page 3          (pdf_to_markdown.py: pdfplumber; pdftotext fallback)
//   <!-- src:<file>#slide-5 -->   slide 5             (markitdown)
//   <!-- src:<file>#h-<slug> -->  heading             (DOCX via pandoc, Markdown and text as is)
// The storyboard cites these anchors for everything it plans, so no content comes from nowhere.
// External tools run as separate programs; nothing from them ships in a module.
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { paths, sha256 } from "./project.ts";

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

export interface IngestIndex {
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

const INSTALL: Record<string, string> = {
  pdfinfo: "apt-get install poppler-utils",
  pdftotext: "apt-get install poppler-utils",
  pdfimages: "apt-get install poppler-utils",
  pandoc: "apt-get install pandoc",
  markitdown: "pip install markitdown",
  python3: "apt-get install python3 && pip install pdfplumber",
};

function run(cmd: string, args: string[], cwd?: string): string {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT")
    throw new IngestError(
      `${cmd} is not installed (needed to read sources): ${INSTALL[cmd] ?? cmd}`,
    );
  if (r.status !== 0)
    throw new IngestError(
      `${cmd} ${args.join(" ")} failed: ${r.stderr.trim()}`,
    );
  return r.stdout;
}

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

const PDF_TO_MARKDOWN = fileURLToPath(
  new URL("./pdf_to_markdown.py", import.meta.url),
);

async function readPdf(src: string, file: string, mediaDir: string) {
  let markdown: string;
  try {
    // Headings recognised by font size (pdfplumber): finer anchors than pages alone.
    markdown = run("python3", [PDF_TO_MARKDOWN, src]);
  } catch {
    // Fallback without pdfplumber: plain text, page by page.
    const pages = Number(
      /Pages:\s+(\d+)/.exec(run("pdfinfo", [src]))?.[1] ?? "0",
    );
    const parts: string[] = [];
    for (let p = 1; p <= pages; p++)
      parts.push(
        `<!-- page ${p} -->\n${run("pdftotext", [
          "-f",
          `${p}`,
          "-l",
          `${p}`,
          src,
          "-",
        ])
          .replace(/\f/g, "")
          .trim()}`,
      );
    markdown = parts.join("\n\n");
  }
  await mkdir(mediaDir, { recursive: true });
  run("pdfimages", ["-png", src, join(mediaDir, "img")]);
  return anchorHeadings(
    markdown.replace(/<!-- page (\d+) -->/g, `<!-- src:${file}#p$1 -->`),
    file,
  );
}

async function readDocx(src: string, file: string, mediaDir: string) {
  const markdown = run("pandoc", [
    src,
    "-t",
    "gfm",
    "--wrap=none",
    `--extract-media=${mediaDir}`,
  ]);
  return anchorHeadings(markdown, file);
}

async function readPptx(src: string, file: string, mediaDir: string) {
  const markdown = run("markitdown", [src]).replace(
    /<!-- Slide number: (\d+) -->/g,
    `<!-- src:${file}#slide-$1 -->`,
  );
  // markitdown names images but does not extract them: take them from the archive.
  const zip = unzipSync(new Uint8Array(await readFile(src)), {
    filter: (f) => f.name.startsWith("ppt/media/"),
  });
  await mkdir(mediaDir, { recursive: true });
  for (const [name, data] of Object.entries(zip))
    await writeFile(join(mediaDir, basename(name)), data);
  return markdown;
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
    const markdown =
      kind === "pdf"
        ? await readPdf(src, file, mediaDir)
        : kind === "docx"
          ? await readDocx(src, file, mediaDir)
          : kind === "pptx"
            ? await readPptx(src, file, mediaDir)
            : anchorHeadings(raw.toString("utf8"), file);
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
