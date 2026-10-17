// Storyboard generation from the Studio (ADR 0015): the key comes from the keychain, never from the
// shared folder; Sam's common rules, if he wrote some, from regles-maison.md in the projects folder.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  anthropicClient,
  estimateStoryboard,
  generateStoryboard,
  type LlmClient,
  replayClient,
} from "@ldm/generator";
import type {
  GenerationEstimate,
  GenerationProgress,
  GenerationSummary,
} from "../shared/api.ts";
import { assertEditable } from "./projects.ts";
import { getApiKey } from "./settings.ts";

export const HOUSE_RULES_FILE = "regles-maison.md";

async function client(): Promise<LlmClient> {
  // End-to-end tests: a recorded answer instead of the API.
  const fake = process.env.LDM_STUDIO_FAKE_LLM;
  if (fake) return replayClient([await readFile(fake, "utf8")]);
  const key = await getApiKey();
  if (!key) throw new Error("no API key: add it in Settings");
  return anthropicClient(key);
}

async function houseRules(root: string): Promise<string | undefined> {
  return readFile(join(root, HOUSE_RULES_FILE), "utf8").catch(() => undefined);
}

export async function estimate(
  dir: string,
  root: string,
): Promise<GenerationEstimate> {
  const rules = await houseRules(root);
  return estimateStoryboard(dir, {
    client: await client(),
    ...(rules ? { houseRules: rules } : {}),
  });
}

export async function generate(
  dir: string,
  root: string,
  me: string,
  onProgress: (p: GenerationProgress) => void,
): Promise<GenerationSummary> {
  await assertEditable(dir, me);
  const rules = await houseRules(root);
  const r = await generateStoryboard(dir, {
    client: await client(),
    ...(rules ? { houseRules: rules } : {}),
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
