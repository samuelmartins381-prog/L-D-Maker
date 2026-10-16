// Module ↔ XLIFF: export the strings of a module for translation, import a translated file back.
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectKeys,
  loadModuleSource,
  type Module,
  validateModule,
} from "@ldm/schema";
import { parseDocument } from "yaml";
import {
  formatCounts,
  readXliff,
  resolveLinks,
  type Unit,
  writeXliff,
  type XliffVersion,
} from "./xliff.ts";

const UI_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../player/src/ui",
);

export interface ExportOptions {
  to: string;
  /** Source locale; the module default when omitted. */
  from?: string;
  version?: XliffVersion;
}

async function loadValid(moduleDir: string): Promise<{
  module: Module;
  strings: Record<string, Record<string, string>>;
}> {
  const source = await loadModuleSource(moduleDir);
  const result = validateModule(source);
  if (!result.module)
    throw new Error("module is invalid: run `pnpm validate` first");
  return {
    module: result.module,
    strings: source.strings as Record<string, Record<string, string>>,
  };
}

const FIELD: Record<string, string> = {
  heading: "heading",
  body: "body text",
  intro: "introduction",
  prompt: "question text",
  title: "title",
  text: "answer option",
  feedback: "explanation shown after answering",
  "media.alt": "image description (alt text, read by screen readers)",
};
const BLOCK: Record<string, string> = {
  narrative: "text block",
  accordion: "accordion",
  tabs: "tabs",
  question: "question",
  summary: "summary list",
};

/** Turns a key location (sections[1].screens[0].blocks[2].choices[0].feedback) into translator context. */
export function describeLocation(
  module: Module,
  strings: Record<string, string>,
  at: string,
): string {
  if (at === "meta.title") return "Module title";
  if (at === "meta.description") return "Module description";
  const objective = /^objectives\[(\d+)\]/.exec(at);
  if (objective) return `Learning objective ${Number(objective[1]) + 1}`;
  const m =
    /^sections\[(\d+)\](?:\.screens\[(\d+)\])?(?:\.blocks\[(\d+)\])?\.(.+)$/.exec(
      at,
    );
  if (!m) return at;
  const [, si, sci, bi, rest = ""] = m;
  const section = module.sections[Number(si)];
  if (sci === undefined) return `Section ${Number(si) + 1} title`;
  const screens = module.sections.flatMap((s) => s.screens);
  const screen = section?.screens[Number(sci)];
  const n = screens.indexOf(screen as (typeof screens)[number]) + 1;
  const where = `Screen ${n} “${strings[screen?.title ?? ""] ?? ""}”`;
  if (bi === undefined) return `${where} — screen title`;
  const block = screen?.blocks[Number(bi)];
  const item = /^(items|choices|points)\[(\d+)\](?:\.(.+))?$/.exec(rest);
  const kind = BLOCK[block?.type ?? ""] ?? "block";
  if (!item) return `${where} — ${kind}: ${FIELD[rest] ?? rest}`;
  const [, list, index, field] = item;
  const pos = Number(index) + 1;
  if (list === "points") return `${where} — ${kind}: point ${pos}`;
  if (list === "items")
    return `${where} — ${kind}: panel ${pos} ${field === "title" ? "title" : "content"}`;
  return `${where} — ${kind}: ${field === "feedback" ? `explanation of option ${pos}, shown after answering` : `option ${pos}`}`;
}

/** One unit per string key, in reading order, with every place it is used as translator context. */
export async function exportModule(
  moduleDir: string,
  opts: ExportOptions,
): Promise<{ xml: string; units: number; translated: number; from: string }> {
  const { module, strings } = await loadValid(moduleDir);
  const from = opts.from ?? module.defaultLocale;
  const sourceCatalog = strings[from];
  if (!sourceCatalog) throw new Error(`no strings for source locale "${from}"`);
  const targetCatalog = strings[opts.to] ?? {};
  const byKey = new Map<string, Unit>();
  for (const ref of collectKeys(module)) {
    const unit = byKey.get(ref.key);
    const note = describeLocation(module, sourceCatalog, ref.at);
    if (unit) unit.notes.push(note);
    else {
      const target = targetCatalog[ref.key];
      byKey.set(ref.key, {
        id: ref.key,
        source: sourceCatalog[ref.key] ?? "",
        ...(target ? { target } : {}),
        notes: [note],
      });
    }
  }
  const units = [...byKey.values()];
  const xml = writeXliff({
    version: opts.version ?? "1.2",
    srcLang: from,
    trgLang: opts.to,
    original: `${module.id}@${module.version}`,
    units,
  });
  return {
    xml,
    units: units.length,
    translated: units.filter((u) => u.target).length,
    from,
  };
}

export interface ImportReport {
  locale: string;
  imported: number;
  untranslated: string[];
  unknown: string[];
  /** Blocking: nothing was written. */
  errors: string[];
  warnings: string[];
  addedLocale: boolean;
}

/**
 * Imports a translated XLIFF into strings/<target>.json (existing keys not in the file are kept) and
 * adds the locale to module.yaml if needed. Nothing is written when an error is found.
 */
export async function importXliff(
  moduleDir: string,
  xml: string,
): Promise<ImportReport> {
  const { module, strings } = await loadValid(moduleDir);
  const doc = readXliff(xml);
  const locale = doc.trgLang;
  const report: ImportReport = {
    locale,
    imported: 0,
    untranslated: [],
    unknown: [],
    errors: [],
    warnings: [],
    addedLocale: false,
  };
  if (!locale) report.errors.push("the XLIFF file has no target language");
  if (locale === module.defaultLocale)
    report.errors.push(
      `target language "${locale}" is the module's source language`,
    );
  if (doc.original && doc.original !== `${module.id}@${module.version}`)
    report.warnings.push(
      `file exported from ${doc.original}, module is now ${module.id}@${module.version}: check for changed strings`,
    );

  const sourceCatalog =
    strings[doc.srcLang] ?? strings[module.defaultLocale] ?? {};
  const known = new Set(collectKeys(module).map((r) => r.key));
  const catalog: Record<string, string> = { ...(strings[locale] ?? {}) };
  for (const unit of doc.units) {
    if (!known.has(unit.id)) {
      report.unknown.push(unit.id);
      continue;
    }
    if (!unit.target) {
      report.untranslated.push(unit.id);
      continue;
    }
    const source = sourceCatalog[unit.id] ?? unit.source;
    // Links are protected: URLs come back from the source, never from the translated file.
    const target = resolveLinks(unit.target, source);
    const [s, t] = [formatCounts(source), formatCounts(unit.target)];
    if (target === null || s.link !== t.link) {
      report.errors.push(
        `${unit.id}: links differ from the source (${s.link} expected, ${t.link} found)`,
      );
      continue;
    }
    if (s.strong !== t.strong || s.em !== t.em)
      report.warnings.push(
        `${unit.id}: formatting differs from the source (bold ${s.strong}→${t.strong}, italic ${s.em}→${t.em})`,
      );
    catalog[unit.id] = target;
    report.imported++;
  }
  if (report.errors.length) return report;

  const ordered = Object.fromEntries(
    [...known].filter((k) => k in catalog).map((k) => [k, catalog[k]]),
  );
  await writeFile(
    join(moduleDir, "strings", `${locale}.json`),
    `${JSON.stringify(ordered, null, 2)}\n`,
  );

  if (!module.locales.includes(locale)) {
    // Edit module.yaml as a document so comments and layout are kept.
    const path = join(moduleDir, "module.yaml");
    const yaml = parseDocument(await readFile(path, "utf8"));
    yaml.set("locales", [...module.locales, locale]);
    await writeFile(path, yaml.toString());
    report.addedLocale = true;
  }
  const lang = locale.split("-")[0] ?? locale;
  if (
    !existsSync(join(UI_DIR, `${locale}.json`)) &&
    !existsSync(join(UI_DIR, `${lang}.json`))
  )
    report.warnings.push(
      `the player interface is not translated into "${locale}" yet: add packages/player/src/ui/${lang}.json before building`,
    );
  return report;
}
