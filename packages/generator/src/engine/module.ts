// Module writing by Claude (ADR 0015, addendum): from the storyboard Sam approved, the sources and
// the project choices, Claude writes every text of the module in the default language. The draft is
// turned into module.yaml + strings/<locale>.json by code, then checked like a hand-written module
// (schema, pedagogy, conformity to the storyboard); problems go back for correction.
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { type Module, validateModule } from "@ldm/schema";
import { parse, stringify } from "yaml";
import { conformToStoryboard } from "../conform.ts";
import { DraftError, draftToModule, ModuleDraft } from "../draft.ts";
import { loadProject, paths } from "../project.ts";
import { assertApproved } from "../storyboard.ts";
import { applyTypography } from "../typography.ts";
import {
  choicesText,
  freshIngest,
  GenerationError,
  type GenerationEvent,
  knowledgeBlock,
  logGeneration,
  sourceBlocks,
} from "./common.ts";
import type { LlmCall, LlmClient } from "./llm.ts";
import {
  addUsage,
  cost,
  DEFAULT_MODEL,
  type ModelId,
  type Usage,
  ZERO_USAGE,
} from "./pricing.ts";
import { MODULE_PROMPT_VERSION, MODULE_SYSTEM } from "./prompts.ts";

const SCHEMA = zodOutputFormat(ModuleDraft).schema as Record<string, unknown>;

export interface ModuleIssue {
  severity: "error" | "warning";
  where: string;
  message: string;
}

export interface WriteOptions {
  client: LlmClient;
  model?: ModelId;
  knowledge?: string;
  houseRules?: string;
  maxRounds?: number;
  onProgress?: (e: GenerationEvent) => void;
}

export interface WriteResult {
  module: Module;
  issues: ModuleIssue[];
  /** Claude's notes for Sam (missing image, assumption…). */
  notes: string[];
  rounds: number;
  model: ModelId;
  usage: Usage;
  costUsd: number;
}

const exists = (f: string) =>
  access(f).then(
    () => true,
    () => false,
  );

async function firstCall(
  dir: string,
  model: ModelId,
  houseRules?: string,
  knowledge?: string,
) {
  const storyboard = await assertApproved(dir);
  const project = await loadProject(dir);
  const ingest = await freshIngest(dir);
  const content: Anthropic.ContentBlockParam[] = [
    ...knowledgeBlock(knowledge),
    ...(await sourceBlocks(dir, ingest)),
    {
      type: "text",
      text: `${choicesText(project, houseRules)}\n\n# Approved storyboard (the contract)\n${stringify(storyboard)}\nWrite the complete module.`,
    },
  ];
  const call: LlmCall = {
    model,
    system: MODULE_SYSTEM,
    messages: [{ role: "user", content }],
    schema: SCHEMA,
    // Thinking and a 20-minute module with feedback on every choice: room for both.
    maxTokens: 128_000,
  };
  return { call, project, storyboard };
}

/** Price range of writing the module, from the exact size of what will be sent. */
export async function estimateModule(
  dir: string,
  options: Pick<WriteOptions, "client" | "model" | "houseRules" | "knowledge">,
) {
  const model = options.model ?? DEFAULT_MODEL;
  const { call } = await firstCall(
    dir,
    model,
    options.houseRules,
    options.knowledge,
  );
  const inputTokens = await options.client.countTokens(call);
  return {
    model,
    inputTokens,
    lowUsd: cost(model, { input_tokens: inputTokens, output_tokens: 20_000 }),
    highUsd: cost(model, {
      input_tokens: 0,
      cache_creation_input_tokens: inputTokens,
      cache_read_input_tokens: 2 * inputTokens,
      output_tokens: 3 * 45_000,
    }),
  };
}

const describe = (issues: ModuleIssue[]) =>
  issues.map((i) => `- [${i.severity}] ${i.where}: ${i.message}`).join("\n");

/** Checks one answer; the module and its catalogue when the draft could be converted. */
async function check(
  dir: string,
  text: string,
  frame: Parameters<typeof draftToModule>[1],
  storyboard: Awaited<ReturnType<typeof assertApproved>>,
) {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  const draft = ModuleDraft.safeParse(json);
  if (!draft.success)
    return {
      issues: draft.error.issues.map(
        (i): ModuleIssue => ({
          severity: "error",
          where: i.path.join("."),
          message: i.message,
        }),
      ),
    };
  let converted: ReturnType<typeof draftToModule>;
  try {
    converted = draftToModule(draft.data, frame);
  } catch (e) {
    if (!(e instanceof DraftError)) throw e;
    return {
      issues: [
        { severity: "error", where: "ids", message: e.message } as ModuleIssue,
      ],
    };
  }
  const issues: ModuleIssue[] = [];
  for (const c of converted.copies)
    if (!(await exists(join(dir, c.from))))
      issues.push({
        severity: "error",
        where: c.from,
        message:
          "no such image: use only the image paths listed with the sources",
      });
  const strings = applyTypography(frame.defaultLocale, converted.strings);
  const validation = validateModule({
    module: converted.module,
    strings: { [frame.defaultLocale]: strings },
    mediaFiles: converted.copies.map((c) => c.to),
  });
  issues.push(
    ...validation.issues.map((i) => ({
      severity: i.severity,
      where: i.path,
      message: `${i.code}: ${i.message}`,
    })),
    ...conformToStoryboard(converted.module, storyboard).map(
      (i): ModuleIssue => ({
        severity: "error",
        where: i.where,
        message: `differs from the approved storyboard: ${i.message}`,
      }),
    ),
  );
  return {
    issues,
    converted: { ...converted, strings },
    notes: draft.data.notes,
  };
}

/** Version of the new module: 1.0.0, or the previous one with its minor number raised. */
async function nextVersion(moduleDir: string): Promise<string> {
  try {
    const previous = parse(
      await readFile(join(moduleDir, "module.yaml"), "utf8"),
    ) as { version?: string };
    const [major, minor] = (previous.version ?? "1.0.0").split(".").map(Number);
    return `${major ?? 1}.${(minor ?? 0) + 1}.0`;
  } catch {
    return "1.0.0";
  }
}

export async function writeModule(
  dir: string,
  options: WriteOptions,
): Promise<WriteResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const maxRounds = options.maxRounds ?? 3;
  const { call, project, storyboard } = await firstCall(
    dir,
    model,
    options.houseRules,
    options.knowledge,
  );
  const moduleDir = paths(dir).module;
  const frame = {
    id: project.id,
    version: await nextVersion(moduleDir),
    defaultLocale: project.defaultLocale,
    // Other languages are added as they are translated: the module stays valid at every step.
    locales: [project.defaultLocale],
    durationMinutes: project.durationMinutes,
    passingScore: storyboard.assessment.passingScore,
    completion: "all-screens-and-passed" as const,
    bloom: Object.fromEntries(
      storyboard.objectives.map((o) => [o.id, o.bloom]),
    ),
  };

  let usage = ZERO_USAGE;
  let best: Awaited<ReturnType<typeof check>> | undefined;
  let round = 0;
  const errors = (list: ModuleIssue[]) =>
    list.filter((i) => i.severity === "error").length;
  while (round < maxRounds) {
    round++;
    const answer = await options.client.complete(call, (chars) =>
      options.onProgress?.({ stage: "writing", round, chars }),
    );
    usage = addUsage(usage, answer.usage);
    options.onProgress?.({ stage: "checking", round });
    if (answer.stopReason === "max_tokens")
      throw new GenerationError(
        "the answer was cut off (too long); shorten the storyboard",
      );
    const result = await check(dir, answer.text, frame, storyboard);
    if (
      result.converted &&
      (!best?.converted ||
        errors(result.issues) < errors(best.issues) ||
        (errors(result.issues) === errors(best.issues) &&
          result.issues.length < best.issues.length))
    )
      best = result;
    if (result.issues.length === 0 || round === maxRounds) break;
    call.messages.push(
      { role: "assistant", content: answer.content },
      {
        role: "user",
        content: `The automatic checks found these problems:\n${describe(result.issues)}\n\nFix them all and answer with the complete corrected module.`,
      },
    );
  }
  if (!best?.converted)
    throw new GenerationError(
      `no usable module after ${round} answer(s); nothing was written`,
    );

  // The module it replaces (possibly edited by Sam) is kept next to it.
  const previous = join(dir, "module.previous");
  if (await exists(moduleDir)) {
    await rm(previous, { recursive: true, force: true });
    await rename(moduleDir, previous);
  }
  const { module, strings, copies } = best.converted;
  await mkdir(join(moduleDir, "strings"), { recursive: true });
  for (const c of copies) {
    await mkdir(dirname(join(moduleDir, c.to)), { recursive: true });
    await copyFile(join(dir, c.from), join(moduleDir, c.to));
  }
  await writeFile(
    join(moduleDir, "module.yaml"),
    `# Module written by Claude (${model}, prompt ${MODULE_PROMPT_VERSION}) from the approved storyboard, on ${new Date().toISOString().slice(0, 10)}.\n${stringify(module)}`,
  );
  await writeFile(
    join(moduleDir, "strings", `${project.defaultLocale}.json`),
    `${JSON.stringify(strings, null, 2)}\n`,
  );
  const notes = best.notes ?? [];
  if (notes.length)
    await writeFile(
      join(dir, "module-notes.md"),
      `# Notes de Claude sur le module\n\n${notes.map((n) => `- ${n}`).join("\n")}\n`,
    );
  else await rm(join(dir, "module-notes.md"), { force: true });

  const result: WriteResult = {
    module,
    issues: best.issues,
    notes,
    rounds: round,
    model,
    usage,
    costUsd: cost(model, usage),
  };
  await logGeneration(dir, {
    step: "module",
    prompt: MODULE_PROMPT_VERSION,
    model,
    rounds: round,
    usage,
    costUsd: result.costUsd,
    errors: errors(best.issues),
    warnings: best.issues.length - errors(best.issues),
  });
  options.onProgress?.({ stage: "done" });
  return result;
}
