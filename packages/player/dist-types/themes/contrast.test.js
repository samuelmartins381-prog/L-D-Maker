import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG 2.2 relative luminance and contrast ratio.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
// Text/background pairs used by components, with the minimum ratio each must meet.
const PAIRS = [
  ["--color-ink", "--color-bg", 4.5],
  ["--color-ink", "--color-surface", 4.5],
  ["--color-ink-muted", "--color-bg", 4.5],
  ["--color-ink-muted", "--color-surface", 4.5],
  ["--color-accent", "--color-bg", 4.5],
  ["--color-accent", "--color-surface", 4.5],
  ["--color-ink", "--color-accent-soft", 4.5],
  ["--color-accent-ink", "--color-accent", 4.5],
  ["--color-surface", "--color-ink", 4.5],
  ["--color-focus", "--color-bg", 3], // non-text contrast (focus indicator)
];
const dir = new URL(".", import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith(".css"))) {
  const css = readFileSync(new URL(file, dir), "utf8");
  const vars = Object.fromEntries(
    [...css.matchAll(/(--color-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  describe(`theme ${file}`, () => {
    for (const [fg, bg, min] of PAIRS) {
      it(`${fg} on ${bg} ≥ ${min}:1`, () => {
        const a = vars[fg];
        const b = vars[bg];
        expect(
          a && b,
          `${fg} and ${bg} must be defined as #rrggbb`,
        ).toBeTruthy();
        expect(contrast(a, b)).toBeGreaterThanOrEqual(min);
      });
    }
  });
}
