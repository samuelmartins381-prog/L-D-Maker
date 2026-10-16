import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import type { ModuleSource } from "./validate.ts";

async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, {
      withFileTypes: true,
      recursive: true,
    });
    return entries
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath, e.name));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

/** Reads a module folder (module.yaml, strings/*.json, media/) without validating it. */
export async function loadModuleSource(dir: string): Promise<ModuleSource> {
  const module: unknown = parseYaml(
    await readFile(join(dir, "module.yaml"), "utf8"),
  );
  const strings: Record<string, unknown> = {};
  for (const file of await listFiles(join(dir, "strings"))) {
    if (!file.endsWith(".json")) continue;
    const locale = file.slice(file.lastIndexOf(sep) + 1, -".json".length);
    strings[locale] = JSON.parse(await readFile(file, "utf8"));
  }
  const mediaFiles = (await listFiles(join(dir, "media"))).map((f) =>
    relative(dir, f).split(sep).join("/"),
  );
  return { module, strings, mediaFiles };
}
