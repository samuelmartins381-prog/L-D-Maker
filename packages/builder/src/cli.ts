#!/usr/bin/env node
// Usage: ldm-build <module-folder> [--out <dir>]   Default output: out/<module-id>/web
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadModuleSource } from "@ldm/schema";
import { BuildError, buildWeb } from "./build-web.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" } },
});
const [moduleDir] = positionals;
if (!moduleDir) {
  console.error("usage: ldm-build <module-folder> [--out <dir>]");
  process.exit(2);
}

try {
  const id =
    ((await loadModuleSource(moduleDir)).module as { id?: string })?.id ??
    "module";
  const build = await buildWeb(moduleDir, values.out ?? join("out", id, "web"));
  for (const w of build.warnings)
    console.log(`  ! [${w.code}] ${w.path} — ${w.message}`);
  console.log(`✓ ${build.moduleId} → ${build.outDir}/index.html`);
} catch (e) {
  if (!(e instanceof BuildError)) throw e;
  for (const i of e.issues)
    console.error(`  ✗ [${i.code}] ${i.path} — ${i.message}`);
  console.error(`✗ build failed: ${e.message}`);
  process.exit(1);
}
