import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MODULE_LOCALES, THEMES } from "../shared/api.ts";
import en from "./ui/en.json";
import fr from "./ui/fr.json";

const PLAYER = new URL("../../../player/src/", import.meta.url).pathname;

describe("Studio interface texts", () => {
  it("has the same keys in every language, none empty", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const catalogue of [fr, en])
      for (const [k, v] of Object.entries(catalogue)) expect(v, k).not.toBe("");
  });

  it("names every module language, theme and profile it offers", async () => {
    const { PROFILE_IDS } = await import("@ldm/builder/profiles");
    for (const key of [
      ...MODULE_LOCALES.map((l) => `locale.${l}`),
      ...THEMES.flatMap((t) => [`theme.${t}`, `theme.${t}.help`]),
      ...PROFILE_IDS.map((p) => `profile.${p}`),
    ])
      expect(fr, key).toHaveProperty([key]);
  });
});

describe("what the Studio offers matches the player", () => {
  it("offers the themes of the player", () => {
    const themes = readdirSync(`${PLAYER}themes`)
      .filter((f) => f.endsWith(".css"))
      .map((f) => f.replace(/\.css$/, ""));
    expect([...THEMES].sort()).toEqual(themes.sort());
  });

  it("offers only languages with a player interface catalogue (regional ones fall back)", () => {
    const catalogues = readdirSync(`${PLAYER}ui`)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
    for (const l of MODULE_LOCALES)
      expect(catalogues, l).toContain(l.split("-")[0]);
  });
});
