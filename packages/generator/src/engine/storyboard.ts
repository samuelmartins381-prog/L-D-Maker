// Storyboard generation by Claude (ADR 0015): the ingested sources, the brief and Sam's choices go
// in; a storyboard comes out, checked by the same rules as a hand-written one. Problems found are
// sent back for correction, up to `maxRounds` answers in all. The result is written as
// storyboard.yaml, which Sam reviews, edits and approves: nothing here approves anything.
import { appendFile, copyFile, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { stringify } from "yaml";
import { type IngestIndex, loadIngest, staleSources } from "../ingest.ts";
import { loadProject, type Project, paths } from "../project.ts";
import { refreshReview } from "../review.ts";
import {
  checkStoryboard,
  Storyboard,
  type StoryboardIssue,
} from "../storyboard.ts";
import type { LlmCall, LlmClient } from "./llm.ts";
import {
  addUsage,
  cost,
  DEFAULT_MODEL,
  type ModelId,
  type Usage,
  ZERO_USAGE,
} from "./pricing.ts";
import { STORYBOARD_PROMPT_VERSION, STORYBOARD_SYSTEM } from "./prompts.ts";

/** What Claude writes: the storyboard without the parts taken from project.yaml. */
export const StoryboardDraft = Storyboard.omit({
  schemaVersion: true,
  module: true,
});
const SCHEMA = zodOutputFormat(StoryboardDraft).schema as Record<
  string,
  unknown
>;

export const GENERATION_LOG = "generation-log.jsonl";
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 3_500_000;
const IMAGE_TYPES: Record<
  string,
  "image/png" | "image/jpeg" | "image/gif" | "image/webp"
> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export class GenerationError extends Error {}

export type GenerationEvent =
  | { stage: "writing"; round: number; chars: number }
  | { stage: "checking"; round: number }
  | { stage: "done" };

export interface GenerateOptions {
  client: LlmClient;
  model?: ModelId;
  /** Sam's common rules for every module ("what I never want to see"), if any. */
  houseRules?: string;
  /** Answers allowed in all, the first included. */
  maxRounds?: number;
  onProgress?: (e: GenerationEvent) => void;
}

export interface GenerationResult {
  storyboard: Storyboard;
  issues: StoryboardIssue[];
  rounds: number;
  model: ModelId;
  usage: Usage;
  costUsd: number;
}

export interface Estimate {
  model: ModelId;
  inputTokens: number;
  /** One answer, short. */
  lowUsd: number;
  /** Three answers (two corrections), long. */
  highUsd: number;
}

/** Sources must be read and up to date: the anchors they carry are what the storyboard cites. */
async function freshIngest(dir: string): Promise<IngestIndex> {
  const ingest = await loadIngest(dir);
  if (!ingest) throw new GenerationError("sources not read yet");
  const stale = await staleSources(dir, ingest);
  if (stale.length)
    throw new GenerationError(
      `sources changed since reading: ${stale.join(", ")}`,
    );
  return ingest;
}

function choicesText(project: Project, houseRules?: string): string {
  const a = project.assessment;
  return [
    "# Project",
    `Title: ${project.title}`,
    project.client ? `Brand or client: ${project.client}` : "",
    `Audience: ${project.audience}`,
    `Target duration: ${project.durationMinutes} minutes`,
    `Writing language (defaultLocale): ${project.defaultLocale}; translations planned: ${project.locales.join(", ")}`,
    `Address the learner: ${project.formality === "formal" ? "formally (vous, Sie, usted…)" : "informally (tu, du, tú…)"}`,
    `Question types allowed: ${a.questionTypes.join(", ")}`,
    `Scored questions per objective: at least ${a.questionsPerObjective}`,
    `Passing score: ${a.passingScore} %`,
    `Attempts per question: ${a.attempts}`,
    `Animation level: ${project.animation}`,
    `Delivered to: ${project.outputs.map((o) => o.profile).join(", ")}`,
    project.brief ? `\n# Brief from the brand\n${project.brief}` : "",
    houseRules?.trim()
      ? `\n# Studio rules for every module (must be respected)\n${houseRules.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sourceBlocks(
  dir: string,
  ingest: IngestIndex,
): Promise<Anthropic.ContentBlockParam[]> {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const s of ingest.sources) {
    const md = await readFile(join(paths(dir).ingest, s.markdown), "utf8");
    blocks.push({
      type: "text",
      text: `<source file="${s.file}">\n${md}\n</source>`,
    });
  }
  let images = 0;
  for (const s of ingest.sources)
    for (const m of s.media) {
      const type = IMAGE_TYPES[extname(m).toLowerCase()];
      if (!type || images >= MAX_IMAGES) continue;
      const data = await readFile(join(paths(dir).ingest, m));
      if (data.length > MAX_IMAGE_BYTES) continue;
      images++;
      blocks.push(
        { type: "text", text: `Image ingest/${m} (from ${s.file}):` },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: type,
            data: data.toString("base64"),
          },
        },
      );
    }
  const anchors = ingest.sources
    .flatMap((s) => s.anchors.map((a) => `- ${a.id} — ${a.label}`))
    .join("\n");
  // The sources are the long, stable part: cached for the correction rounds.
  blocks.push({
    type: "text",
    text: `# Source anchors (the only valid sourceRefs)\n${anchors}`,
    cache_control: { type: "ephemeral" },
  });
  return blocks;
}

async function firstCall(
  dir: string,
  model: ModelId,
  houseRules?: string,
): Promise<{ call: LlmCall; project: Project; ingest: IngestIndex }> {
  const project = await loadProject(dir);
  const ingest = await freshIngest(dir);
  const content: Anthropic.ContentBlockParam[] = [
    ...(await sourceBlocks(dir, ingest)),
    {
      type: "text",
      text: `${choicesText(project, houseRules)}\n\nWrite the storyboard of this module.`,
    },
  ];
  return {
    project,
    ingest,
    call: {
      model,
      system: STORYBOARD_SYSTEM,
      messages: [{ role: "user", content }],
      schema: SCHEMA,
      maxTokens: 64_000,
    },
  };
}

/** Price range before generating, from the exact size of what will be sent. */
export async function estimateStoryboard(
  dir: string,
  options: Pick<GenerateOptions, "client" | "model" | "houseRules">,
): Promise<Estimate> {
  const model = options.model ?? DEFAULT_MODEL;
  const { call } = await firstCall(dir, model, options.houseRules);
  const inputTokens = await options.client.countTokens(call);
  return {
    model,
    inputTokens,
    lowUsd: cost(model, { input_tokens: inputTokens, output_tokens: 8_000 }),
    highUsd: cost(model, {
      input_tokens: 0,
      cache_creation_input_tokens: inputTokens,
      cache_read_input_tokens: 2 * inputTokens,
      output_tokens: 3 * 24_000,
    }),
  };
}

function describe(issues: StoryboardIssue[]): string {
  return issues
    .map((i) => `- [${i.severity}] ${i.code} at ${i.where}: ${i.message}`)
    .join("\n");
}

export async function generateStoryboard(
  dir: string,
  options: GenerateOptions,
): Promise<GenerationResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const maxRounds = options.maxRounds ?? 3;
  const { call, project, ingest } = await firstCall(
    dir,
    model,
    options.houseRules,
  );
  let usage = ZERO_USAGE;
  let best: { storyboard: Storyboard; issues: StoryboardIssue[] } | undefined;
  let round = 0;

  while (round < maxRounds) {
    round++;
    const answer = await options.client.complete(call, (chars) =>
      options.onProgress?.({ stage: "writing", round, chars }),
    );
    usage = addUsage(usage, answer.usage);
    options.onProgress?.({ stage: "checking", round });
    if (answer.stopReason === "max_tokens")
      throw new GenerationError(
        "the answer was cut off (too long); try a shorter scope",
      );

    let issues: StoryboardIssue[];
    let json: unknown;
    try {
      json = JSON.parse(answer.text);
    } catch {
      json = undefined;
    }
    const draft = StoryboardDraft.safeParse(json);
    if (!draft.success) {
      issues = draft.error.issues.map((i) => ({
        severity: "error",
        code: "schema",
        where: i.path.join("."),
        message: i.message,
      }));
    } else {
      const storyboard: Storyboard = {
        schemaVersion: "0.1",
        module: {
          id: project.id,
          title: project.title,
          audience: project.audience,
          durationMinutes: project.durationMinutes,
          defaultLocale: project.defaultLocale,
        },
        ...draft.data,
      };
      issues = checkStoryboard(storyboard, ingest, project);
      const errors = (list: StoryboardIssue[]) =>
        list.filter((i) => i.severity === "error").length;
      // Keep the best answer so far: fewest errors, then fewest warnings.
      if (
        !best ||
        errors(issues) < errors(best.issues) ||
        (errors(issues) === errors(best.issues) &&
          issues.length < best.issues.length)
      )
        best = { storyboard, issues };
    }
    if (issues.length === 0 || round === maxRounds) break;
    call.messages.push(
      { role: "assistant", content: answer.content },
      {
        role: "user",
        content: `The automatic checks found these problems:\n${describe(issues)}\n\nFix them all and answer with the complete corrected storyboard.`,
      },
    );
  }

  if (!best)
    throw new GenerationError(
      `no valid storyboard after ${round} answer(s); nothing was written`,
    );
  const header = `# Storyboard generated by Claude (${model}, prompt ${STORYBOARD_PROMPT_VERSION}) on ${new Date().toISOString().slice(0, 10)}.\n# Edit freely: Sam reviews and approves it (pnpm gen approve, or the Studio).\n`;
  // The storyboard it replaces (possibly edited by Sam) is kept next to it.
  await copyFile(
    paths(dir).storyboard,
    join(dir, "storyboard.previous.yaml"),
  ).catch(() => {});
  await writeFile(paths(dir).storyboard, header + stringify(best.storyboard));
  const result: GenerationResult = {
    storyboard: best.storyboard,
    issues: best.issues,
    rounds: round,
    model,
    usage,
    costUsd: cost(model, usage),
  };
  await appendFile(
    join(dir, GENERATION_LOG),
    `${JSON.stringify({
      at: new Date().toISOString(),
      step: "storyboard",
      prompt: STORYBOARD_PROMPT_VERSION,
      model,
      rounds: round,
      usage,
      costUsd: Number(result.costUsd.toFixed(4)),
      errors: best.issues.filter((i) => i.severity === "error").length,
      warnings: best.issues.filter((i) => i.severity === "warning").length,
    })}\n`,
  );
  await refreshReview(dir);
  options.onProgress?.({ stage: "done" });
  return result;
}
