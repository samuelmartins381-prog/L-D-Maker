import { describe, expect, it } from "vitest";
import { applyTypography, frenchTypography } from "./typography.ts";

const N = "\u00a0";
const T = "\u202f";

describe("frenchTypography", () => {
  it("puts non-breaking spaces where French typography wants them", () => {
    expect(frenchTypography("Pourquoi ? Voici : un « spiral » !")).toBe(
      `Pourquoi${N}? Voici${N}: un «${N}spiral${N}»${N}!`,
    );
    expect(frenchTypography("«spiral»")).toBe(`«${N}spiral${N}»`);
  });

  it("groups thousands, leaves years alone, binds numbers to units", () => {
    expect(frenchTypography("28800 A/h, 21 600 A/h, depuis 2026")).toBe(
      `28${T}800${N}A/h, 21${T}600${N}A/h, depuis 2026`,
    );
    expect(frenchTypography("En 2026 300 boutiques")).toBe(
      "En 2026 300 boutiques",
    );
    expect(frenchTypography("80 % en 20 min, 5 à 7 ans")).toBe(
      `80${N}% en 20${N}min, 5 à 7${N}ans`,
    );
  });

  it("is idempotent and keeps markup and links", () => {
    const once = frenchTypography(
      "**Note** : voir [le guide](https://x.ch/a?b=1) !",
    );
    expect(once).toBe(`**Note**${N}: voir [le guide](https://x.ch/a?b=1)${N}!`);
    expect(frenchTypography(once)).toBe(once);
  });

  it("only touches French catalogues", () => {
    expect(applyTypography("en", { a: "Why ?" })).toEqual({ a: "Why ?" });
    expect(applyTypography("fr-CH", { a: "Pourquoi ?" })).toEqual({
      a: `Pourquoi${N}?`,
    });
  });
});
