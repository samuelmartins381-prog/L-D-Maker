// PDF → Markdown with pdf.js (Apache-2.0), replacing pdfplumber and poppler (ADR 0013).
// Headings are recognised by font size: larger than the body text, which is the size carrying
// the most characters. Lines are joined back into paragraphs. Each page starts with
// `<!-- page N -->`; embedded images are extracted as PNG.
import { createRequire } from "node:module";
import { downscale } from "./image.ts";
import { encodePng } from "./png.ts";
import type { ReadResult } from "./types.ts";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjs: Promise<PdfJs> | undefined;
// The legacy build runs in Node without a browser worker.
const load = () =>
  (pdfjs ??= import(
    createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.mjs")
  ) as Promise<PdfJs>);

interface Line {
  text: string;
  size: number;
  /** Baseline, in PDF units from the bottom of the page. */
  y: number;
}

interface TextItem {
  str: string;
  transform: number[];
  hasEOL: boolean;
}

function toLines(items: TextItem[]): Line[] {
  const lines: Line[] = [];
  let current: Line | undefined;
  for (const item of items) {
    const y = item.transform[5] as number;
    const size =
      Math.round(
        Math.hypot(item.transform[0] as number, item.transform[1] as number) *
          10,
      ) / 10;
    if (current && Math.abs(current.y - y) > 2 && item.str.trim()) {
      lines.push(current);
      current = undefined;
    }
    if (item.str) {
      current ??= { text: "", size: 0, y };
      current.text += item.str;
      if (item.str.trim()) current.size = Math.max(current.size, size);
    }
    if (item.hasEOL && current) {
      lines.push(current);
      current = undefined;
    }
  }
  if (current) lines.push(current);
  return lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() }))
    .filter((l) => l.text);
}

/** Pixels of a pdf.js image object as PNG, at most MAX_EDGE wide or high; undefined for formats not handled. */
function imageToPng(img: {
  width: number;
  height: number;
  kind: number;
  data?: Uint8Array | Uint8ClampedArray;
}): Uint8Array | undefined {
  const { width, height, kind, data } = img;
  if (!data) return undefined;
  let channels: 1 | 3 | 4;
  let pixels: Uint8Array;
  if (kind === 2 || kind === 3) {
    channels = kind === 2 ? 3 : 4;
    pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (kind === 1) {
    // 1 bit per pixel, rows padded to a byte.
    const stride = (width + 7) >> 3;
    channels = 1;
    pixels = new Uint8Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        pixels[y * width + x] =
          ((data[y * stride + (x >> 3)] as number) >> (7 - (x & 7))) & 1
            ? 255
            : 0;
  } else return undefined;
  const small = downscale(width, height, channels, pixels);
  return encodePng(small.width, small.height, channels, small.pixels);
}

export async function readPdf(data: Uint8Array): Promise<ReadResult> {
  const lib = await load();
  const task = lib.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const pages: Line[][] = [];
  const media: ReadResult["media"] = [];
  const imagePages = new Set<number>();
  // An image repeated on several pages (a logo, a frame) is extracted once.
  const seen = new Set<string>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(toLines(content.items.filter((i) => "str" in i) as TextItem[]));
    const ops = await page.getOperatorList();
    for (const [i, fn] of ops.fnArray.entries()) {
      if (fn !== lib.OPS.paintImageXObject) continue;
      const name = (ops.argsArray[i] as [string])[0];
      if (seen.has(name)) {
        imagePages.add(n);
        continue;
      }
      seen.add(name);
      const img = await new Promise<Parameters<typeof imageToPng>[0]>((ok) =>
        (name.startsWith("g_") ? page.commonObjs : page.objs).get(name, ok),
      );
      // Decorations (rules, bullets) are not worth a media file.
      if (img.width < 32 || img.height < 32) continue;
      const png = imageToPng(img);
      if (!png) continue;
      imagePages.add(n);
      media.push({
        name: `img-${String(media.length).padStart(3, "0")}.png`,
        data: png,
      });
    }
    page.cleanup();
  }
  await task.destroy();

  const weight = new Map<number, number>();
  for (const line of pages.flat())
    weight.set(line.size, (weight.get(line.size) ?? 0) + line.text.length);
  const body = [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const headingSizes = [...weight.keys()]
    .filter((s) => s >= body * 1.15)
    .sort((a, b) => b - a);
  const level = new Map(headingSizes.map((s, i) => [s, Math.min(i + 1, 3)]));

  const out: string[] = [];
  for (const [i, lines] of pages.entries()) {
    out.push(`<!-- page ${i + 1} -->`);
    if (lines.length === 0 && imagePages.has(i + 1))
      // Scanned page or full-page figure: no text layer to read.
      out.push("<!-- no-text: image only -->");
    let para: string[] = [];
    let heading: { size: number; text: string[] } | undefined;
    const flush = () => {
      if (heading)
        out.push(
          `${"#".repeat(level.get(heading.size) ?? 1)} ${heading.text.join(" ")}`,
        );
      if (para.length) out.push(para.join(" "));
      heading = undefined;
      para = [];
    };
    let last: Line | undefined;
    for (const line of lines) {
      const gap = last ? last.y - line.y - line.size : undefined;
      if (level.has(line.size)) {
        if (
          !heading ||
          heading.size !== line.size ||
          (gap !== undefined && last && gap > last.size)
        ) {
          flush();
          heading = { size: line.size, text: [] };
        }
        heading.text.push(line.text);
      } else {
        if (heading) flush();
        // A vertical gap larger than half a line starts a new paragraph.
        if (para.length && gap !== undefined && last && gap > 0.5 * last.size)
          flush();
        para.push(line.text);
      }
      last = line;
    }
    flush();
  }
  return { markdown: out.join("\n\n"), media };
}
