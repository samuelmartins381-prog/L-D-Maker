// A generation project (ADR 0013): one folder holding the sources, what was read from them, the
// storyboard, the approvals (gates) and the module. project.yaml is its identity card.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Id, Locale } from "@ldm/schema";
import { parse, stringify } from "yaml";
import { z } from "zod";

export const PROJECT_FILE = "project.yaml";

export const Approval = z.strictObject({
  /** sha256 of the approved file: any later change invalidates the approval. */
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  at: z.string(),
  by: z.string().min(1),
});

export const Project = z.strictObject({
  schemaVersion: z.literal("0.1"),
  id: Id,
  title: z.string().min(1),
  /** Who the module is for: drives tone, examples and scenarios. */
  audience: z.string().min(1),
  durationMinutes: z.int().min(1).max(600),
  defaultLocale: Locale,
  locales: z.array(Locale).min(1),
  approvals: z.strictObject({ storyboard: Approval.optional() }).default({}),
});
export type Project = z.infer<typeof Project>;

export class ProjectError extends Error {}

export const paths = (dir: string) => ({
  project: join(dir, PROJECT_FILE),
  sources: join(dir, "sources"),
  ingest: join(dir, "ingest"),
  ingestIndex: join(dir, "ingest", "ingest.json"),
  storyboard: join(dir, "storyboard.yaml"),
  review: join(dir, "review", "storyboard.html"),
  module: join(dir, "module"),
});

export async function loadProject(dir: string): Promise<Project> {
  let raw: string;
  try {
    raw = await readFile(paths(dir).project, "utf8");
  } catch {
    throw new ProjectError(
      `${dir}: no ${PROJECT_FILE} (create the project with \`pnpm gen init\`)`,
    );
  }
  const parsed = Project.safeParse(parse(raw));
  if (!parsed.success)
    throw new ProjectError(
      `${paths(dir).project}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  return parsed.data;
}

export async function saveProject(dir: string, p: Project): Promise<void> {
  await writeFile(paths(dir).project, stringify(Project.parse(p)));
}

export const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
