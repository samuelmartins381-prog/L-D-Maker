// DOCX → Markdown: headings (from the style names, whatever the interface language of Word),
// paragraphs, lists, bold and italic, tables and images. Replaces pandoc (ADR 0013).
import {
  attr,
  decode,
  elements,
  openArchive,
  relationships,
  text,
} from "./ooxml.ts";
import type { ReadResult } from "./types.ts";

/** styleId → heading level (Title = 1, "heading N" = N), read from styles.xml. */
function headingStyles(stylesXml: string): Map<string, number> {
  const levels = new Map<string, number>();
  for (const style of elements(stylesXml, "w:style")) {
    const id = attr(style, "w:styleId");
    const name = attr(/<w:name\b[^>]*>/.exec(style)?.[0] ?? "", "w:val");
    if (!id || !name) continue;
    const n = name.toLowerCase();
    if (n === "title") levels.set(id, 1);
    const m = /^heading (\d)$/.exec(n);
    if (m) levels.set(id, Number(m[1]));
  }
  return levels;
}

function runs(paragraph: string, images: Map<string, string>): string {
  let out = "";
  for (const run of elements(paragraph, "w:r")) {
    const blip = /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(run)?.[1];
    if (blip && images.has(blip)) {
      const descr = attr(/<wp:docPr\b[^>]*>/.exec(run)?.[0] ?? "", "descr");
      out += `![${descr ?? ""}](${images.get(blip)})`;
      continue;
    }
    let t = "";
    for (const m of run.matchAll(
      /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g,
    ))
      t += m[1] !== undefined ? decode(m[1]) : m[0] === "<w:tab/>" ? " " : "\n";
    if (!t.trim()) {
      out += t;
      continue;
    }
    const props = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(run)?.[0] ?? "";
    const on = (tag: string) =>
      new RegExp(`<w:${tag}(?:\\s+w:val="(?!0|false)[^"]*")?\\s*/>`).test(
        props,
      );
    const lead = /^\s*/.exec(t)?.[0] ?? "";
    const trail = /\s*$/.exec(t)?.[0] ?? "";
    let core = t.trim();
    if (on("b")) core = `**${core}**`;
    if (on("i")) core = `*${core}*`;
    out += lead + core + trail;
  }
  // Adjacent bold runs ("**a****b**") are one bold span.
  return out.replace(/\*\*\*\*/g, "");
}

function table(tbl: string, images: Map<string, string>): string {
  const rows = elements(tbl, "w:tr").map((tr) =>
    elements(tr, "w:tc").map((tc) =>
      elements(tc, "w:p")
        .map((p) => runs(p, images).trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\|/g, "\\|"),
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

export async function readDocx(data: Uint8Array): Promise<ReadResult> {
  const archive = openArchive(data);
  const doc = text(archive, "word/document.xml");
  if (!doc) throw new Error("not a Word document (word/document.xml missing)");
  const levels = headingStyles(text(archive, "word/styles.xml") ?? "");
  const rels = relationships(archive, "word/document.xml");
  const images = new Map<string, string>();
  const media: ReadResult["media"] = [];
  for (const [id, rel] of rels)
    if (rel.type === "image" && archive[rel.target]) {
      const name = rel.target.split("/").pop() as string;
      images.set(id, name);
      media.push({ name, data: archive[rel.target] as Uint8Array });
    }

  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(doc)?.[1] ?? "";
  const blocks: string[] = [];
  // Top-level paragraphs and tables, in order.
  for (const m of body.matchAll(
    /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?=[\s>/])[^>]*?(?:\/>|>[\s\S]*?<\/w:p>)/g,
  )) {
    const block = m[0];
    if (block.startsWith("<w:tbl>")) {
      blocks.push(table(block, images));
      continue;
    }
    const content = runs(block, images).trim();
    if (!content) continue;
    const style = attr(/<w:pStyle\b[^>]*>/.exec(block)?.[0] ?? "", "w:val");
    const level = style ? levels.get(style) : undefined;
    if (level)
      blocks.push(`${"#".repeat(level)} ${content.replace(/\*/g, "")}`);
    else if (/<w:numPr>/.test(block)) {
      const ilvl = Number(
        attr(/<w:ilvl\b[^>]*>/.exec(block)?.[0] ?? "", "w:val") ?? "0",
      );
      blocks.push(`${"  ".repeat(ilvl)}- ${content}`);
    } else blocks.push(content);
  }
  // Consecutive list items stay together.
  const markdown = blocks
    .join("\n\n")
    .replace(/(^ *- .*)\n\n(?= *- )/gm, "$1\n");
  return { markdown, media };
}
