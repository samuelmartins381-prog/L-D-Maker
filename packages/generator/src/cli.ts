#!/usr/bin/env node
// Generation pipeline (ADR 0013): source → storyboard (Sam's gate) → module → packages.
//   ldm-gen init <dir> --title <t> --audience <a> [--minutes 20] [--locale fr] [--locales fr,en]
//   ldm-gen ingest <dir>          read sources/ into ingest/ (anchored Markdown)
//   ldm-gen generate <dir> [--model m] [--estimate]   Claude writes storyboard.yaml (ANTHROPIC_API_KEY)
//   ldm-gen storyboard <dir>      check storyboard.yaml, write review/storyboard.html
//   ldm-gen write <dir> [--model m] [--estimate]   Claude writes module/ from the approved storyboard
//   ldm-gen translate <dir> [--to de] [--model m]  Claude translates the texts new or changed
//   ldm-gen approve <dir> [--by Sam]   record Sam's approval (only on Sam's explicit go)
//   ldm-gen check <dir>           module/ valid and conform to the approved storyboard
//   ldm-gen build <dir>           check, then build every format and run the QA bench
//   ldm-gen status <dir>
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadModuleSource, validateModule } from "@ldm/schema";
import { approveStoryboard } from "./approval.ts";
import { conformToStoryboard } from "./conform.ts";
import type { GenerationEvent } from "./engine/common.ts";
import { anthropicClient } from "./engine/llm.ts";
import { estimateModule, writeModule } from "./engine/module.ts";
import { DEFAULT_MODEL, MODELS, type ModelId } from "./engine/pricing.ts";
import { estimateStoryboard, generateStoryboard } from "./engine/storyboard.ts";
import {
  estimateTranslations,
  translateModule,
  translationStatus,
} from "./engine/translate.ts";
import { ingestProject, loadIngest, slugify } from "./ingest.ts";
import { paths, saveProject } from "./project.ts";
import { refreshReview } from "./review.ts";
import { projectStatus } from "./status.ts";
import { assertApproved } from "./storyboard.ts";

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
    model: { type: "string" },
    estimate: { type: "boolean", default: false },
    to: { type: "string" },
  },
});
const [command, dir] = positionals;
const usage = (): never => {
  console.error(
    "usage: ldm-gen <init|ingest|generate|storyboard|approve|write|translate|check|build|status> <dir>\n  init: --title <t> --audience <a> [--minutes 20] [--locale fr] [--locales fr,en]",
  );
  process.exit(2);
};
if (!dir) usage();
const project = resolve(dir as string);
/** The studio's domain knowledge, sent with every generation. */
async function knowledge(): Promise<string> {
  const folder = join(ROOT, "docs/knowledge");
  const files = (await readdir(folder).catch(() => [] as string[])).filter(
    (f) => f.endsWith(".md"),
  );
  const texts = await Promise.all(
    files.sort().map((f) => readFile(join(folder, f), "utf8")),
  );
  return texts.join("\n\n");
}

function apiClient() {
  const key =
    process.env.ANTHROPIC_API_KEY ||
    fail("ANTHROPIC_API_KEY manquante (secret d'environnement)");
  const model = (values.model ?? DEFAULT_MODEL) as ModelId;
  if (!(model in MODELS)) fail(`modèle inconnu : ${model}`);
  return { client: anthropicClient(key), model };
}

/** Progress of a generation, on one line. */
function progress(label: string) {
  let shown = 0;
  return (e: GenerationEvent) => {
    if (e.stage === "writing" && e.chars - shown > 2000) {
      shown = e.chars;
      process.stdout.write(
        `\r  ${label}, réponse ${e.round} : ${e.chars} caractères`,
      );
    } else if (e.stage === "checking") {
      shown = 0;
      process.stdout.write(`\n  vérification de la réponse ${e.round}\n`);
    }
  };
}

const fail = (message: string): never => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

/** Checks storyboard.yaml and writes the review page; returns false on errors. */
async function storyboard(): Promise<boolean> {
  const { storyboard: sb, issues } = await refreshReview(project);
  for (const i of issues)
    console.log(
      `${i.severity === "error" ? "✗" : "!"} ${i.where} : ${i.message}`,
    );
  if (!sb || !(await loadIngest(project))) return false;
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
  } else if (command === "generate") {
    const { client, model } = apiClient();
    const k = await knowledge();
    const est = await estimateStoryboard(project, {
      client,
      model,
      knowledge: k,
    });
    console.log(
      `≈ ${est.inputTokens} jetons envoyés ; coût estimé ${est.lowUsd.toFixed(2)} à ${est.highUsd.toFixed(2)} $ (${model})`,
    );
    if (!values.estimate) {
      const r = await generateStoryboard(project, {
        client,
        model,
        knowledge: k,
        onProgress: progress("storyboard"),
      });
      const errors = r.issues.filter((i) => i.severity === "error").length;
      console.log(
        `${errors ? "✗" : "✓"} storyboard écrit en ${r.rounds} réponse(s) : ${errors} erreur(s), ${r.issues.length - errors} point(s) à vérifier ; coût réel ${r.costUsd.toFixed(2)} $`,
      );
      await storyboard();
    }
  } else if (command === "storyboard") {
    if (!(await storyboard())) process.exit(1);
  } else if (command === "write") {
    const { client, model } = apiClient();
    const k = await knowledge();
    const est = await estimateModule(project, { client, model, knowledge: k });
    const tr = await estimateTranslations(project, model);
    console.log(
      `≈ ${est.inputTokens} jetons envoyés ; rédaction ${est.lowUsd.toFixed(2)} à ${est.highUsd.toFixed(2)} $, traductions (${tr.locales.join(", ")}) ${tr.lowUsd.toFixed(2)} à ${tr.highUsd.toFixed(2)} $ (${model})`,
    );
    if (!values.estimate) {
      const r = await writeModule(project, {
        client,
        model,
        knowledge: k,
        onProgress: progress("rédaction"),
      });
      const errors = r.issues.filter((i) => i.severity === "error");
      for (const i of r.issues)
        console.log(
          `${i.severity === "error" ? "✗" : "!"} ${i.where} : ${i.message}`,
        );
      for (const n of r.notes) console.log(`  note : ${n}`);
      console.log(
        `${errors.length ? "✗" : "✓"} module écrit en ${r.rounds} réponse(s) : ${errors.length} erreur(s) ; coût réel ${r.costUsd.toFixed(2)} $`,
      );
    }
  } else if (command === "translate") {
    const { client, model } = apiClient();
    const k = await knowledge();
    const targets = values.to
      ? [values.to]
      : (await translationStatus(project)).map((s) => s.locale);
    for (const locale of targets) {
      const r = await translateModule(project, locale, {
        client,
        model,
        knowledge: k,
        onProgress: progress(locale),
      });
      console.log(
        `\n✓ ${locale} : ${r.translated} texte(s) traduit(s) ; coût ${r.costUsd.toFixed(2)} $`,
      );
    }
  } else if (command === "approve") {
    if (!(await storyboard())) fail("storyboard en erreur : rien n'est validé");
    const { hash } = await approveStoryboard(project, values.by);
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
