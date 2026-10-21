// What the storyboard and the module generations share (ADR 0015): the sources as Claude reads
// them, the project choices, the studio's domain knowledge and the generation log.
import { appendFile, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { type IngestIndex, loadIngest, staleSources } from "../ingest.ts";
import { type Project, paths } from "../project.ts";
import { imageSize } from "../readers/image.ts";
import type { ModelId, Usage } from "./pricing.ts";

export const GENERATION_LOG = "generation-log.jsonl";
const MAX_IMAGES = 8;
// API limits: 5 MB per image once in base64, 8000 px per side, 32 MB per request.
const MAX_IMAGE_BYTES = 3_500_000;
const MAX_IMAGE_SIDE = 8000;
const MAX_TOTAL_IMAGE_BYTES = 15_000_000;
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
  | { stage: "writing"; round: number; chars: number; thinking?: boolean }
  | { stage: "checking"; round: number }
  | { stage: "done" };

/** Sources must be read and up to date: the anchors they carry are what the storyboard cites. */
export async function freshIngest(dir: string): Promise<IngestIndex> {
  const ingest = await loadIngest(dir);
  if (!ingest) throw new GenerationError("sources not read yet");
  const stale = await staleSources(dir, ingest);
  if (stale.length)
    throw new GenerationError(
      `sources changed since reading: ${stale.join(", ")}`,
    );
  return ingest;
}

export function choicesText(project: Project, houseRules?: string): string {
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

export async function sourceBlocks(
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
  let total = 0;
  const skipped: string[] = [];
  for (const s of ingest.sources)
    for (const m of s.media) {
      const type = IMAGE_TYPES[extname(m).toLowerCase()];
      if (!type) continue;
      const data = await readFile(join(paths(dir).ingest, m));
      const size = imageSize(data);
      if (
        images >= MAX_IMAGES ||
        !size ||
        data.length > MAX_IMAGE_BYTES ||
        total + data.length > MAX_TOTAL_IMAGE_BYTES ||
        Math.max(size.width, size.height) > MAX_IMAGE_SIDE
      ) {
        skipped.push(`ingest/${m}`);
        continue;
      }
      images++;
      total += data.length;
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
  if (skipped.length)
    blocks.push({
      type: "text",
      text: `Images not sent (count, size or weight limits): ${skipped.join(", ")}. Plan their use from the surrounding text only.`,
    });
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

/** The studio's domain knowledge (docs/knowledge), sent before the sources and cached with them. */
export function knowledgeBlock(
  knowledge?: string,
): Anthropic.ContentBlockParam[] {
  return knowledge?.trim()
    ? [
        {
          type: "text",
          text: `<domain-knowledge>\nReference written for the studio by its watchmaking experts. The brand's sources prevail when they differ on a given calibre.\n\n${knowledge.trim()}\n</domain-knowledge>`,
        },
      ]
    : [];
}

/** One line per generation in generation-log.jsonl: what was asked, of which model, at what cost. */
export async function logGeneration(
  dir: string,
  entry: {
    step: string;
    prompt: string;
    model: ModelId;
    rounds: number;
    usage: Usage;
    costUsd: number;
    errors: number;
    warnings: number;
    locale?: string;
  },
): Promise<void> {
  await appendFile(
    join(dir, GENERATION_LOG),
    `${JSON.stringify({
      at: new Date().toISOString(),
      ...entry,
      costUsd: Number(entry.costUsd.toFixed(4)),
    })}\n`,
  );
}
