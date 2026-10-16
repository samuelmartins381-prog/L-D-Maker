import { describe, expect, it } from "vitest";
import { directionOf, interpolate, negotiateLocale } from "./locale.js";

describe("locale", () => {
  it("detects right-to-left scripts", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("he-IL")).toBe("rtl");
    expect(directionOf("fr")).toBe("ltr");
    expect(directionOf("zh-Hans")).toBe("ltr");
  });
  it("negotiates exact tag, then language, then fallback", () => {
    expect(negotiateLocale(["fr", "en-GB", "ar"], "fr", ["en-GB"])).toBe(
      "en-GB",
    );
    expect(negotiateLocale(["fr", "en-GB", "ar"], "fr", ["en-US"])).toBe(
      "en-GB",
    );
    expect(negotiateLocale(["fr", "en"], "fr", [null, "de", undefined])).toBe(
      "fr",
    );
    expect(negotiateLocale(["fr", "ar"], "fr", ["xx", "ar-MA"])).toBe("ar");
  });
  it("interpolates named placeholders", () => {
    expect(
      interpolate("Écran {current} sur {total}", { current: 2, total: 9 }),
    ).toBe("Écran 2 sur 9");
    expect(interpolate("{missing}")).toBe("{missing}");
  });
});
