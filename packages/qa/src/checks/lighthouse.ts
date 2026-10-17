// Lighthouse on the first screen: mobile emulation, slow 4G and 4x CPU slowdown (Lighthouse defaults),
// applied to the browser ("devtools" throttling) and measured, median of RUNS runs. The default
// simulated mode (Lantern) estimates LCP from a dependency graph that counts the player script, which
// the prerendered first screen does not need: it reported ~2.4 s for a page measured at ~0.75 s under
// the same conditions (ADR 0012). Same thresholds; decision approved by Sam on 2026-10-17.
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { CHROMIUM_PATH } from "../browser.ts";
import type { CheckResult } from "../types.ts";

const RUNS = 3;

const median = (values: number[]) =>
  [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)] as number;

export const LIGHTHOUSE_BUDGET = {
  performance: 90,
  accessibility: 100,
  lcpMs: 2500,
  cls: 0.1,
  tbtMs: 200,
  bytes: 500 * 1024,
};

export async function lighthouseChecks(url: string): Promise<CheckResult[]> {
  const chrome = await launch({
    chromePath: CHROMIUM_PATH,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const lhrs: NonNullable<Awaited<ReturnType<typeof lighthouse>>>["lhr"][] =
      [];
    for (let i = 0; i < RUNS; i++) {
      const run = await lighthouse(url, {
        port: chrome.port,
        logLevel: "error",
        output: "json",
        onlyCategories: ["performance", "accessibility", "best-practices"],
        throttlingMethod: "devtools",
      });
      if (!run) throw new Error("Lighthouse returned no result");
      lhrs.push(run.lhr);
    }
    const run = { lhr: lhrs[0] as (typeof lhrs)[number] };
    const { categories, audits } = run.lhr;
    const score = (k: string) => Math.round((categories[k]?.score ?? 0) * 100);
    const num = (k: string) => audits[k]?.numericValue ?? Number.NaN;
    // Timing metrics vary between runs: median. Accessibility and weight do not.
    const med = (k: string) =>
      median(lhrs.map((l) => l.audits[k]?.numericValue ?? Number.NaN));
    const b = LIGHTHOUSE_BUDGET;
    const perf = median(
      lhrs.map((l) => Math.round((l.categories.performance?.score ?? 0) * 100)),
    );
    const a11y = score("accessibility");
    const lcp = med("largest-contentful-paint");
    const cls = med("cumulative-layout-shift");
    const tbt = med("total-blocking-time");
    const bytes = num("total-byte-weight");
    const metrics = [
      `Mesuré (ralentissement appliqué), médiane de ${RUNS} passages`,
      `LCP ${Math.round(lcp)} ms (≤ ${b.lcpMs})`,
      `CLS ${cls.toFixed(3)} (≤ ${b.cls})`,
      `TBT ${Math.round(tbt)} ms (≤ ${b.tbtMs})`,
      `Pratiques recommandées : ${score("best-practices")}`,
    ];
    const failedA11y = Object.values(audits)
      .filter(
        (a) =>
          a.scoreDisplayMode === "binary" &&
          a.score === 0 &&
          run.lhr.categories.accessibility?.auditRefs.some(
            (r) => r.id === a.id,
          ),
      )
      .map((a) => `${a.id} : ${a.title}`);
    return [
      {
        id: "lighthouse-performance",
        title: "Performance mobile (Lighthouse)",
        criterion: `Score ≥ ${b.performance}, LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms (mobile, 4G lente et processeur ×4 appliqués au navigateur)`,
        status:
          perf >= b.performance &&
          lcp <= b.lcpMs &&
          cls <= b.cls &&
          tbt <= b.tbtMs
            ? "pass"
            : "fail",
        summary: `Score ${perf}/100`,
        details: metrics,
      },
      {
        id: "lighthouse-accessibility",
        title: "Accessibilité (Lighthouse)",
        criterion: "Score = 100",
        status: a11y >= b.accessibility ? "pass" : "fail",
        summary: `Score ${a11y}/100`,
        details: failedA11y,
      },
      {
        id: "first-screen-weight",
        title: "Poids du premier écran",
        criterion:
          "≤ 500 Ko transférés au chargement (médias et polices compris)",
        status: bytes <= b.bytes ? "pass" : "fail",
        summary: `${Math.round(bytes / 1024)} Ko transférés`,
        details: [],
      },
    ];
  } finally {
    chrome.kill();
  }
}
