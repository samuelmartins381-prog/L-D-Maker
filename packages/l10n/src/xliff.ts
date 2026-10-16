// XLIFF 1.2 and 2.0 (OASIS) writer and reader for module strings (ADR 0006).
// Inline markup (**bold**, *italic*, [link](url)) travels as paired inline codes that CAT tools
// protect: <g ctype="bold|italic|link"> in 1.2, <pc type="fmt" subType="xlf:b|xlf:i"> / <pc type="link">
// in 2.0. Link URLs never appear in the file: a link is identified by its code id and gets its URL
// back from the source string on import (resolveLinks), so translators cannot alter it and the file
// stays valid against the strict OASIS schemas (no extension attributes).

import { type Inline, parseInline, renderInline } from "@ldm/schema/markup";
import { DOMParser, type Element, type Node } from "@xmldom/xmldom";

export type XliffVersion = "1.2" | "2.0";

export interface Unit {
  id: string;
  /** Source text, in module markup (link URLs replaced by code placeholders when read from XLIFF). */
  source: string;
  /** Translation, in module markup; absent when not translated yet. */
  target?: string;
  /** Context for translators: where the string is used. */
  notes: string[];
}

export interface XliffDoc {
  version: XliffVersion;
  srcLang: string;
  trgLang: string;
  /** Source file reference (module id and version). */
  original: string;
  units: Unit[];
}

export class XliffError extends Error {}

const NS = {
  "1.2": "urn:oasis:names:tc:xliff:document:1.2",
  "2.0": "urn:oasis:names:tc:xliff:document:2.0",
} as const;
/** Href placeholder of a link read from XLIFF: "ldm-code:<code id>". */
const CODE_HREF = "ldm-code:";
/** parseInline only keeps http(s)/mailto links: placeholders are swapped with this safe prefix while parsing. */
const SAFE_PREFIX = "https://ldm.invalid/";

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

type Code = Exclude<Inline, { kind: "text" }>;

/** Visits formatting nodes in reading order, giving each its code id (1, 2, 3… per string). */
function numberCodes(
  nodes: Inline[],
  visit: (n: Code, id: number) => void,
): void {
  let next = 1;
  const walk = (list: Inline[]) => {
    for (const n of list) {
      if (n.kind === "text") continue;
      visit(n, next++);
      walk(n.children);
    }
  };
  walk(nodes);
}

/** Like parseInline, but keeps "ldm-code:" placeholder links. */
function parseMarkup(text: string): Inline[] {
  const restore = (list: Inline[]): Inline[] =>
    list.map((n) => {
      if (n.kind === "text") return n;
      if (n.kind === "link")
        return {
          kind: "link",
          href: n.href.replace(SAFE_PREFIX, CODE_HREF),
          children: restore(n.children),
        };
      return { ...n, children: restore(n.children) };
    });
  return restore(
    parseInline(text.replaceAll(`](${CODE_HREF}`, `](${SAFE_PREFIX}`)),
  );
}

/** Markup string → XLIFF inline content. */
function encodeInline(text: string, version: XliffVersion): string {
  const nodes = parseMarkup(text);
  const ids = new Map<Inline, number>();
  numberCodes(nodes, (n, id) => ids.set(n, id));
  const walk = (list: Inline[]): string =>
    list
      .map((n) => {
        if (n.kind === "text") return esc(n.text);
        const id = ids.get(n);
        const inner = walk(n.children);
        if (version === "1.2") {
          const ctype =
            n.kind === "link"
              ? "link"
              : n.kind === "strong"
                ? "bold"
                : "italic";
          return `<g id="${id}" ctype="${ctype}">${inner}</g>`;
        }
        if (n.kind === "link")
          return `<pc id="${id}" type="link">${inner}</pc>`;
        return `<pc id="${id}" type="fmt" subType="${n.kind === "strong" ? "xlf:b" : "xlf:i"}">${inner}</pc>`;
      })
      .join("");
  return walk(nodes);
}

/** XLIFF inline content → markup tokens. Unknown inline elements added by CAT tools (mrk, sm…) are unwrapped. */
function decodeInline(el: Element): Inline[] {
  const out: Inline[] = [];
  for (let n: Node | null = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 3 || n.nodeType === 4) {
      const text = n.nodeValue ?? "";
      const last = out.at(-1);
      if (last?.kind === "text") last.text += text;
      else out.push({ kind: "text", text });
      continue;
    }
    if (n.nodeType !== 1) continue;
    const child = n as Element;
    const children = decodeInline(child);
    const name = child.localName;
    let kind: string | null = null;
    if (name === "g") kind = child.getAttribute("ctype");
    else if (name === "pc")
      kind =
        child.getAttribute("type") === "link"
          ? "link"
          : child.getAttribute("subType");
    if (kind === "link")
      out.push({
        kind: "link",
        href: `${CODE_HREF}${child.getAttribute("id") ?? ""}`,
        children,
      });
    else if (kind === "bold" || kind === "xlf:b")
      out.push({ kind: "strong", children });
    else if (kind === "italic" || kind === "xlf:i")
      out.push({ kind: "em", children });
    else out.push(...children); // mrk, sm/em markers, unknown codes: keep their text
  }
  return out;
}

/**
 * Gives links read from XLIFF their URL back, from the link with the same code id in the source
 * string. Returns null when a link has no counterpart in the source (added or renumbered by hand).
 */
export function resolveLinks(
  translated: string,
  source: string,
): string | null {
  const urls = new Map<string, string>();
  numberCodes(parseInline(source), (n, id) => {
    if (n.kind === "link") urls.set(String(id), n.href);
  });
  let ok = true;
  const walk = (list: Inline[]): Inline[] =>
    list.map((n) => {
      if (n.kind === "text") return n;
      if (n.kind !== "link") return { ...n, children: walk(n.children) };
      const url = n.href.startsWith(CODE_HREF)
        ? urls.get(n.href.slice(CODE_HREF.length))
        : undefined;
      if (!url) ok = false;
      return { kind: "link", href: url ?? "", children: walk(n.children) };
    });
  const resolved = renderInline(walk(parseMarkup(translated)));
  return ok ? resolved : null;
}

/** Bold, italic and link counts of a markup string, to compare source and translation. */
export function formatCounts(text: string): Record<Code["kind"], number> {
  const c = { strong: 0, em: 0, link: 0 };
  numberCodes(parseMarkup(text), (n) => {
    c[n.kind]++;
  });
  return c;
}

export function writeXliff(doc: XliffDoc): string {
  const v = doc.version;
  if (v === "1.2") {
    const units = doc.units
      .map((u) => {
        const target = u.target
          ? `\n        <target state="translated">${encodeInline(u.target, v)}</target>`
          : "";
        const notes = u.notes
          .map((n) => `\n        <note from="ldm">${esc(n)}</note>`)
          .join("");
        return `      <trans-unit id="${esc(u.id)}" xml:space="preserve">
        <source>${encodeInline(u.source, v)}</source>${target}${notes}
      </trans-unit>`;
      })
      .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="${NS["1.2"]}">
  <file original="${esc(doc.original)}" source-language="${esc(doc.srcLang)}" target-language="${esc(doc.trgLang)}" datatype="plaintext">
    <body>
${units}
    </body>
  </file>
</xliff>
`;
  }
  const units = doc.units
    .map((u) => {
      const notes = u.notes.length
        ? `\n      <notes>${u.notes.map((n) => `\n        <note category="location">${esc(n)}</note>`).join("")}\n      </notes>`
        : "";
      const target = u.target
        ? `\n        <target xml:space="preserve">${encodeInline(u.target, v)}</target>`
        : "";
      return `    <unit id="${esc(u.id)}">${notes}
      <segment state="${u.target ? "translated" : "initial"}">
        <source xml:space="preserve">${encodeInline(u.source, v)}</source>${target}
      </segment>
    </unit>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="2.0" xmlns="${NS["2.0"]}" srcLang="${esc(doc.srcLang)}" trgLang="${esc(doc.trgLang)}">
  <file id="f1" original="${esc(doc.original)}">
${units}
  </file>
</xliff>
`;
}

export function readXliff(xml: string): XliffDoc {
  const errors: string[] = [];
  let root: Element | null = null;
  try {
    // xmldom reports recoverable errors through onError and throws on fatal ones.
    root = new DOMParser({
      onError: (level, msg) => {
        if (level !== "warning") errors.push(msg);
      },
    }).parseFromString(xml, "text/xml").documentElement;
  } catch (e) {
    errors.push((e as Error).message);
  }
  if (errors.length || !root || root.localName !== "xliff")
    throw new XliffError(
      `not a valid XLIFF file: ${errors[0] ?? "no <xliff> root"}`,
    );
  const version = root.getAttribute("version");
  if (version !== "1.2" && version !== "2.0")
    throw new XliffError(
      `unsupported XLIFF version "${version}" (1.2 or 2.0 expected)`,
    );
  const ns = NS[version];
  const all = (parent: Element, name: string) =>
    Array.from(parent.getElementsByTagNameNS(ns, name));
  const first = (parent: Element, name: string) => all(parent, name)[0];
  const text = (el: Element | undefined) =>
    el ? renderInline(decodeInline(el)) : "";
  const file = first(root, "file");
  if (!file) throw new XliffError("no <file> element");
  const units: Unit[] = [];

  if (version === "1.2") {
    for (const tu of all(root, "trans-unit")) {
      const target = text(first(tu, "target"));
      units.push({
        id: tu.getAttribute("id") ?? "",
        source: text(first(tu, "source")),
        ...(target.trim() ? { target } : {}),
        notes: all(tu, "note").map((n) => n.textContent ?? ""),
      });
    }
    return {
      version,
      srcLang: file.getAttribute("source-language") ?? "",
      trgLang: file.getAttribute("target-language") ?? "",
      original: file.getAttribute("original") ?? "",
      units,
    };
  }

  for (const unit of all(root, "unit")) {
    // A unit may be split into several segments by the CAT tool: join them back in order.
    const segments = all(unit, "segment");
    const join = (name: string) =>
      segments.map((s) => text(first(s, name))).join("");
    const target = join("target");
    units.push({
      id: unit.getAttribute("id") ?? "",
      source: join("source"),
      ...(target.trim() ? { target } : {}),
      notes: all(unit, "note").map((n) => n.textContent ?? ""),
    });
  }
  return {
    version,
    srcLang: root.getAttribute("srcLang") ?? "",
    trgLang: root.getAttribute("trgLang") ?? "",
    original: file.getAttribute("original") ?? "",
    units,
  };
}
