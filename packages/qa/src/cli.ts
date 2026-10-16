#!/usr/bin/env node
// Usage: ldm-qa <module-folder> [--skip-lighthouse]
// Runs the quality bench on the built module (out/<id>/web and out/<id>/scorm12; build it first)
// and writes out/<id>/qa/report.html + report.json. Exit code 1 when a check fails.
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadModuleSource, validateModule } from "@ldm/schema";
import { launch } from "./browser.ts";
import { budgetCheck } from "./checks/budget.ts";
import { walkChecks } from "./checks/from-walk.ts";
import { lighthouseChecks } from "./checks/lighthouse.ts";
import { manualChecks, pedagogyCheck } from "./checks/pedagogy.ts";
import { scormChecks } from "./checks/scorm.ts";
import { verdict, writeReport } from "./report.ts";
import { serveDir } from "./server.ts";
import type { CheckResult } from "./types.ts";
import { walkModule } from "./walk.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { "skip-lighthouse": { type: "boolean" } },
});
const [moduleDir] = positionals;
if (!moduleDir) {
  console.error("usage: ldm-qa <module-folder> [--skip-lighthouse]");
  process.exit(2);
}

const started = Date.now();
const validation = validateModule(await loadModuleSource(moduleDir));
if (!validation.module) {
  console.error("✗ module is invalid: run `pnpm validate` first");
  process.exit(1);
}
const module = validation.module;
const strings = (await loadModuleSource(moduleDir)).strings as Record<
  string,
  Record<string, string>
>;
const outRoot = resolve("out", module.id);
const webDir = join(outRoot, "web");
const qaDir = join(outRoot, "qa");
await rm(qaDir, { recursive: true, force: true });
await mkdir(join(qaDir, "screens"), { recursive: true });

const log = (c: CheckResult) =>
  console.log(
    `  ${{ pass: "✓", fail: "✗", warn: "!", manual: "·" }[c.status]} ${c.title} — ${c.summary}`,
  );
const checks: CheckResult[] = [];
const add = (...results: CheckResult[]) => {
  for (const r of results) {
    checks.push(r);
    log(r);
  }
};

console.log(`QA ${module.id} v${module.version}`);
add(pedagogyCheck(validation, module));
add(await budgetCheck(webDir));

const server = await serveDir(webDir);
const browser = await launch();
try {
  const screens = module.sections.flatMap((s) => s.screens).length;
  const walk = await walkModule(
    browser,
    (l) => `${server.origin}/index.html?lang=${l}`,
    module.locales,
    screens,
    join(qaDir, "screens"),
  );
  add(...walkChecks(walk, module.locales));
  add(
    ...(await scormChecks(
      browser,
      join(outRoot, "scorm12", "index.html"),
      module,
      strings[module.defaultLocale] ?? {},
    )),
  );
  if (!values["skip-lighthouse"])
    add(
      ...(await lighthouseChecks(
        `${server.origin}/index.html?lang=${module.defaultLocale}`,
      )),
    );
  add(...manualChecks(module.locales));

  const report = await writeReport(qaDir, {
    module: {
      id: module.id,
      version: module.version,
      title: strings[module.defaultLocale]?.[module.meta.title] ?? module.id,
      locales: module.locales,
    },
    generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    durationSeconds: Math.round((Date.now() - started) / 1000),
    checks,
    screenshots: walk.screenshots,
  });
  console.log(`${verdict(checks) === "pass" ? "✓" : "✗"} report: ${report}`);
  process.exitCode = verdict(checks) === "pass" ? 0 : 1;
} finally {
  await browser.close();
  await server.close();
}
