import { describe, expect, it } from "vitest";
import { parseInline, renderInline, splitParagraphs } from "./markup.ts";

describe("parseInline", () => {
  it("parses bold, italic and nested markup", () => {
    expect(parseInline("a **b *c*** d")).toEqual([
      { kind: "text", text: "a " },
      {
        kind: "strong",
        children: [
          { kind: "text", text: "b " },
          { kind: "em", children: [{ kind: "text", text: "c" }] },
        ],
      },
      { kind: "text", text: " d" },
    ]);
  });

  it("keeps safe links and neutralizes unsafe schemes", () => {
    expect(parseInline("[site](https://example.com)")).toEqual([
      {
        kind: "link",
        href: "https://example.com",
        children: [{ kind: "text", text: "site" }],
      },
    ]);
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { kind: "text", text: "x" },
      { kind: "text", text: ")" },
    ]);
  });

  it("leaves HTML as plain text", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([
      { kind: "text", text: "<img src=x onerror=alert(1)>" },
    ]);
  });

  it("works with right-to-left text", () => {
    expect(parseInline("مدخل **معظم الهجمات**")[1]).toEqual({
      kind: "strong",
      children: [{ kind: "text", text: "معظم الهجمات" }],
    });
  });
});

describe("splitParagraphs", () => {
  it("splits on blank lines", () => {
    expect(splitParagraphs("a\n\n b \n \nc")).toEqual(["a", "b", "c"]);
  });
});

describe("renderInline", () => {
  it("round-trips the markup of every demo string pattern", () => {
    for (const s of [
      "plain",
      "a **b** c",
      "*x* and **y *z***",
      "see [the site](https://example.com) now",
      "مدخل **معظم الهجمات**: نص",
    ])
      expect(renderInline(parseInline(s))).toBe(s);
  });
});
