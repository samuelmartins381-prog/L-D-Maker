// Review page of a storyboard, for Sam (ADR 0013): self-contained HTML, readable on a phone, in the
// colours of the player theme. Shows what will be built, screen by screen, with the source passages
// behind each block, the checks and the questions Sam is asked to settle.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type IngestIndex, loadIngest } from "./ingest.ts";
import { loadProject, type Project, paths } from "./project.ts";
import {
  excerpt,
  loadStoryboard,
  type PlannedBlock,
  type Storyboard,
  type StoryboardIssue,
  type StoryboardResult,
} from "./storyboard.ts";

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

const BLOOM: Record<string, string> = {
  remember: "Mémoriser",
  understand: "Comprendre",
  apply: "Appliquer",
  analyze: "Analyser",
  evaluate: "Évaluer",
  create: "Créer",
};

function blockLabel(b: PlannedBlock): string {
  if (b.type !== "question")
    return {
      narrative: "Texte",
      accordion: "Accordéon",
      tabs: "Onglets",
      hotspots: "Image à repères",
      summary: "Récapitulatif",
    }[b.type];
  const variant = {
    single: "choix unique",
    multiple: "choix multiple",
    hotspot: "sur image",
    sequence: "remise en ordre",
  }[b.variant ?? "single"];
  return `Question ${variant}${b.scored === false ? " · entraînement" : " · notée"}`;
}

export type ReviewStatus = "pending" | "approved" | "changed";

export interface ReviewInput {
  dir: string;
  project: Project;
  storyboard: Storyboard;
  ingest: IngestIndex;
  issues: StoryboardIssue[];
  hash: string;
  status: ReviewStatus;
}

const STYLE = `
/* Layout: one reading column; screens as numbered cards in course order. Player theme colours. */
:root {
  --bg: #f7f4ee; --surface: #fffdf9; --ink: #1d1b18; --muted: #5c5750; --line: #e3ddd2;
  --accent: #8a4b2a; --accent-soft: #f1e4da; --ok: #2d6a45; --ok-soft: #e3efe6;
  --warn: #8a5a00; --warn-soft: #f7ecd4; --err: #a3362b; --err-soft: #f6e3df;
  --display: "Fraunces", Georgia, serif; --body: "Inter", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #171513; --surface: #201d1a; --ink: #f1ece4; --muted: #b3aba0; --line: #37322c;
  --accent: #e0a37f; --accent-soft: #3a2a20; --ok: #8fd0a6; --ok-soft: #1f3327;
  --warn: #e6c27a; --warn-soft: #3a3020; --err: #f0a198; --err-soft: #3d2420; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #171513; --surface: #201d1a; --ink: #f1ece4; --muted: #b3aba0; --line: #37322c;
  --accent: #e0a37f; --accent-soft: #3a2a20; --ok: #8fd0a6; --ok-soft: #1f3327;
  --warn: #e6c27a; --warn-soft: #3a3020; --err: #f0a198; --err-soft: #3d2420; color-scheme: dark }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 var(--body); }
.page { max-width: 46rem; margin: 0 auto; padding-block: 2rem 4rem;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px));
  display: grid; gap: 2.5rem; }
h1, h2, h3 { font-family: var(--display); font-weight: 500; line-height: 1.2; text-wrap: balance; margin: 0; }
h1 { font-size: clamp(1.8rem, 5vw, 2.6rem); }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.15rem; }
p { margin: 0; }
.eyebrow { font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
.meta { display: flex; flex-wrap: wrap; gap: .4rem 1.2rem; color: var(--muted); font-size: .92rem; }
.pill { display: inline-block; padding: .15rem .6rem; border-radius: 999px; font-size: .8rem; font-weight: 600; }
.pill.pending { background: var(--warn-soft); color: var(--warn); }
.pill.approved { background: var(--ok-soft); color: var(--ok); }
.pill.changed { background: var(--err-soft); color: var(--err); }
header { display: grid; gap: .8rem; }
section { display: grid; gap: 1rem; }
.ask { background: var(--accent-soft); border-radius: 10px; padding: 1.2rem 1.4rem; display: grid; gap: .6rem; }
.ask ol { margin: 0; padding-inline-start: 1.2rem; display: grid; gap: .4rem; }
.objectives { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
.objectives li { display: grid; grid-template-columns: auto 1fr; gap: .2rem .8rem; align-items: baseline; }
.tag { font-size: .75rem; font-weight: 600; letter-spacing: .04em; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: .05rem .4rem; white-space: nowrap; }
.issues { margin: 0; padding: 0; list-style: none; display: grid; gap: .4rem; font-size: .92rem; }
.issues li { padding: .5rem .8rem; border-radius: 6px; }
.issues .error { background: var(--err-soft); color: var(--err); }
.issues .warning { background: var(--warn-soft); color: var(--warn); }
.okline { color: var(--ok); font-weight: 600; }
.screens { counter-reset: screen; display: grid; gap: 1.2rem; }
.screen { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 1.2rem 1.3rem; display: grid; gap: 1rem; min-width: 0; }
.screen-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .3rem 1rem; align-items: baseline; }
.screen-head h3::before { counter-increment: screen; content: counter(screen) ". "; color: var(--accent); }
.minutes { color: var(--muted); font-size: .88rem; font-variant-numeric: tabular-nums; }
.block { border-top: 1px solid var(--line); padding-top: .9rem; display: grid; gap: .45rem; }
.block-head { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; }
.kind { font-weight: 650; }
.role { background: var(--accent-soft); color: var(--accent); }
.label { color: var(--muted); font-size: .85rem; font-weight: 600; margin-inline-end: .3rem; }
.choices { margin: .2rem 0 0; padding: 0; list-style: none; display: grid; gap: .35rem; font-size: .95rem; }
.choices li { display: grid; grid-template-columns: 1.4rem 1fr; gap: .4rem; }
.choices .mark { font-weight: 700; }
.choices .ok { color: var(--ok); }
.choices .no { color: var(--err); }
.choices .seq { color: var(--muted); font-variant-numeric: tabular-nums; }
.miscon { display: block; color: var(--muted); font-size: .88rem; }
details { font-size: .9rem; }
summary { cursor: pointer; color: var(--accent); font-weight: 600; }
summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
blockquote { margin: .5rem 0 0; padding: .5rem .9rem; border-inline-start: 3px solid var(--line); color: var(--muted); }
blockquote cite { display: block; font-style: normal; font-size: .8rem; font-weight: 600; color: var(--ink); margin-bottom: .2rem; }
footer { color: var(--muted); font-size: .8rem; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
code { font-size: .85em; }
`;

async function renderBlock(
  b: PlannedBlock,
  input: ReviewInput,
): Promise<string> {
  const choices = b.choices?.length
    ? `<ul class="choices">${b.choices
        .map((c, i) => {
          const mark =
            b.variant === "sequence"
              ? `<span class="mark seq">${i + 1}.</span>`
              : c.correct
                ? `<span class="mark ok" aria-hidden="true">✓</span>`
                : `<span class="mark no" aria-hidden="true">✗</span>`;
          // The mark is visual only: screen readers get the same information as text.
          const said =
            b.variant === "sequence"
              ? ""
              : `<span class="vh">${c.correct ? "Bonne réponse : " : "Distracteur : "}</span>`;
          const miscon = c.misconception
            ? `<span class="miscon">Idée reçue visée : ${esc(c.misconception)}</span>`
            : "";
          return `<li>${mark}<span>${said}${esc(c.text)}${miscon}</span></li>`;
        })
        .join("")}</ul>`
    : "";
  const quotes = (
    await Promise.all(
      b.sourceRefs.map(async (ref) => {
        const text = await excerpt(input.dir, input.ingest, ref);
        const label = input.ingest.sources
          .flatMap((s) => s.anchors)
          .find((a) => a.id === ref)?.label;
        return `<blockquote><cite>${esc(ref.split("#")[0] ?? ref)} — ${esc(label || ref)}</cite>${esc(text ?? "(passage introuvable)")}</blockquote>`;
      }),
    )
  ).join("");
  return `<div class="block">
  <div class="block-head"><span class="kind">${esc(blockLabel(b))}</span>${
    b.role
      ? `<span class="tag role">${b.role === "worked-example" ? "Exemple travaillé" : "Autorégulation"}</span>`
      : ""
  }${b.objectives.map((o) => `<span class="tag">${esc(o)}</span>`).join("")}</div>
  <p><span class="label">Pourquoi</span>${esc(b.intent)}</p>
  <p><span class="label">Contenu</span>${esc(b.content)}</p>
  ${b.media ? `<p><span class="label">Visuel</span>${esc(b.media)}</p>` : ""}
  ${choices}
  ${quotes ? `<details><summary>Sources (${b.sourceRefs.length})</summary>${quotes}</details>` : ""}
</div>`;
}

/** Page body (the published Artifact gets its own document skeleton). */
export async function renderReviewBody(input: ReviewInput): Promise<string> {
  const { storyboard: sb, project, issues, status } = input;
  const screens = sb.sections.flatMap((s) => s.screens);
  const minutes = screens.reduce((n, s) => n + s.minutes, 0);
  const num = (n: number) =>
    new Intl.NumberFormat(sb.module.defaultLocale).format(n);
  const scored = screens
    .flatMap((s) => s.blocks)
    .filter((b) => b.type === "question" && b.scored !== false).length;
  const statusText = {
    pending: "À valider par Sam",
    approved: "Validé par Sam",
    changed: "Modifié depuis la validation",
  }[status];
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const sections = await Promise.all(
    sb.sections.map(
      async (s) => `<section>
  <h2>${esc(s.title)}</h2>
  ${(
    await Promise.all(
      s.screens.map(
        async (sc) => `<article class="screen">
    <div class="screen-head"><h3>${esc(sc.title)}</h3><span class="minutes">≈ ${num(sc.minutes)} min</span></div>
    ${(await Promise.all(sc.blocks.map((b) => renderBlock(b, input)))).join("\n")}
  </article>`,
      ),
    )
  ).join("\n")}
</section>`,
    ),
  );
  return `<title>Storyboard ${esc(sb.module.title.split(" : ")[0] ?? sb.module.title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..600&family=Inter:wght@400..700&display=swap">
<style>${STYLE}</style>
<div class="page">
<header>
  <p class="eyebrow">Storyboard · ${esc(project.id)}</p>
  <h1>${esc(sb.module.title)}</h1>
  <div class="meta"><span>${esc(sb.module.audience)}</span><span>≈ ${num(minutes)} min prévues (cible ${sb.module.durationMinutes} min)</span><span>${screens.length} écrans · ${scored} questions notées · seuil ${sb.assessment.passingScore} %</span></div>
  <p><span class="pill ${status}">${statusText}</span></p>
</header>
${
  sb.openQuestions.length
    ? `<section class="ask"><h2>Ce que je te demande de trancher</h2><ol>${sb.openQuestions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol></section>`
    : ""
}
<section>
  <h2>Objectifs</h2>
  <ul class="objectives">${sb.objectives
    .map(
      (o) =>
        `<li><span class="tag">${esc(BLOOM[o.bloom] ?? o.bloom)}</span><span><strong>${esc(o.id)}</strong> — ${esc(o.text)}</span></li>`,
    )
    .join("")}</ul>
</section>
<section>
  <h2>Contrôles automatiques</h2>
  ${
    issues.length === 0
      ? `<p class="okline">Tous les contrôles passent (pédagogie, sources, durée).</p>`
      : `<ul class="issues">${[...errors, ...warnings]
          .map(
            (i) =>
              `<li class="${i.severity}">${i.severity === "error" ? "Erreur" : "À vérifier"} · ${esc(i.where)} : ${esc(i.message)}</li>`,
          )
          .join("")}</ul>`
  }
</section>
<div class="screens">
${sections.join("\n")}
</div>
<footer>Empreinte du storyboard : <code>${input.hash.slice(0, 12)}</code> · sources : ${input.ingest.sources.map((s) => esc(s.file)).join(", ")}</footer>
</div>`;
}

/** Standalone file for the project folder (opened locally). */
export async function renderReviewPage(input: ReviewInput): Promise<string> {
  return `<!doctype html>
<html lang="${esc(input.storyboard.module.defaultLocale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
${await renderReviewBody(input)}
</body>
</html>
`;
}

/** Checks storyboard.yaml and rewrites review/storyboard.html; the page is skipped when unreadable. */
export async function refreshReview(dir: string): Promise<StoryboardResult> {
  const project = await loadProject(dir);
  const result = await loadStoryboard(dir);
  const ingest = await loadIngest(dir);
  if (!result.storyboard || !ingest) return result;
  const approval = project.approvals.storyboard;
  const status: ReviewStatus = !approval
    ? "pending"
    : approval.hash === result.hash
      ? "approved"
      : "changed";
  const page = paths(dir).review;
  await mkdir(dirname(page), { recursive: true });
  await writeFile(
    page,
    await renderReviewPage({
      dir,
      project,
      storyboard: result.storyboard,
      ingest,
      issues: result.issues,
      hash: result.hash,
      status,
    }),
  );
  return result;
}
