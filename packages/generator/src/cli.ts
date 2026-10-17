#!/usr/bin/env node
// Generation pipeline (ADR 0013): source → storyboard (Sam's gate) → module → packages.
//   ldm-gen init <dir> --title <t> --audience <a> [--minutes 20] [--locale fr] [--locales fr,en]
//   ldm-gen ingest <dir>
//   ldm-gen status <dir>
import { mkdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ingestProject, slugify } from "./ingest.ts";
import { paths, saveProject } from "./project.ts";
import { projectStatus } from "./status.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    title: { type: "string" },
    audience: { type: "string" },
    minutes: { type: "string", default: "20" },
    locale: { type: "string", default: "fr" },
    locales: { type: "string" },
  },
});
const [command, dir] = positionals;
const usage = (): never => {
  console.error(
    "usage:\n  ldm-gen init <dir> --title <t> --audience <a> [--minutes 20] [--locale fr] [--locales fr,en]\n  ldm-gen ingest <dir>\n  ldm-gen status <dir>",
  );
  process.exit(2);
};
if (!dir) usage();
const project = resolve(dir as string);

try {
  if (command === "init") {
    if (!values.title || !values.audience) usage();
    await mkdir(paths(project).sources, { recursive: true });
    await saveProject(project, {
      schemaVersion: "0.1",
      id: slugify(basename(project)),
      title: values.title as string,
      audience: values.audience as string,
      durationMinutes: Number(values.minutes),
      defaultLocale: values.locale,
      locales: values.locales?.split(",") ?? [values.locale],
      approvals: {},
    });
    console.log(
      `✓ ${dir}: projet créé. Déposez les sources dans ${dir}/sources/`,
    );
  } else if (command === "ingest") {
    const index = await ingestProject(project);
    for (const s of index.sources)
      console.log(
        `✓ ${s.file} → ingest/${s.markdown} (${s.words} mots, ${s.anchors.length} ancres, ${s.media.length} média(s))`,
      );
    console.log(
      `  Total : ${index.words} mots, ~${index.readingMinutes} min de lecture`,
    );
  } else if (command === "status") {
    const icon = { done: "✓", todo: "→", blocked: "·" };
    for (const s of await projectStatus(project))
      console.log(`${icon[s.state]} ${s.name} — ${s.detail}`);
  } else usage();
} catch (e) {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
}
