// Inline markup allowed in body strings (ADR 0002): **bold**, *italic*, [label](https://url).
// Parsed into tokens rendered as DOM nodes — never injected as HTML, so strings cannot carry markup attacks.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] };

const SAFE_URL = /^(https?:|mailto:)/i;
// Bold closes on the last * of a run, so **a *b*** nests correctly.
const TOKEN = /\*\*(.+?)\*\*(?!\*)|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/s;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let rest = source;
  while (rest.length > 0) {
    const m = TOKEN.exec(rest);
    if (!m) {
      out.push({ kind: "text", text: rest });
      break;
    }
    if (m.index > 0) out.push({ kind: "text", text: rest.slice(0, m.index) });
    const [whole, strong, em, label, href] = m;
    if (strong !== undefined)
      out.push({ kind: "strong", children: parseInline(strong) });
    else if (em !== undefined)
      out.push({ kind: "em", children: parseInline(em) });
    else if (label !== undefined && href !== undefined) {
      // Unsafe schemes (javascript:, data:) degrade to plain text.
      if (SAFE_URL.test(href))
        out.push({ kind: "link", href, children: parseInline(label) });
      else out.push({ kind: "text", text: label });
    }
    rest = rest.slice(m.index + whole.length);
  }
  return out;
}

/** Paragraphs are separated by blank lines in the source string. */
export function splitParagraphs(source: string): string[] {
  return source
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
