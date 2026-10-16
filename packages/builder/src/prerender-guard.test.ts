import { negotiateLocale } from "@ldm/player/locale";
import { describe, expect, it } from "vitest";
import { guardScript, WAIT_CLASS } from "./prerender-guard.ts";

/** Runs the guard with a fake browser; true when it hides the prerender. */
function hides(
  script: string,
  { search = "", languages = [] as string[], saved = null as string | null },
): boolean {
  const classes = new Set<string>();
  const run = new Function(
    "location",
    "navigator",
    "localStorage",
    "document",
    script,
  );
  run(
    { search },
    { languages },
    { getItem: () => saved },
    { documentElement: { classList: { add: (c: string) => classes.add(c) } } },
  );
  return classes.has(WAIT_CLASS);
}

describe("prerender guard", () => {
  const locales = ["fr", "en", "pt-BR", "zh-Hans", "ar"];

  it("negotiates exactly like the player", () => {
    const cases: string[][] = [
      [],
      ["fr-CH"],
      ["en-US", "fr"],
      ["de", "pt-PT"],
      ["ZH-hans"],
      ["zh-Hant-TW"],
      ["ja", "ko"],
      ["AR-EG"],
    ];
    for (const languages of cases) {
      const live = negotiateLocale(locales, "fr", languages);
      const script = guardScript(locales, "fr", null);
      expect(hides(script, { languages })).toBe(live !== "fr");
    }
  });

  it("follows ?lang first, and hides when a resume point is saved (HTML5 only)", () => {
    expect(
      hides(guardScript(locales, "fr", null), {
        search: "?lang=en",
        languages: ["fr"],
      }),
    ).toBe(true);
    expect(
      hides(guardScript(locales, "fr", null), {
        search: "?lang=fr",
        languages: ["en"],
      }),
    ).toBe(false);
    expect(
      hides(guardScript(locales, "fr", "ldm:m@1"), { saved: "2|m@1|fr|3" }),
    ).toBe(true);
    expect(
      hides(guardScript(locales, "fr", null), { saved: "2|m@1|fr|3" }),
    ).toBe(false);
  });
});
