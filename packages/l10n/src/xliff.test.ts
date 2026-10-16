import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportModule, importXliff } from "./module-xliff.ts";
import { readXliff, resolveLinks, writeXliff, XliffError } from "./xliff.ts";

const DEMO = new URL("../../../examples/phishing-basics", import.meta.url)
  .pathname;

/** A throwaway copy of the demo module, so imports can write freely. */
function demoCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "ldm-l10n-"));
  cpSync(DEMO, dir, { recursive: true });
  return dir;
}
const catalog = (dir: string, locale: string) =>
  readFileSync(join(dir, "strings", `${locale}.json`), "utf8");

describe("XLIFF round trip on the demo module", () => {
  for (const version of ["1.2", "2.0"] as const) {
    for (const locale of ["en", "ar"]) {
      it(`exports and re-imports ${locale} unchanged (XLIFF ${version})`, async () => {
        const dir = demoCopy();
        const before = JSON.parse(catalog(dir, locale));
        const { xml, units, translated } = await exportModule(dir, {
          to: locale,
          version,
        });
        expect(translated).toBe(units);
        const report = await importXliff(dir, xml);
        expect(report.errors).toEqual([]);
        expect(report.untranslated).toEqual([]);
        // Same strings, character for character (keys are rewritten in module reading order).
        expect(JSON.parse(catalog(dir, locale))).toEqual(before);
        // A second round trip is byte-identical.
        const once = catalog(dir, locale);
        await importXliff(
          dir,
          (await exportModule(dir, { to: locale, version })).xml,
        );
        expect(catalog(dir, locale)).toBe(once);
      });
    }
  }
});

describe("importXliff", () => {
  it("adds a new locale to module.yaml, keeps its comments, and warns when the player UI is missing", async () => {
    const dir = demoCopy();
    const { xml } = await exportModule(dir, { to: "nl" });
    const translated = xml.replace(
      /<source>(.*?)<\/source>/gs,
      "<source>$1</source><target>NL $1</target>",
    );
    const report = await importXliff(dir, translated);
    expect(report.errors).toEqual([]);
    expect(report.addedLocale).toBe(true);
    const yaml = readFileSync(join(dir, "module.yaml"), "utf8");
    expect(yaml).toContain("# Demo module (non-confidential)");
    expect(yaml).toMatch(/locales:.*nl/s);
    expect(
      report.warnings.some((w) =>
        w.includes("player interface is not translated"),
      ),
    ).toBe(true);
    const nl = JSON.parse(catalog(dir, "nl"));
    expect(nl["s1.welcome.body"]).toMatch(
      /^NL .*\*\*majorité des cyberattaques\*\*/,
    );
  });

  it("restores link URLs from the source and rejects a translation that drops a link", async () => {
    const dir = demoCopy();
    const fr = JSON.parse(catalog(dir, "fr"));
    fr["s1.welcome.body"] =
      "Voir [la charte](https://example.com/charte) et **le guide**.";
    writeFileSync(join(dir, "strings", "fr.json"), JSON.stringify(fr));
    const { xml } = await exportModule(dir, { to: "en" });
    expect(xml).not.toContain("example.com"); // URLs never leave the module
    const ok = xml.replace(
      /(id="s1.welcome.body"[\s\S]*?<source>[\s\S]*?<\/source>)\s*<target[^>]*>[\s\S]*?<\/target>/,
      '$1<target>See <g id="1" ctype="link">the charter</g> and <g id="2" ctype="bold">the guide</g>.</target>',
    );
    const report = await importXliff(dir, ok);
    expect(report.errors).toEqual([]);
    expect(JSON.parse(catalog(dir, "en"))["s1.welcome.body"]).toBe(
      "See [the charter](https://example.com/charte) and **the guide**.",
    );

    const dropped = ok.replace(
      '<g id="1" ctype="link">the charter</g>',
      "the charter",
    );
    const bad = await importXliff(dir, dropped);
    expect(bad.errors[0]).toMatch(/s1.welcome.body: links differ/);
  });

  it("reports untranslated and unknown units and refuses the source language as target", async () => {
    const dir = demoCopy();
    const { xml } = await exportModule(dir, { to: "en" });
    const partial = xml
      .replace(
        /(<trans-unit id="meta.title"[\s\S]*?)<target[^>]*>[\s\S]*?<\/target>/,
        "$1",
      )
      .replace(
        "</body>",
        '<trans-unit id="ghost.key"><source>x</source><target>y</target></trans-unit></body>',
      );
    const report = await importXliff(dir, partial);
    expect(report.untranslated).toEqual(["meta.title"]);
    expect(report.unknown).toEqual(["ghost.key"]);
    // The previous English title is kept: an import never erases existing translations.
    expect(JSON.parse(catalog(dir, "en"))["meta.title"]).toBe(
      "Spotting a phishing email",
    );

    const self = await importXliff(
      dir,
      xml.replace('target-language="en"', 'target-language="fr"'),
    );
    expect(self.errors[0]).toMatch(/source language/);
  });
});

describe("readXliff", () => {
  it("escapes and restores XML special characters", () => {
    const xml = writeXliff({
      version: "2.0",
      srcLang: "fr",
      trgLang: "en",
      original: "m@1",
      units: [
        {
          id: "k",
          source: 'A & B < C > "D"',
          target: "x & <y>",
          notes: ["n & m"],
        },
      ],
    });
    const doc = readXliff(xml);
    expect(doc.units[0]).toEqual({
      id: "k",
      source: 'A & B < C > "D"',
      target: "x & <y>",
      notes: ["n & m"],
    });
  });

  it("unwraps CAT-tool markers and joins segments split by the tool", () => {
    const doc = readXliff(`<?xml version="1.0"?>
<xliff version="2.0" xmlns="urn:oasis:names:tc:xliff:document:2.0" srcLang="fr" trgLang="en">
  <file id="f"><unit id="k">
    <segment><source>Un. </source><target><mrk id="m1" type="term">One</mrk>. </target></segment>
    <segment><source>Deux.</source><target>Two.</target></segment>
  </unit></file></xliff>`);
    expect(doc.units[0]?.target).toBe("One. Two.");
  });

  it("rejects malformed files and unknown versions", () => {
    expect(() => readXliff("<xliff")).toThrow(XliffError);
    expect(() => readXliff('<xliff version="3.0"/>')).toThrow(
      /unsupported XLIFF version/,
    );
  });
});

describe("resolveLinks", () => {
  it("maps link codes to the source URLs by code id", () => {
    const source = "[a](https://a.example) puis [b](https://b.example)";
    expect(resolveLinks("[B](ldm-code:2) then [A](ldm-code:1)", source)).toBe(
      "[B](https://b.example) then [A](https://a.example)",
    );
    expect(resolveLinks("[X](ldm-code:9)", source)).toBeNull();
  });
});
