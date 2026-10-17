// Small helpers shared by the DOCX and PPTX readers. Office Open XML is regular enough to be
// read with targeted patterns; only the parts needed for text, structure and images are read.
import { strFromU8, unzipSync } from "fflate";

export type Archive = Record<string, Uint8Array>;

export function openArchive(data: Uint8Array): Archive {
  return unzipSync(data);
}

export function text(archive: Archive, name: string): string | undefined {
  const file = archive[name];
  return file ? strFromU8(file) : undefined;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#")
      return String.fromCodePoint(
        e[1] === "x" || e[1] === "X"
          ? Number.parseInt(e.slice(2), 16)
          : Number(e.slice(1)),
      );
    return ENTITIES[e] ?? m;
  });
}

/** Value of an attribute in an opening tag (namespace prefix included in `name`). */
export function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? decode(m[1] as string) : undefined;
}

/** Every element `<prefix:name …>…</prefix:name>` or self-closing, in document order. */
export function elements(xml: string, name: string): string[] {
  const re = new RegExp(
    `<${name}(?=[\\s/>])[^>]*?(?:/>|>[\\s\\S]*?</${name}>)`,
    "g",
  );
  return xml.match(re) ?? [];
}

/** Relationship id → target path, resolved against the folder of the part. */
export function relationships(
  archive: Archive,
  part: string,
): Map<string, { target: string; type: string }> {
  const dir = part.slice(0, part.lastIndexOf("/"));
  const relsName = `${dir}/_rels/${part.slice(dir.length + 1)}.rels`;
  const map = new Map<string, { target: string; type: string }>();
  for (const rel of elements(text(archive, relsName) ?? "", "Relationship")) {
    const id = attr(rel, "Id");
    const target = attr(rel, "Target");
    if (!id || !target || attr(rel, "TargetMode") === "External") continue;
    map.set(id, {
      target: resolve(dir, target),
      type: (attr(rel, "Type") ?? "").split("/").pop() ?? "",
    });
  }
  return map;
}

function resolve(dir: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = dir.split("/");
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
