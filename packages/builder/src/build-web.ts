import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CompiledContent,
  LOCALES_DIR,
  LOCALES_GLOBAL,
  type LocalePack,
} from "@ldm/player/content";
import {
  type Issue,
  loadModuleSource,
  type Module,
  type StringCatalog,
  validateModule,
} from "@ldm/schema";
import { guardScript, guardStyle } from "./prerender-guard.ts";

const PLAYER_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../player",
);
const PLAYER_DIST = join(PLAYER_DIR, "dist");
/** Build-time renderer of the first screen (ADR 0012), produced by the player's --ssr build. */
const PRERENDER = join(PLAYER_DIR, "dist-ssr/prerender.js");
const UI_DIR = join(PLAYER_DIR, "src/ui");

export class BuildError extends Error {
  readonly issues: Issue[];
  constructor(message: string, issues: Issue[] = []) {
    super(message);
    this.issues = issues;
  }
}

interface ViteManifestEntry {
  file: string;
  css?: string[];
  isEntry?: boolean;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

/**
 * Player interface catalogs keyed by module locale (plus "en", the fallback). A regional locale
 * without its own catalog uses its language's (pt-BR → pt.json, zh-Hans → zh.json).
 */
async function loadUiCatalogs(
  locales: readonly string[],
): Promise<Record<string, StringCatalog>> {
  const available = new Set(
    (await readdir(UI_DIR)).map((f) => f.replace(/\.json$/, "")),
  );
  const ui: Record<string, StringCatalog> = {};
  const missing: string[] = [];
  for (const locale of new Set([...locales, "en"])) {
    const lang = locale.split("-")[0] ?? locale;
    const file = available.has(locale)
      ? locale
      : available.has(lang)
        ? lang
        : undefined;
    if (!file) missing.push(locale);
    else ui[locale] = await readJson(join(UI_DIR, `${file}.json`));
  }
  if (missing.length)
    throw new BuildError(
      `player interface is not translated for: ${missing.join(", ")} (add packages/player/src/ui/<locale>.json)`,
    );
  return ui;
}

/** Escapes JSON for embedding in a <script type="application/json"> element (no premature </script>). */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

export interface WebBuild {
  outDir: string;
  module: Module;
  /** Module strings in the default locale (titles for manifests). */
  defaultStrings: Record<string, string>;
  warnings: Issue[];
}

export interface WebBuildOptions {
  /** Which tracker the player uses: browser storage ("web") or the SCORM 1.2 API ("scorm12"). */
  target?: CompiledContent["target"];
}

/**
 * Builds a standalone web version of a module: index.html (content embedded), player script,
 * stylesheet, fonts and media. Fails on any validation error. Works from file:// and any server.
 */
export async function buildWeb(
  moduleDir: string,
  outDir: string,
  { target = "web" }: WebBuildOptions = {},
): Promise<WebBuild> {
  const result = validateModule(await loadModuleSource(moduleDir));
  if (!result.ok || !result.module)
    throw new BuildError("module is invalid", result.issues);
  const module = result.module;
  const source = await loadModuleSource(moduleDir);

  const manifest = await readJson<Record<string, ViteManifestEntry>>(
    join(PLAYER_DIST, ".vite/manifest.json"),
  ).catch(() => {
    throw new BuildError(
      "player is not built: run `pnpm --filter @ldm/player build`",
    );
  });
  const entry = Object.values(manifest).find((e) => e.isEntry);
  if (!entry) throw new BuildError("player manifest has no entry");
  // With an IIFE build, Vite lists the extracted stylesheet as its own manifest entry.
  const stylesheets = [
    ...new Set([
      ...(entry.css ?? []),
      ...Object.values(manifest)
        .map((e) => e.file)
        .filter((f) => f.endsWith(".css")),
    ]),
  ];
  if (stylesheets.length === 0)
    throw new BuildError("player manifest has no stylesheet");

  // Only the default locale is embedded; the others ship as packs loaded on demand (ADR 0007).
  const ui = await loadUiCatalogs(module.locales);
  const def = module.defaultLocale;
  const stringsOf = (l: string) => source.strings[l] as StringCatalog;
  const content: CompiledContent = {
    format: 1,
    target,
    module,
    strings: { [def]: stringsOf(def) },
    ui: { [def]: ui[def] as StringCatalog, en: ui.en as StringCatalog },
  };

  const { prerender } = (await import(PRERENDER).catch(() => {
    throw new BuildError(
      "player prerenderer is not built: run `pnpm --filter @ldm/player build`",
    );
  })) as { prerender: (c: CompiledContent) => string };
  // Rendered before the content is embedded: the prerender works on its own copy.
  const firstScreen = prerender(structuredClone(content));
  const storageKey =
    target === "web" ? `ldm:${module.id}@${module.version}` : null;

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(join(PLAYER_DIST, entry.file), join(outDir, entry.file));
  await cp(join(PLAYER_DIST, "assets"), join(outDir, "assets"), {
    recursive: true,
  });
  if (source.mediaFiles.length)
    await cp(join(moduleDir, "media"), join(outDir, "media"), {
      recursive: true,
    });

  const packs = module.locales.filter((l) => l !== def);
  if (packs.length) await mkdir(join(outDir, LOCALES_DIR));
  for (const l of packs) {
    const pack: LocalePack = {
      strings: stringsOf(l),
      ui: ui[l] as StringCatalog,
    };
    await writeFile(
      join(outDir, LOCALES_DIR, `${l}.js`),
      `(self.${LOCALES_GLOBAL}=self.${LOCALES_GLOBAL}||{})[${JSON.stringify(l)}]=${embedJson(pack)};\n`,
    );
  }

  const defaultTitle =
    content.strings[module.defaultLocale]?.[module.meta.title] ?? module.id;
  const html = `<!doctype html>
<html lang="${module.defaultLocale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(defaultTitle)}</title>
<style>${guardStyle}</style>
<script>${guardScript(module.locales, module.defaultLocale, storageKey)}</script>
${stylesheets.map((css) => `<link rel="stylesheet" href="${css}">`).join("\n")}
<script defer src="${entry.file}"></script>
</head>
<body>
<div id="ldm-app" inert data-prerender>${firstScreen}</div>
<script type="application/json" id="ldm-content">${embedJson(content)}</script>
</body>
</html>
`;
  await writeFile(join(outDir, "index.html"), html);
  return {
    outDir,
    module,
    defaultStrings: content.strings[module.defaultLocale] ?? {},
    warnings: result.issues,
  };
}
