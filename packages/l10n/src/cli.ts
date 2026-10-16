#!/usr/bin/env node
// Translation round-trip through XLIFF (ADR 0006).
//   ldm-l10n export <module> --to <lang> [--from <lang>] [--xliff 1.2|2.0] [--out <file>]
//   ldm-l10n import <module> <file.xlf>
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { exportModule, importXliff } from "./module-xliff.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    to: { type: "string" },
    from: { type: "string" },
    xliff: { type: "string", default: "1.2" },
    out: { type: "string" },
  },
});
const [command, moduleDir, file] = positionals;
const usage = () => {
  console.error(
    "usage:\n  ldm-l10n export <module> --to <lang> [--from <lang>] [--xliff 1.2|2.0] [--out <file>]\n  ldm-l10n import <module> <file.xlf>",
  );
  process.exit(2);
};

if (command === "export" && moduleDir && values.to) {
  if (values.xliff !== "1.2" && values.xliff !== "2.0") usage();
  const result = await exportModule(moduleDir, {
    to: values.to,
    ...(values.from ? { from: values.from } : {}),
    version: values.xliff as "1.2" | "2.0",
  });
  const id = moduleDir.replace(/\/+$/, "").split("/").at(-1) ?? "module";
  const out =
    values.out ??
    join("out", id, "xliff", `${id}.${result.from}-${values.to}.xlf`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, result.xml);
  console.log(
    `✓ ${result.units} strings (${result.translated} already translated) → ${out}`,
  );
} else if (command === "import" && moduleDir && file) {
  const report = await importXliff(moduleDir, await readFile(file, "utf8"));
  for (const e of report.errors) console.error(`  ✗ ${e}`);
  for (const w of report.warnings) console.log(`  ! ${w}`);
  if (report.unknown.length)
    console.log(
      `  ! ${report.unknown.length} unknown key(s) ignored: ${report.unknown.slice(0, 5).join(", ")}`,
    );
  if (report.untranslated.length)
    console.log(
      `  ! ${report.untranslated.length} string(s) not translated: ${report.untranslated.slice(0, 5).join(", ")}`,
    );
  if (report.errors.length) {
    console.error("✗ nothing imported");
    process.exit(1);
  }
  console.log(
    `✓ ${report.imported} strings imported into strings/${report.locale}.json${report.addedLocale ? ` (locale "${report.locale}" added to module.yaml)` : ""}`,
  );
} else usage();
