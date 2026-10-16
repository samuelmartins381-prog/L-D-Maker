import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL(".", import.meta.url);
const catalogs = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [
      f.replace(".json", ""),
      JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Record<
        string,
        string
      >,
    ]),
);

describe("player interface catalogs", () => {
  const reference = Object.keys(catalogs.en ?? {}).sort();

  it("include English, the fallback language", () => {
    expect(reference.length).toBeGreaterThan(0);
  });

  for (const [locale, catalog] of Object.entries(catalogs)) {
    it(`${locale} has exactly the same keys as en, all non-empty`, () => {
      expect(Object.keys(catalog).sort()).toEqual(reference);
      for (const [key, value] of Object.entries(catalog))
        expect(value.trim(), key).not.toBe("");
    });

    it(`${locale} keeps the same placeholders as en`, () => {
      const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      for (const key of reference)
        expect(placeholders(catalog[key] ?? ""), key).toEqual(
          placeholders(catalogs.en?.[key] ?? ""),
        );
    });
  }
});
