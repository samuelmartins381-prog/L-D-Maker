// Storyboard: the plan of a module, written by Claude from the ingested sources and validated by Sam
// before any module text is written (ADR 0013). It names every screen and block that the module will
// contain, why it is there, what it will say, which objective it serves and which source passages it
// draws on. Checks here reproduce the pedagogical rules of CLAUDE.md before Sam even reads it.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Id, Locale } from "@ldm/schema";
import { parse } from "yaml";
import { z } from "zod";
import { type IngestIndex, loadIngest } from "./ingest.ts";
import { loadProject, paths, sha256 } from "./project.ts";

/** "<source file>#<place>", as listed in ingest/ingest.json. */
export const SourceRef = z
  .string()
  .regex(
    /^[^#\s]+#[a-z0-9-]+$/,
    "source anchor expected, e.g. guide.pdf#h-intro",
  );

const PlannedChoice = z.strictObject({
  text: z.string().min(1),
  /** single, multiple, hotspot: required. sequence: absent (the listed order is the answer). */
  correct: z.boolean().optional(),
  /** For a wrong option: the real misconception it targets (audit rule). */
  misconception: z.string().min(1).optional(),
});

export const BLOCK_TYPES = [
  "narrative",
  "accordion",
  "tabs",
  "hotspots",
  "question",
  "summary",
] as const;

const PlannedBlock = z.strictObject({
  id: Id,
  type: z.enum(BLOCK_TYPES),
  /** Questions only. */
  variant: z.enum(["single", "multiple", "hotspot", "sequence"]).optional(),
  /** Questions only: scored (assessment) or practice. */
  scored: z.boolean().optional(),
  /** Pedagogical role checked by the audit rules. */
  role: z.enum(["worked-example", "self-regulation"]).optional(),
  /** Why this block is here. */
  intent: z.string().min(1),
  /** What it will say or show, in a few sentences. */
  content: z.string().min(1),
  objectives: z.array(Id).default([]),
  sourceRefs: z.array(SourceRef).default([]),
  /** Media to draw or provide, described. */
  media: z.string().min(1).optional(),
  choices: z.array(PlannedChoice).optional(),
});

const PlannedScreen = z.strictObject({
  id: Id,
  title: z.string().min(1),
  /** Estimated learner time on this screen. */
  minutes: z.number().positive().max(30),
  blocks: z.array(PlannedBlock).min(1),
});

export const Storyboard = z.strictObject({
  schemaVersion: z.literal("0.1"),
  module: z.strictObject({
    id: Id,
    title: z.string().min(1),
    audience: z.string().min(1),
    durationMinutes: z.int().min(1),
    defaultLocale: Locale,
  }),
  objectives: z
    .array(
      z.strictObject({
        id: Id,
        bloom: z.enum([
          "remember",
          "understand",
          "apply",
          "analyze",
          "evaluate",
          "create",
        ]),
        text: z.string().min(1),
        sourceRefs: z.array(SourceRef).min(1),
      }),
    )
    .min(1),
  assessment: z.strictObject({ passingScore: z.int().min(0).max(100) }),
  sections: z
    .array(
      z.strictObject({
        id: Id,
        title: z.string().min(1),
        screens: z.array(PlannedScreen).min(1),
      }),
    )
    .min(1),
  /** What Sam is asked to decide when reviewing. */
  openQuestions: z.array(z.string().min(1)).default([]),
});
export type Storyboard = z.infer<typeof Storyboard>;
export type PlannedBlock = z.infer<typeof PlannedBlock>;

export interface StoryboardIssue {
  severity: "error" | "warning";
  code: string;
  where: string;
  message: string;
}

export interface StoryboardResult {
  storyboard?: Storyboard;
  issues: StoryboardIssue[];
  /** sha256 of storyboard.yaml (what an approval refers to). */
  hash: string;
}

/** Blocks in reading order, with where they are. */
export function plannedBlocks(sb: Storyboard) {
  return sb.sections.flatMap((s, si) =>
    s.screens.flatMap((sc, sci) =>
      sc.blocks.map((b, bi) => ({
        block: b,
        screen: sc,
        where: `sections[${si}].screens[${sci}].blocks[${bi}] (${b.id})`,
      })),
    ),
  );
}

/** Pedagogical, structural and traceability checks (ADR 0013, CLAUDE.md audit rules). */
export function checkStoryboard(
  sb: Storyboard,
  ingest: IngestIndex | null,
  project: {
    id: string;
    durationMinutes: number;
    /** Sam's choices (project.yaml 0.2); the defaults when absent. */
    assessment?: {
      questionTypes: string[];
      questionsPerObjective: number;
      passingScore: number;
    };
  },
): StoryboardIssue[] {
  const issues: StoryboardIssue[] = [];
  const err = (code: string, where: string, message: string) =>
    issues.push({ severity: "error", code, where, message });
  const warn = (code: string, where: string, message: string) =>
    issues.push({ severity: "warning", code, where, message });

  if (sb.module.id !== project.id)
    err("project", "module.id", `must be the project id "${project.id}"`);

  // Unique ids: they become module ids (screens, blocks) and tracking identifiers.
  const seen = new Set<string>();
  const claim = (id: string, where: string) => {
    if (seen.has(id)) err("duplicate-id", where, `id "${id}" used twice`);
    seen.add(id);
  };
  for (const o of sb.objectives) claim(o.id, `objectives (${o.id})`);
  for (const s of sb.sections) {
    claim(s.id, `sections (${s.id})`);
    for (const sc of s.screens) {
      claim(sc.id, `screens (${sc.id})`);
      for (const b of sc.blocks) claim(b.id, `blocks (${b.id})`);
    }
  }

  // Traceability: every reference exists, every content block has one.
  const anchors = new Set(
    ingest?.sources.flatMap((s) => s.anchors.map((a) => a.id)) ?? [],
  );
  if (!ingest)
    err("ingest", "ingest/", "sources not read yet (pnpm gen ingest)");
  const checkRefs = (refs: string[], where: string) => {
    for (const r of refs)
      if (ingest && !anchors.has(r))
        err("source-ref", where, `unknown source anchor "${r}"`);
  };
  sb.objectives.forEach((o) => {
    checkRefs(o.sourceRefs, `objectives (${o.id})`);
  });

  const objectiveIds = new Set(sb.objectives.map((o) => o.id));
  const blocks = plannedBlocks(sb);
  const scoredBy = new Map<string, PlannedBlock[]>();
  let workedExampleSeen = false;
  let practiceBeforeExample: string | null = null;
  for (const { block: b, where } of blocks) {
    checkRefs(b.sourceRefs, where);
    if (b.type !== "summary" && b.sourceRefs.length === 0)
      err("unsourced", where, "content block without any source anchor");
    for (const o of b.objectives)
      if (!objectiveIds.has(o))
        err("unknown-objective", where, `unknown objective "${o}"`);
    if (b.role === "worked-example") workedExampleSeen = true;

    if (b.type !== "question") {
      if (b.variant || b.scored !== undefined || b.choices)
        err(
          "question-fields",
          where,
          "variant, scored and choices are for questions only",
        );
      continue;
    }
    if (!b.variant) err("question", where, "question needs a variant");
    const choices = b.choices ?? [];
    if (choices.length < 2)
      err("question", where, "question needs at least 2 choices");
    const scored = b.scored ?? true;
    if (!scored && !workedExampleSeen && !practiceBeforeExample)
      practiceBeforeExample = where;
    if (scored) {
      if (b.objectives.length === 0)
        err("alignment", where, "scored question must serve an objective");
      for (const o of b.objectives)
        scoredBy.set(o, [...(scoredBy.get(o) ?? []), b]);
    }
    const correct = choices.filter((c) => c.correct).length;
    if (b.variant === "sequence") {
      if (choices.some((c) => c.correct !== undefined))
        err(
          "answer-key",
          where,
          "sequence steps have no correct flag: their order is the answer",
        );
      if (choices.length < 3)
        err("answer-key", where, "a sequence needs at least 3 steps");
    } else if (choices.some((c) => c.correct === undefined))
      err("answer-key", where, "every choice needs correct: true or false");
    else if (
      b.variant === "multiple"
        ? correct < 1 || correct === choices.length
        : correct !== 1
    )
      err(
        "answer-key",
        where,
        `${b.variant} question: wrong number of correct choices (${correct})`,
      );
    for (const c of choices)
      if (c.correct === false && !c.misconception)
        warn(
          "distractor",
          where,
          `option "${c.text}": name the real misconception it targets`,
        );
    if (
      b.variant &&
      project.assessment &&
      !project.assessment.questionTypes.includes(b.variant)
    )
      err(
        "question-type",
        where,
        `${b.variant} is not among the question types chosen for the project (${project.assessment.questionTypes.join(", ")})`,
      );
    if (b.variant === "hotspot" && !b.media)
      err(
        "media",
        where,
        "hotspot question needs its image described in media",
      );
  }

  // Alignment: each objective is assessed, by enough items, not only visually.
  const scoredCount = new Set([...scoredBy.values()].flat().map((b) => b.id))
    .size;
  for (const o of sb.objectives) {
    const items = scoredBy.get(o.id) ?? [];
    if (items.length === 0)
      err(
        "alignment",
        `objectives (${o.id})`,
        "not assessed by any scored question",
      );
    else if (items.length < (project.assessment?.questionsPerObjective ?? 3))
      warn(
        "assessment-items",
        `objectives (${o.id})`,
        `${items.length} scored question(s): plan at least ${project.assessment?.questionsPerObjective ?? 3} for a reliable measure`,
      );
    if (items.length && items.every((b) => b.variant === "hotspot"))
      warn(
        "visual-only-assessment",
        `objectives (${o.id})`,
        "assessed only by image questions: add a text question (ADR 0010)",
      );
  }
  if (
    project.assessment &&
    sb.assessment.passingScore !== project.assessment.passingScore
  )
    err(
      "passing-score",
      "assessment.passingScore",
      `${sb.assessment.passingScore} % instead of the ${project.assessment.passingScore} % chosen for the project`,
    );
  const tolerated =
    scoredCount - Math.ceil((scoredCount * sb.assessment.passingScore) / 100);
  if (scoredCount > 0 && sb.assessment.passingScore > 0 && tolerated < 1)
    warn(
      "assessment-tolerance",
      "assessment.passingScore",
      `${scoredCount} scored question(s) at ${sb.assessment.passingScore} %: a single mistake fails`,
    );

  // Audit rules: worked example before practice, self-regulation routine in the summary.
  if (practiceBeforeExample)
    warn(
      "worked-example",
      practiceBeforeExample,
      "practice comes before any worked example (role: worked-example)",
    );
  if (
    !blocks.some(
      ({ block: b }) => b.type === "summary" && b.role === "self-regulation",
    )
  )
    warn(
      "self-regulation",
      "sections",
      "no summary with a self-regulation routine (role: self-regulation)",
    );

  // Duration: the plan should fit the target within 25 %.
  const minutes = sb.sections
    .flatMap((s) => s.screens)
    .reduce((n, sc) => n + sc.minutes, 0);
  if (
    Math.abs(minutes - project.durationMinutes) >
    project.durationMinutes * 0.25
  )
    warn(
      "duration",
      "screens.minutes",
      `${minutes} min planned for a ${project.durationMinutes} min target`,
    );
  if (sb.module.durationMinutes !== project.durationMinutes)
    warn("duration", "module.durationMinutes", "differs from project.yaml");
  return issues;
}

/** Reads, parses and checks storyboard.yaml. */
export async function loadStoryboard(dir: string): Promise<StoryboardResult> {
  const p = paths(dir);
  let raw: string;
  try {
    raw = await readFile(p.storyboard, "utf8");
  } catch {
    return {
      hash: "",
      issues: [
        {
          severity: "error",
          code: "missing",
          where: "storyboard.yaml",
          message: "no storyboard yet",
        },
      ],
    };
  }
  const hash = sha256(raw);
  const parsed = Storyboard.safeParse(parse(raw));
  if (!parsed.success)
    return {
      hash,
      issues: parsed.error.issues.map((i) => ({
        severity: "error",
        code: "schema",
        where: i.path.map(String).join(".") || "(root)",
        message: i.message,
      })),
    };
  const project = await loadProject(dir);
  return {
    hash,
    storyboard: parsed.data,
    issues: checkStoryboard(parsed.data, await loadIngest(dir), project),
  };
}

export class GateError extends Error {}

/** Sam's gate: the storyboard on disk must be the one Sam approved. */
export async function assertApproved(dir: string): Promise<Storyboard> {
  const project = await loadProject(dir);
  const { storyboard, hash, issues } = await loadStoryboard(dir);
  if (!storyboard || issues.some((i) => i.severity === "error"))
    throw new GateError("storyboard missing or invalid (pnpm gen storyboard)");
  const approval = project.approvals.storyboard;
  if (!approval) throw new GateError("storyboard not approved by Sam yet");
  if (approval.hash !== hash)
    throw new GateError(
      "storyboard changed since Sam approved it: have the new version approved",
    );
  return storyboard;
}

/** Text of the source passage behind an anchor (until the next anchor), for the review page. */
export async function excerpt(
  dir: string,
  ingest: IngestIndex,
  ref: string,
  max = 360,
): Promise<string | null> {
  const [file] = ref.split("#");
  const source = ingest.sources.find((s) => s.file === file);
  if (!source) return null;
  const text = await readFile(join(paths(dir).ingest, source.markdown), "utf8");
  const start = text.indexOf(`<!-- src:${ref} -->`);
  if (start < 0) return null;
  // The passage runs to the next anchor; a page anchor directly followed by a heading anchor
  // has no text of its own, so the following passages are joined until there is some.
  const segments = text
    .slice(start)
    .split(/<!-- src:\S+ -->/)
    .slice(1)
    .map((seg) =>
      seg
        .replace(/^#+\s*/gm, "")
        .replace(/[*_`]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
  const passage = segments.find((seg) => seg) ?? "";
  return passage.length > max
    ? `${passage.slice(0, max).replace(/\s\S*$/, "")}…`
    : passage;
}
