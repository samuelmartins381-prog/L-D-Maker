// Lighthouse on the first screen, mobile emulation with simulated slow 4G (Lighthouse defaults).
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { CHROMIUM_PATH } from "../browser.ts";
import type { CheckResult } from "../types.ts";

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
    const run = await lighthouse(url, {
      port: chrome.port,
      logLevel: "error",
      output: "json",
      onlyCategories: ["performance", "accessibility", "best-practices"],
    });
    if (!run) throw new Error("Lighthouse returned no result");
    const { categories, audits } = run.lhr;
    const score = (k: string) => Math.round((categories[k]?.score ?? 0) * 100);
    const num = (k: string) => audits[k]?.numericValue ?? Number.NaN;
    const b = LIGHTHOUSE_BUDGET;
    const perf = score("performance");
    const a11y = score("accessibility");
    const lcp = num("largest-contentful-paint");
    const cls = num("cumulative-layout-shift");
    const tbt = num("total-blocking-time");
    const bytes = num("total-byte-weight");
    const metrics = [
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
        criterion: `Score ≥ ${b.performance}, LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms (4G simulée, mobile)`,
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
