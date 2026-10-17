#!/usr/bin/env node
// Generation pipeline (ADR 0013): source → storyboard (Sam's gate) → module → packages.
//   ldm-gen init <dir> --title <t> --audience <a> [--minutes 20] [--locale fr] [--locales fr,en]
//   ldm-gen ingest <dir>          read sources/ into ingest/ (anchored Markdown)
//   ldm-gen storyboard <dir>      check storyboard.yaml, write review/storyboard.html
//   ldm-gen approve <dir> [--by Sam]   record Sam's approval (only on Sam's explicit go)
//   ldm-gen check <dir>           module/ valid and conform to the approved storyboard
//   ldm-gen build <dir>           check, then build every format and run the QA bench
//   ldm-gen status <dir>
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadModuleSource, validateModule } from "@ldm/schema";
import { conformToStoryboard } from "./conform.ts";
import { ingestProject, loadIngest, slugify } from "./ingest.ts";
import { loadProject, paths, saveProject } from "./project.ts";
import { renderReviewPage } from "./review.ts";
import { projectStatus } from "./status.ts";
import { assertApproved, loadStoryboard } from "./storyboard.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: "string" },
    audience: { type: "string" },
    minutes: { type: "string", default: "20" },
    locale: { type: "string", default: "fr" },
    locales: { type: "string" },
    by: { type: "string", default: "Sam" },
  },
});
const [command, dir] = positionals;
const usage = (): never => {
  console.error(
    "usage: ldm-gen <init|ingest|storyboard|approve|check|build|status> <dir>\n  init: --title <t> --audience <a> [--minutes 20] [--locale fr] [--locales fr,en]",
  );
  process.exit(2);
};
if (!dir) usage();
const project = resolve(dir as string);
const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

/** Checks storyboard.yaml and writes the review page; returns false on errors. */
async function storyboard(): Promise<boolean> {
  const p = await loadProject(project);
  const { storyboard: sb, issues, hash } = await loadStoryboard(project);
  for (const i of issues)
    console.log(
      `${i.severity === "error" ? "✗" : "!"} ${i.where} : ${i.message}`,
    );
  const ingest = await loadIngest(project);
  if (!sb || !ingest) return false;
  const approval = p.approvals.storyboard;
  const status = !approval
    ? "pending"
    : approval.hash === hash
      ? "approved"
      : "changed";
  const page = paths(project).review;
  await mkdir(dirname(page), { recursive: true });
  await writeFile(
    page,
    await renderReviewPage({
      dir: project,
      project: p,
      storyboard: sb,
      ingest,
      issues,
      hash,
      status,
    }),
  );
  const errors = issues.filter((i) => i.severity === "error").length;
  console.log(
    `${errors ? "✗" : "✓"} storyboard : ${errors} erreur(s), ${issues.length - errors} point(s) à vérifier → ${dir}/review/storyboard.html`,
  );
  return errors === 0;
}

/** Module valid and conform to the approved storyboard. */
async function check(): Promise<void> {
  const sb = await assertApproved(project);
  const result = validateModule(await loadModuleSource(paths(project).module));
  for (const i of result.issues)
    console.log(
      `${i.severity === "error" ? "✗" : "!"} ${i.path} : ${i.message}`,
    );
  if (!result.ok || !result.module) return fail("module invalide");
  const gaps = conformToStoryboard(result.module, sb);
  for (const g of gaps) console.log(`✗ ${g.where} : ${g.message}`);
  if (gaps.length) fail(`${gaps.length} écart(s) avec le storyboard validé`);
  console.log("✓ module valide et conforme au storyboard validé");
}

const node = (script: string, args: string[]) => {
  const r = spawnSync(process.execPath, [resolve(ROOT, script), ...args], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) fail(`${basename(script)} a échoué`);
};

try {
  if (command === "init") {
    if (!values.title || !values.audience) usage();
    await mkdir(paths(project).sources, { recursive: true });
    await saveProject(project, {
      schemaVersion: "0.2",
      id: slugify(basename(project)),
      title: values.title as string,
      audience: values.audience as string,
      durationMinutes: Number(values.minutes),
      defaultLocale: values.locale,
      locales: values.locales?.split(",") ?? [values.locale],
      approvals: {},
    });
    console.log(
      `✓ ${dir}: projet créé. Déposez les sources dans ${dir}/sources/`,
    );
  } else if (command === "ingest") {
    const index = await ingestProject(project);
    for (const s of index.sources)
      console.log(
        `✓ ${s.file} → ingest/${s.markdown} (${s.words} mots, ${s.anchors.length} ancres, ${s.media.length} média(s))`,
      );
    console.log(
      `  Total : ${index.words} mots, ~${index.readingMinutes} min de lecture`,
    );
  } else if (command === "storyboard") {
    if (!(await storyboard())) process.exit(1);
  } else if (command === "approve") {
    if (!(await storyboard())) fail("storyboard en erreur : rien n'est validé");
    const p = await loadProject(project);
    const { hash } = await loadStoryboard(project);
    p.approvals.storyboard = {
      hash,
      at: new Date().toISOString().slice(0, 10),
      by: values.by,
    };
    await saveProject(project, p);
    await storyboard(); // the review page now shows "approved"
    console.log(
      `✓ storyboard validé par ${values.by} (empreinte ${hash.slice(0, 12)})`,
    );
  } else if (command === "check") {
    await check();
  } else if (command === "build") {
    await check();
    const module = paths(project).module;
    node("packages/builder/src/cli.ts", [module, "--format", "all"]);
    node("packages/qa/src/cli.ts", [module]);
  } else if (command === "status") {
    const icon = { done: "✓", todo: "→", blocked: "·" };
    for (const s of await projectStatus(project))
      console.log(`${icon[s.state]} ${s.name} — ${s.detail}`);
  } else usage();
} catch (e) {
  fail((e as Error).message);
}
