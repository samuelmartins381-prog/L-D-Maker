// The module once written (ADR 0014, step 4): its texts for Sam's edits, the preview build and the
// packages for the LMS. No Electron here: tested in Node.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildWeb,
  PROFILES,
  type ProfileId,
  packageHtml5,
  packageScorm12,
  packageScorm2004,
} from "@ldm/builder";
import { applyTypography, loadProject, paths } from "@ldm/generator";
import { collectKeys, loadModuleSource, Module } from "@ldm/schema";
import type { ExportSummary, ModuleTexts } from "../shared/api.ts";
import { assertEditable } from "./projects.ts";

async function source(dir: string) {
  const moduleDir = paths(dir).module;
  const project = await loadProject(dir);
  const src = await loadModuleSource(moduleDir);
  const module = Module.parse(src.module);
  const file = join(moduleDir, "strings", `${project.defaultLocale}.json`);
  const strings = JSON.parse(await readFile(file, "utf8")) as Record<
    string,
    string
  >;
  return { module, strings, file, locale: project.defaultLocale };
}

/** What a key holds, for the edit screen's labels (an interface catalogue key suffix). */
function fieldOf(at: string): string {
  const last = at.split(".").pop() ?? "";
  if (at.startsWith("meta.")) return last;
  if (at.startsWith("objectives[")) return "objective";
  if (/^sections\[\d+\]\.title$/.test(at)) return "section";
  if (/^points\[/.test(last)) return "point";
  if (at.includes("choices["))
    return last === "feedback" ? "feedback" : "choice";
  if (at.includes("items[")) return `item-${last}`;
  return last === "title" ? "screen" : last;
}

export async function moduleTexts(dir: string): Promise<ModuleTexts> {
  const { module, strings, locale } = await source(dir);
  // A text used in several places (an objective repeated in the welcome summary) is edited once.
  const seen = new Set<string>();
  const fresh = (r: { key: string }) =>
    !seen.has(r.key) && Boolean(seen.add(r.key));
  const entry = (key: string, at: string) => ({
    key,
    field: fieldOf(at),
    text: strings[key] ?? "",
  });
  const head = collectKeys({
    ...module,
    sections: [],
  });
  const groups: ModuleTexts["groups"] = [
    {
      id: "module",
      title: strings[module.meta.title] ?? module.id,
      entries: head.filter(fresh).map((r) => entry(r.key, r.at)),
    },
  ];
  for (const s of module.sections)
    for (const [i, sc] of s.screens.entries()) {
      const refs = collectKeys({
        ...module,
        sections: [{ ...s, screens: [sc] }],
      })
        .slice(head.length)
        // The part's title is shown once, with its first screen.
        .filter((r) => i === 0 || r.at !== "sections[0].title");
      groups.push({
        id: sc.id,
        title: strings[sc.title] ?? sc.id,
        entries: refs.filter(fresh).map((r) => entry(r.key, r.at)),
      });
    }
  return { defaultLocale: locale, groups };
}

/** Sam's edits in the writing language; translations of the changed texts become due. */
export async function saveModuleTexts(
  dir: string,
  changes: Record<string, string>,
  me: string,
): Promise<ModuleTexts> {
  await assertEditable(dir, me);
  const { strings, file, locale } = await source(dir);
  for (const key of Object.keys(changes))
    if (!(key in strings)) throw new Error(`unknown text: ${key}`);
  const next = applyTypography(locale, { ...strings, ...changes });
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`);
  return moduleTexts(dir);
}

/** Builds the module as a learner sees it; returns the page to open. */
export async function buildPreview(dir: string): Promise<string> {
  const out = join(dir, "out", "preview");
  await buildWeb(paths(dir).module, out, { target: "web" });
  return join(out, "index.html");
}

const PACKAGERS = {
  scorm12: packageScorm12,
  scorm2004: packageScorm2004,
  "html-site": packageHtml5,
  // The single HTML file is not ready (ADR 0016): the site, zipped, stands in for it.
  "html-file": packageHtml5,
} as const;

export async function exportModule(
  dir: string,
  me: string,
): Promise<ExportSummary> {
  await assertEditable(dir, me);
  const project = await loadProject(dir);
  const folder = join(dir, "out");
  const done = new Map<string, string>();
  const generic: string[] = [];
  for (const { profile } of project.outputs) {
    const p = PROFILES[profile as ProfileId];
    if (!p.ready) generic.push(profile);
    if (done.has(p.format)) continue;
    const r = await PACKAGERS[p.format](paths(dir).module, folder);
    done.set(p.format, r.zip);
  }
  return {
    folder,
    files: [...done.values()].map((f) => f.slice(folder.length + 1)),
    generic,
  };
}
