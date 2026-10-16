#!/usr/bin/env node
// Usage: ldm-validate <module-folder>...   Exit code 1 when any module has errors.
import { loadModuleSource } from "./load.ts";
import { validateModule } from "./validate.ts";

const dirs = process.argv.slice(2);
if (dirs.length === 0) {
  console.error("usage: ldm-validate <module-folder>...");
  process.exit(2);
}

let failed = false;
for (const dir of dirs) {
  const result = validateModule(await loadModuleSource(dir));
  const errors = result.issues.filter((i) => i.severity === "error").length;
  const warnings = result.issues.length - errors;
  for (const i of result.issues)
    console.log(
      `  ${i.severity === "error" ? "✗" : "!"} [${i.code}] ${i.path} — ${i.message}`,
    );
  console.log(
    `${result.ok ? "✓" : "✗"} ${dir}: ${errors} error(s), ${warnings} warning(s)`,
  );
  if (!result.ok) failed = true;
}
process.exit(failed ? 1 : 0);
