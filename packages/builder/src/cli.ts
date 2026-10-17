#!/usr/bin/env node
// Usage: ldm-build <module-folder> [--format web|scorm12|scorm2004|all] [--out <dir>]
// Default: all formats into out/<module-id>/ (web/ preview folder + one ZIP per format).
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadModuleSource } from "@ldm/schema";
import { BuildError } from "./build-web.ts";
import { packageHtml5, packageScorm12, packageScorm2004 } from "./package.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string" },
    format: { type: "string", default: "all" },
  },
});
const [moduleDir] = positionals;
const formats =
  values.format === "all"
    ? ["web", "scorm12", "scorm2004"]
    : [values.format ?? ""];
if (
  !moduleDir ||
  formats.some((f) => !["web", "scorm12", "scorm2004"].includes(f))
) {
  console.error(
    "usage: ldm-build <module-folder> [--format web|scorm12|scorm2004|all] [--out <dir>]",
  );
  process.exit(2);
}

try {
  const id =
    ((await loadModuleSource(moduleDir)).module as { id?: string })?.id ??
    "module";
  const outRoot = values.out ?? join("out", id);
  for (const format of formats) {
    const result =
      format === "web"
        ? await packageHtml5(moduleDir, outRoot)
        : format === "scorm2004"
          ? await packageScorm2004(moduleDir, outRoot)
          : await packageScorm12(moduleDir, outRoot);
    if (format === formats[0])
      for (const w of result.build.warnings)
        console.log(`  ! [${w.code}] ${w.path} — ${w.message}`);
    console.log(`✓ ${result.build.module.id} [${format}] → ${result.zip}`);
  }
} catch (e) {
  if (!(e instanceof BuildError)) throw e;
  for (const i of e.issues)
    console.error(`  ✗ [${i.code}] ${i.path} — ${i.message}`);
  console.error(`✗ build failed: ${e.message}`);
  process.exit(1);
}
