// PPTX → Markdown, slide by slide in presentation order: title, text, tables, images
// (named by their description) and speaker notes. Replaces markitdown (ADR 0013).
import {
  type Archive,
  attr,
  decode,
  elements,
  openArchive,
  relationships,
  text,
} from "./ooxml.ts";
import type { ReadResult } from "./types.ts";

function paragraphs(txBody: string): string[] {
  return elements(txBody, "a:p")
    .map((p) =>
      [...p.matchAll(/<a:t>([^<]*)<\/a:t>|<a:br\/>/g)]
        .map((m) => (m[1] !== undefined ? decode(m[1]) : "\n"))
        .join("")
        .trim(),
    )
    .filter(Boolean);
}

function table(tbl: string): string {
  const rows = elements(tbl, "a:tr").map((tr) =>
    elements(tr, "a:tc").map((tc) =>
      paragraphs(tc).join(" ").replace(/\|/g, "\\|"),
    ),
  );
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => r[i] ?? "").join(" | ")} |`;
  return [
    line(rows[0] as string[]),
    `|${" --- |".repeat(width)}`,
    ...rows.slice(1).map(line),
  ].join("\n");
}

function slideOrder(archive: Archive): string[] {
  const rels = relationships(archive, "ppt/presentation.xml");
  const ids = [
    ...(text(archive, "ppt/presentation.xml") ?? "").matchAll(
      /<p:sldId\b[^>]*r:id="([^"]+)"/g,
    ),
  ].map((m) => m[1] as string);
  return ids
    .map((id) => rels.get(id)?.target)
    .filter((t): t is string => !!t && !!archive[t]);
}

export async function readPptx(data: Uint8Array): Promise<ReadResult> {
  const archive = openArchive(data);
  const slides = slideOrder(archive);
  if (slides.length === 0)
    throw new Error("not a PowerPoint presentation (no slides found)");
  const media: ReadResult["media"] = [];
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const [i, slide] of slides.entries()) {
    const xml = text(archive, slide) ?? "";
    const rels = relationships(archive, slide);
    const out: string[] = [`<!-- slide ${i + 1} -->`];
    // Shapes, pictures and tables in drawing order.
    for (const m of xml.matchAll(
      /<p:sp>[\s\S]*?<\/p:sp>|<p:pic>[\s\S]*?<\/p:pic>|<p:graphicFrame>[\s\S]*?<\/p:graphicFrame>/g,
    )) {
      const shape = m[0];
      if (shape.startsWith("<p:pic>")) {
        const rel = rels.get(/r:embed="([^"]+)"/.exec(shape)?.[1] ?? "");
        if (!rel || !archive[rel.target]) continue;
        const name = rel.target.split("/").pop() as string;
        if (!seen.has(name)) {
          seen.add(name);
          media.push({ name, data: archive[rel.target] as Uint8Array });
        }
        const descr = attr(/<p:cNvPr\b[^>]*>/.exec(shape)?.[0] ?? "", "descr");
        out.push(`![${descr ?? ""}](${name})`);
        continue;
      }
      if (shape.startsWith("<p:graphicFrame>")) {
        const tbl = /<a:tbl>[\s\S]*<\/a:tbl>/.exec(shape)?.[0];
        if (tbl) out.push(table(tbl));
        continue;
      }
      const ph = attr(/<p:ph\b[^>]*>/.exec(shape)?.[0] ?? "", "type");
      if (ph === "sldNum" || ph === "dt" || ph === "ftr") continue;
      const lines = paragraphs(shape);
      if (lines.length === 0) continue;
      if (ph === "title" || ph === "ctrTitle") out.push(`# ${lines.join(" ")}`);
      else out.push(lines.join("\n"));
    }
    const notesPart = [...rels.values()].find((r) => r.type === "notesSlide");
    if (notesPart) {
      const notesXml = text(archive, notesPart.target) ?? "";
      const notes = [...notesXml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
        .filter(
          (s) => attr(/<p:ph\b[^>]*>/.exec(s[0])?.[0] ?? "", "type") === "body",
        )
        .flatMap((s) => paragraphs(s[0]));
      if (notes.length) out.push(`### Notes:\n${notes.join("\n")}`);
    }
    parts.push(out.join("\n"));
  }
  return { markdown: parts.join("\n\n"), media };
}
