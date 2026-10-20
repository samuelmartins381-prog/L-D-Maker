// Generations from the Studio (ADR 0015): storyboard, module, translations. The key comes from the
// keychain, never from the shared folder; Sam's common rules, if he wrote some, from regles-maison.md
// in the projects folder; the studio's domain knowledge is built into the application.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  anthropicClient,
  DEFAULT_MODEL,
  estimateModule as estimateModuleCost,
  estimateStoryboard,
  estimateTranslations,
  generateStoryboard,
  type LlmClient,
  replayClient,
  translateModule as translateInto,
  translationStatus,
  writeModule as writeModuleWithClaude,
} from "@ldm/generator";
import knowledge from "../../../../docs/knowledge/mouvement-mecanique.md?raw";
import type {
  GenerationEstimate,
  GenerationProgress,
  GenerationSummary,
  ModuleEstimate,
  ModuleWriteSummary,
  TranslationSummary,
} from "../shared/api.ts";
import { assertEditable } from "./projects.ts";
import { getApiKey } from "./settings.ts";

export const HOUSE_RULES_FILE = "regles-maison.md";

type Step = "storyboard" | "module" | "translate";

/** End-to-end tests: recorded answers instead of the API, one file per step. */
const FAKE: Record<Step, string | undefined> = {
  storyboard: process.env.LDM_STUDIO_FAKE_LLM,
  module: process.env.LDM_STUDIO_FAKE_LLM_MODULE,
  translate: process.env.LDM_STUDIO_FAKE_LLM_TRANSLATE,
};

async function client(step: Step): Promise<LlmClient> {
  const fake = FAKE[step];
  if (fake) return replayClient([await readFile(fake, "utf8")]);
  const key = await getApiKey();
  if (!key) throw new Error("no API key: add it in Settings");
  return anthropicClient(key);
}

async function common(root: string) {
  const rules = await readFile(join(root, HOUSE_RULES_FILE), "utf8").catch(
    () => undefined,
  );
  return { knowledge, ...(rules ? { houseRules: rules } : {}) };
}

export async function estimate(
  dir: string,
  root: string,
): Promise<GenerationEstimate> {
  return estimateStoryboard(dir, {
    client: await client("storyboard"),
    ...(await common(root)),
  });
}

export async function generate(
  dir: string,
  root: string,
  me: string,
  onProgress: (p: GenerationProgress) => void,
): Promise<GenerationSummary> {
  await assertEditable(dir, me);
  const r = await generateStoryboard(dir, {
    client: await client("storyboard"),
    ...(await common(root)),
    onProgress,
  });
  const errors = r.issues.filter((i) => i.severity === "error").length;
  return {
    rounds: r.rounds,
    errors,
    warnings: r.issues.length - errors,
    costUsd: r.costUsd,
  };
}

export async function estimateModule(
  dir: string,
  root: string,
): Promise<ModuleEstimate> {
  const e = await estimateModuleCost(dir, {
    client: await client("module"),
    ...(await common(root)),
  });
  const t = await estimateTranslations(dir, DEFAULT_MODEL);
  return {
    ...e,
    translationLocales: t.locales,
    translationLowUsd: t.lowUsd,
    translationHighUsd: t.highUsd,
  };
}

/** Every project language with texts left to translate. */
export async function translateAll(
  dir: string,
  root: string,
  me: string,
  onProgress: (p: GenerationProgress) => void,
): Promise<TranslationSummary> {
  await assertEditable(dir, me);
  const { knowledge: k } = await common(root);
  const out: TranslationSummary = { translated: [], costUsd: 0 };
  for (const s of await translationStatus(dir)) {
    if (!s.pending) continue;
    const r = await translateInto(dir, s.locale, {
      client: await client("translate"),
      knowledge: k,
      onProgress: (e) =>
        onProgress(e.stage === "done" ? e : { ...e, locale: s.locale }),
    });
    out.translated.push({ locale: s.locale, texts: r.translated });
    out.costUsd += r.costUsd;
  }
  return out;
}

export async function writeModule(
  dir: string,
  root: string,
  me: string,
  onProgress: (p: GenerationProgress) => void,
): Promise<ModuleWriteSummary> {
  await assertEditable(dir, me);
  const r = await writeModuleWithClaude(dir, {
    client: await client("module"),
    ...(await common(root)),
    onProgress: (e) => {
      if (e.stage !== "done") onProgress(e);
    },
  });
  const errors = r.issues.filter((i) => i.severity === "error").length;
  // Translating a module that still has errors would translate them too.
  const t = errors
    ? { translated: [], costUsd: 0 }
    : await translateAll(dir, root, me, onProgress);
  onProgress({ stage: "done" });
  return {
    rounds: r.rounds,
    errors,
    warnings: r.issues.length - errors,
    notes: r.notes,
    translated: t.translated.map((x) => x.locale),
    costUsd: r.costUsd + t.costUsd,
  };
}
