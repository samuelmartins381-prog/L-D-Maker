// QA report: report.json (machine) and report.html (for Sam), next to the screenshots.
import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { CheckResult, Status } from "./types.ts";

export interface Report {
  module: { id: string; version: string; title: string; locales: string[] };
  generatedAt: string;
  durationSeconds: number;
  checks: CheckResult[];
  screenshots: string[];
}

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
const LABEL: Record<Status, string> = {
  pass: "Conforme",
  fail: "Non conforme",
  warn: "À surveiller",
  manual: "Manuel",
};

export function verdict(checks: CheckResult[]): "pass" | "fail" {
  return checks.some((c) => c.status === "fail") ? "fail" : "pass";
}

export async function writeReport(
  dir: string,
  report: Report,
): Promise<string> {
  await writeFile(
    join(dir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const count = (s: Status) =>
    report.checks.filter((c) => c.status === s).length;
  const ok = verdict(report.checks) === "pass";
  const rows = report.checks
    .map(
      (c) => `<article class="check ${c.status}">
  <header><span class="badge">${LABEL[c.status]}</span><h2>${esc(c.title)}</h2></header>
  <p class="criterion">${esc(c.criterion)}</p>
  <p class="summary">${esc(c.summary)}</p>
  ${c.details.length ? `<details${c.status === "fail" ? " open" : ""}><summary>Détails (${c.details.length})</summary><ul>${c.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul></details>` : ""}
</article>`,
    )
    .join("\n");
  // Screenshots are embedded so the report is a single file that can be sent as is.
  const figures: string[] = [];
  for (const f of report.screenshots) {
    const data = (await readFile(f)).toString("base64");
    figures.push(
      `<figure><img src="data:image/png;base64,${data}" alt="" loading="lazy"><figcaption>${esc(basename(f, ".png"))}</figcaption></figure>`,
    );
  }
  const gallery = figures.join("");
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport QA — ${esc(report.module.title)}</title>
<style>
  :root { --bg:#f7f4ee; --surface:#fffdf9; --ink:#1d1b18; --muted:#5c5750; --line:#e3ddd2; --ok:#2d6a45; --ko:#a3362b; --warn:#8a5a00; --manual:#4a4f8a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 960px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 1.75rem; margin: 0 0 4px; }
  .meta { color: var(--muted); margin: 0 0 24px; }
  .verdict { display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:16px 20px; border-radius:12px; background:var(--surface); border:1px solid var(--line); margin-bottom:24px; }
  .verdict strong { font-size:1.25rem; color: ${ok ? "var(--ok)" : "var(--ko)"}; }
  .counts span { margin-inline-end: 16px; color: var(--muted); }
  .check { background:var(--surface); border:1px solid var(--line); border-inline-start:6px solid var(--line); border-radius:10px; padding:16px 20px; margin-bottom:12px; }
  .check.pass { border-inline-start-color: var(--ok); } .check.fail { border-inline-start-color: var(--ko); }
  .check.warn { border-inline-start-color: var(--warn); } .check.manual { border-inline-start-color: var(--manual); }
  .check header { display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; }
  .check h2 { font-size:1.05rem; margin:0; }
  .badge { font-size:.8rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; }
  .pass .badge { color:var(--ok); } .fail .badge { color:var(--ko); } .warn .badge { color:var(--warn); } .manual .badge { color:var(--manual); }
  .criterion { color:var(--muted); margin:4px 0; font-size:.92rem; } .summary { margin:4px 0; font-weight:600; }
  details { margin-top:8px; } li { margin:2px 0; font-size:.9rem; overflow-wrap:anywhere; }
  .gallery { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px; }
  figure { margin:0; } figure img { width:100%; border:1px solid var(--line); border-radius:8px; background:#fff; }
  figcaption { font-size:.8rem; color:var(--muted); text-align:center; }
</style></head>
<body><main>
<h1>Rapport QA — ${esc(report.module.title)}</h1>
<p class="meta">${esc(report.module.id)} v${esc(report.module.version)} · langues : ${esc(report.module.locales.join(", "))} · généré le ${esc(report.generatedAt)} en ${report.durationSeconds} s</p>
<section class="verdict" aria-label="Verdict">
  <strong>${ok ? "Prêt pour la revue humaine" : "Non conforme : à corriger avant livraison"}</strong>
  <span class="counts"><span>${count("pass")} conformes</span><span>${count("fail")} non conformes</span><span>${count("warn")} à surveiller</span><span>${count("manual")} manuels</span></span>
</section>
${rows}
<h2>Captures (mobile, chaque écran, chaque langue)</h2>
<div class="gallery">${gallery}</div>
</main></body></html>
`;
  const file = join(dir, "report.html");
  await writeFile(file, html);
  return file;
}
