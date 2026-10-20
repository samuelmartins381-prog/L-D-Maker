// Translation of a module by Claude (ADR 0015, addendum): the default-language catalogue goes out as
// a list of {key, text}, the same list comes back translated. Only the texts that changed since the
// last translation are sent again (module/.translations.json keeps the fingerprint of each source
// text), so a retouched sentence costs one sentence, not a module.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parse, stringify } from "yaml";
import { z } from "zod";
import { loadProject, paths, sha256 } from "../project.ts";
import { applyTypography } from "../typography.ts";
import {
  GenerationError,
  type GenerationEvent,
  knowledgeBlock,
  logGeneration,
} from "./common.ts";
import type { LlmCall, LlmClient } from "./llm.ts";
import {
  addUsage,
  cost,
  DEFAULT_MODEL,
  type ModelId,
  ZERO_USAGE,
} from "./pricing.ts";
import { TRANSLATE_PROMPT_VERSION, TRANSLATE_SYSTEM } from "./prompts.ts";

const Items = z.strictObject({
  items: z.array(z.strictObject({ key: z.string(), text: z.string() })),
});
const SCHEMA = zodOutputFormat(Items).schema as Record<string, unknown>;

export const TRANSLATIONS_FILE = ".translations.json";
/** locale → key → fingerprint of the source text it was translated from. */
type TranslationRecord = Record<string, Record<string, string>>;

export interface TranslateOptions {
  client: LlmClient;
  model?: ModelId;
  knowledge?: string;
  maxRounds?: number;
  onProgress?: (e: GenerationEvent) => void;
}

export interface TranslateResult {
  locale: string;
  /** Texts sent for translation (new or changed). */
  translated: number;
  costUsd: number;
}

const LANGUAGES: Record<string, string> = {
  fr: "French",
  en: "English",
  de: "German",
  it: "Italian",
  es: "Spanish",
  "pt-BR": "Brazilian Portuguese",
  ru: "Russian",
  ar: "Arabic",
  ja: "Japanese",
  "zh-Hans": "Simplified Chinese",
  ko: "Korean",
};
const language = (l: string) => `${LANGUAGES[l] ?? l} (${l})`;

/** What must survive translation untouched: emphasis, links and paragraphs. */
export function markup(text: string) {
  const bold = text.split("**").length - 1;
  const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
  return {
    bold,
    italic: text.replaceAll("**", "").split("*").length - 1,
    links: links.join(" "),
    paragraphs: text.trim().split(/\n\s*\n/).length,
  };
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function state(dir: string) {
  const moduleDir = paths(dir).module;
  const project = await loadProject(dir);
  const source = await readJson<Record<string, string>>(
    join(moduleDir, "strings", `${project.defaultLocale}.json`),
    {},
  );
  const record = await readJson<TranslationRecord>(
    join(moduleDir, TRANSLATIONS_FILE),
    {},
  );
  return { moduleDir, project, source, record };
}

/** Keys of `locale` to translate again: new, changed or never translated. */
function pending(
  source: Record<string, string>,
  target: Record<string, string>,
  done: Record<string, string> = {},
): string[] {
  return Object.keys(source).filter(
    (k) => !(k in target) || done[k] !== sha256(source[k] as string),
  );
}

/** For each project language other than the default: how many texts are left to translate. */
export async function translationStatus(
  dir: string,
): Promise<{ locale: string; pending: number; total: number }[]> {
  const { moduleDir, project, source, record } = await state(dir);
  const out = [];
  for (const locale of project.locales) {
    if (locale === project.defaultLocale) continue;
    const target = await readJson<Record<string, string>>(
      join(moduleDir, "strings", `${locale}.json`),
      {},
    );
    out.push({
      locale,
      pending: pending(source, target, record[locale]).length,
      total: Object.keys(source).length,
    });
  }
  return out;
}

export async function translateModule(
  dir: string,
  locale: string,
  options: TranslateOptions,
): Promise<TranslateResult> {
  const model = options.model ?? DEFAULT_MODEL;
  const maxRounds = options.maxRounds ?? 3;
  const { moduleDir, project, source, record } = await state(dir);
  if (!Object.keys(source).length)
    throw new GenerationError("no module to translate yet");
  if (locale === project.defaultLocale)
    throw new GenerationError(`${locale} is the writing language`);
  const targetFile = join(moduleDir, "strings", `${locale}.json`);
  const target = await readJson<Record<string, string>>(targetFile, {});
  const keys = pending(source, target, record[locale]);

  let usage = ZERO_USAGE;
  let rounds = 0;
  const translated: Record<string, string> = {};
  if (keys.length) {
    const items = keys.map((key) => ({ key, text: source[key] as string }));
    const content: Anthropic.ContentBlockParam[] = [
      ...knowledgeBlock(options.knowledge),
      {
        type: "text",
        text: `Audience: ${project.audience}. Address: ${project.formality === "formal" ? "formal" : "informal"}.\nFrom ${language(project.defaultLocale)} into ${language(locale)}.\n\n${JSON.stringify({ items })}`,
      },
    ];
    const call: LlmCall = {
      model,
      system: TRANSLATE_SYSTEM,
      messages: [{ role: "user", content }],
      schema: SCHEMA,
      maxTokens: 64_000,
    };
    let ok = false;
    while (rounds < maxRounds && !ok) {
      rounds++;
      const answer = await options.client.complete(call, (chars) =>
        options.onProgress?.({ stage: "writing", round: rounds, chars }),
      );
      usage = addUsage(usage, answer.usage);
      options.onProgress?.({ stage: "checking", round: rounds });
      const problems: string[] = [];
      let parsed: z.infer<typeof Items> | undefined;
      try {
        parsed = Items.parse(JSON.parse(answer.text));
      } catch {
        problems.push("the answer is not the expected JSON list");
      }
      if (parsed) {
        const got = new Map(parsed.items.map((i) => [i.key, i.text]));
        for (const { key, text } of items) {
          const t = got.get(key);
          if (t === undefined || !t.trim()) {
            problems.push(`${key}: missing`);
            continue;
          }
          const a = markup(text);
          const b = markup(t);
          for (const f of ["bold", "italic", "links", "paragraphs"] as const)
            if (a[f] !== b[f])
              problems.push(
                `${key}: ${f} differ from the source (${a[f]} vs ${b[f]})`,
              );
          translated[key] = t;
        }
      }
      ok = problems.length === 0;
      if (!ok && rounds < maxRounds)
        call.messages.push(
          { role: "assistant", content: answer.content },
          {
            role: "user",
            content: `Problems:\n${problems.map((p) => `- ${p}`).join("\n")}\n\nAnswer again with the complete corrected list.`,
          },
        );
      else if (!ok)
        throw new GenerationError(
          `translation into ${locale} still wrong after ${rounds} answers: ${problems.slice(0, 5).join("; ")}`,
        );
    }
  }

  // Same keys as the source, in its order; texts removed from the source are dropped.
  const merged = applyTypography(
    locale,
    Object.fromEntries(
      Object.keys(source).map((k) => [
        k,
        translated[k] ?? (target[k] as string),
      ]),
    ),
  );
  await writeFile(targetFile, `${JSON.stringify(merged, null, 2)}\n`);
  record[locale] = Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, sha256(v)]),
  );
  await writeFile(
    join(moduleDir, TRANSLATIONS_FILE),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  // The module now offers this language, in the order chosen for the project.
  const yamlFile = join(moduleDir, "module.yaml");
  const raw = await readFile(yamlFile, "utf8");
  const header = raw.match(/^(#.*\n)*/)?.[0] ?? "";
  const module = parse(raw) as { locales: string[] };
  const offered = new Set([...module.locales, locale]);
  module.locales = project.locales.filter((l) => offered.has(l));
  await writeFile(yamlFile, header + stringify(module));

  const costUsd = cost(model, usage);
  if (keys.length)
    await logGeneration(dir, {
      step: "translation",
      prompt: TRANSLATE_PROMPT_VERSION,
      model,
      rounds,
      usage,
      costUsd,
      errors: 0,
      warnings: 0,
      locale,
    });
  options.onProgress?.({ stage: "done" });
  return { locale, translated: keys.length, costUsd };
}

/** Rough price of translating the module's pending texts into every project language. */
export async function estimateTranslations(
  dir: string,
  model: ModelId = DEFAULT_MODEL,
  /** Size of the default-language texts when the module is not written yet. */
  sourceTokens = 12_000,
): Promise<{ locales: string[]; lowUsd: number; highUsd: number }> {
  const status = await translationStatus(dir).catch(() => []);
  const project = await loadProject(dir);
  const locales = project.locales.filter((l) => l !== project.defaultLocale);
  let low = 0;
  let high = 0;
  for (const l of locales) {
    const s = status.find((x) => x.locale === l);
    const share = s?.total ? s.pending / s.total : 1;
    const tokens = Math.ceil(sourceTokens * share);
    low += cost(model, { input_tokens: tokens, output_tokens: tokens });
    high += cost(model, {
      input_tokens: 3 * (tokens + 12_000),
      output_tokens: 3 * Math.ceil(tokens * 1.5),
    });
  }
  return { locales, lowUsd: low, highUsd: high };
}
