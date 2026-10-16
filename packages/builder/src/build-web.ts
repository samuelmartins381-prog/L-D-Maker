import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CompiledContent } from "@ldm/player/content";
import { type Issue, loadModuleSource, validateModule } from "@ldm/schema";

const PLAYER_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../player",
);
const PLAYER_DIST = join(PLAYER_DIR, "dist");
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

/** Player interface catalogs for the module locales (plus English, the fallback). */
async function loadUiCatalogs(
  locales: readonly string[],
): Promise<CompiledContent["ui"]> {
  const available = new Set(
    (await readdir(UI_DIR)).map((f) => f.replace(/\.json$/, "")),
  );
  const ui: CompiledContent["ui"] = {};
  const missing: string[] = [];
  for (const locale of new Set([...locales, "en"])) {
    const lang = locale.split("-")[0] ?? locale;
    const file = available.has(locale)
      ? locale
      : available.has(lang)
        ? lang
        : undefined;
    if (!file) missing.push(locale);
    else ui[file] = await readJson(join(UI_DIR, `${file}.json`));
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
  moduleId: string;
  warnings: Issue[];
}

/**
 * Builds a standalone web version of a module: index.html (content embedded), player script,
 * stylesheet, fonts and media. Fails on any validation error. Works from file:// and any server.
 */
export async function buildWeb(
  moduleDir: string,
  outDir: string,
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

  const content: CompiledContent = {
    format: 1,
    module,
    strings: Object.fromEntries(
      module.locales.map((l) => [
        l,
        source.strings[l] as Record<string, string>,
      ]),
    ),
    ui: await loadUiCatalogs(module.locales),
  };

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

  const defaultTitle =
    content.strings[module.defaultLocale]?.[module.meta.title] ?? module.id;
  const html = `<!doctype html>
<html lang="${module.defaultLocale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(defaultTitle)}</title>
${stylesheets.map((css) => `<link rel="stylesheet" href="${css}">`).join("\n")}
</head>
<body>
<div id="ldm-app"></div>
<script type="application/json" id="ldm-content">${embedJson(content)}</script>
<script src="${entry.file}"></script>
</body>
</html>
`;
  await writeFile(join(outDir, "index.html"), html);
  return { outDir, moduleId: module.id, warnings: result.issues };
}
