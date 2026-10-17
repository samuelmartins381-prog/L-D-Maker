// A generation project (ADR 0013): one folder holding the sources, what was read from them, the
// storyboard, the approvals (gates) and the module. project.yaml is its identity card.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROFILE_IDS } from "@ldm/builder";
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

const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "expected a colour like #1a2b3c");

/** What Sam chooses for a project in the Studio (ADR 0014): it steers generation and export. */
export const Choices = {
  /** Brand or client the module is made for. */
  client: z.string().min(1).optional(),
  /** The brand's brief, as received. */
  brief: z.string().optional(),
  /** Packages to deliver, one per target platform (ADR 0016). */
  outputs: z
    .array(z.strictObject({ profile: z.enum(PROFILE_IDS) }))
    .min(1)
    .default([{ profile: "lms-unknown" }]),
  design: z
    .strictObject({
      /** Theme of the player (packages/player/src/themes). */
      theme: z.string().min(1).default("lumiere"),
      /** Brand kit: overrides the theme's colours and fonts, contrast-checked at build. */
      brand: z
        .strictObject({
          primary: Hex.optional(),
          accent: Hex.optional(),
          /** Logo file, relative to the project folder. */
          logo: z.string().optional(),
          headingFont: z.string().optional(),
          bodyFont: z.string().optional(),
        })
        .optional(),
    })
    .default({ theme: "lumiere" }),
  /** Amount of motion; always off for learners who ask for reduced motion. */
  animation: z.enum(["sober", "standard", "rich"]).default("standard"),
  assessment: z
    .strictObject({
      /** Question types the storyboard may use. */
      questionTypes: z
        .array(z.enum(["single", "multiple", "hotspot", "sequence"]))
        .min(1)
        .default(["single", "multiple", "hotspot", "sequence"]),
      /** Scored questions per objective (3 at least, rule of the pedagogical audit). */
      questionsPerObjective: z.int().min(3).max(10).default(3),
      passingScore: z.int().min(1).max(100).default(80),
      attempts: z.int().min(1).max(5).default(1),
    })
    .default({
      questionTypes: ["single", "multiple", "hotspot", "sequence"],
      questionsPerObjective: 3,
      passingScore: 80,
      attempts: 1,
    }),
  /** How learners are addressed (tu/vous, du/Sie…), in every language. */
  formality: z.enum(["formal", "informal"]).default("formal"),
};

export const Project = z.strictObject({
  schemaVersion: z.literal("0.2"),
  id: Id,
  title: z.string().min(1),
  /** Who the module is for: drives tone, examples and scenarios. */
  audience: z.string().min(1),
  durationMinutes: z.int().min(1).max(600),
  defaultLocale: Locale,
  locales: z.array(Locale).min(1),
  ...Choices,
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
  const data = parse(raw);
  // 0.1 had no choices: they take their defaults.
  if (data?.schemaVersion === "0.1") data.schemaVersion = "0.2";
  const parsed = Project.safeParse(data);
  if (!parsed.success)
    throw new ProjectError(
      `${paths(dir).project}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  return parsed.data;
}

export async function saveProject(
  dir: string,
  p: z.input<typeof Project>,
): Promise<void> {
  await writeFile(paths(dir).project, stringify(Project.parse(p)));
}

export const sha256 = (data: string | Uint8Array) =>
  createHash("sha256").update(data).digest("hex");
