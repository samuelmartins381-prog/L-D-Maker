// Projects in the shared folder (ADR 0014): listing, creation, sources, and the lock that keeps
// Sam and Kylian from changing the same project at the same time. No Electron here: tested in Node.
import { readFileSync, unlinkSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, extname, join } from "node:path";
import {
  ingestProject,
  loadProject,
  paths,
  projectState,
  saveProject,
  slugify,
} from "@ldm/generator";
import type {
  Lock,
  NewProject,
  ProjectDetail,
  ProjectSummary,
  SourceFile,
} from "../shared/api.ts";

export const LOCK_FILE = ".ldm-lock";
/** A lock older than this is forgotten (the Studio that held it closed without releasing). */
export const LOCK_TTL_MS = 12 * 60 * 60 * 1000;
export const SOURCE_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".md",
  ".markdown",
  ".txt",
];

export class StudioError extends Error {}

async function readLock(dir: string): Promise<Lock | undefined> {
  try {
    const lock = JSON.parse(
      await readFile(join(dir, LOCK_FILE), "utf8"),
    ) as Lock;
    return Date.now() - Date.parse(lock.at) < LOCK_TTL_MS ? lock : undefined;
  } catch {
    return undefined;
  }
}

/** The lock when someone else holds it, else undefined. */
async function foreignLock(dir: string, me: string): Promise<Lock | undefined> {
  const lock = await readLock(dir);
  return lock && lock.by !== me ? lock : undefined;
}

export async function acquireLock(
  dir: string,
  me: string,
  force = false,
): Promise<Lock | undefined> {
  const other = await foreignLock(dir, me);
  if (other && !force) return other;
  await writeFile(
    join(dir, LOCK_FILE),
    `${JSON.stringify({ by: me, at: new Date().toISOString() })}\n`,
  );
  return undefined;
}

export async function releaseLock(dir: string, me: string): Promise<void> {
  const lock = await readLock(dir);
  if (lock?.by === me) await rm(join(dir, LOCK_FILE), { force: true });
}

/** Synchronous release, for the moment the Studio quits (async work may not finish then). */
export function releaseLockSync(dir: string, me: string): void {
  try {
    const lock = JSON.parse(readFileSync(join(dir, LOCK_FILE), "utf8")) as Lock;
    if (lock.by === me) unlinkSync(join(dir, LOCK_FILE));
  } catch {
    // No lock, or not readable: nothing to release.
  }
}

export async function assertEditable(dir: string, me: string): Promise<void> {
  const other = await foreignLock(dir, me);
  if (other) throw new StudioError(`locked by ${other.by} since ${other.at}`);
}

async function summary(dir: string, me: string): Promise<ProjectSummary> {
  const project = await loadProject(dir);
  const lock = await foreignLock(dir, me);
  return {
    dir,
    id: project.id,
    title: project.title,
    ...(project.client ? { client: project.client } : {}),
    state: await projectState(dir),
    ...(lock ? { lockedBy: lock } : {}),
  };
}

async function listSources(dir: string): Promise<SourceFile[]> {
  const folder = paths(dir).sources;
  const files = (await readdir(folder).catch(() => [] as string[]))
    .filter((f) => SOURCE_EXTENSIONS.includes(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return Promise.all(
    files.map(async (file) => ({
      file,
      bytes: (await stat(join(folder, file))).size,
    })),
  );
}

export async function projectDetail(
  dir: string,
  me: string,
): Promise<ProjectDetail> {
  const base = await summary(dir, me);
  return {
    ...base,
    project: await loadProject(dir),
    sources: await listSources(dir),
    editable: !base.lockedBy,
  };
}

/** Every folder of `root` holding a project.yaml, most recently changed first. */
export async function listProjects(
  root: string,
  me: string,
): Promise<ProjectSummary[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const found: { summary: ProjectSummary; mtime: number }[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const dir = join(root, e.name);
    const file = paths(dir).project;
    const info = await stat(file).catch(() => undefined);
    if (!info) continue;
    try {
      found.push({ summary: await summary(dir, me), mtime: info.mtimeMs });
    } catch {
      // An unreadable project.yaml is skipped rather than hiding every other project.
    }
  }
  return found.sort((a, b) => b.mtime - a.mtime).map((f) => f.summary);
}

async function uniqueDir(
  root: string,
  id: string,
): Promise<{ id: string; dir: string }> {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? id : `${id}-${n}`;
    const dir = join(root, candidate);
    if (!(await stat(dir).catch(() => undefined)))
      return { id: candidate, dir };
  }
}

function checkSourceNames(files: string[]): void {
  const rejected = files.filter(
    (f) => !SOURCE_EXTENSIONS.includes(extname(f).toLowerCase()),
  );
  if (rejected.length)
    throw new StudioError(
      `unsupported file type: ${rejected.map((f) => basename(f)).join(", ")}`,
    );
}

export async function createProject(
  root: string,
  input: NewProject,
  me: string,
): Promise<ProjectDetail> {
  checkSourceNames(input.sources);
  const { id, dir } = await uniqueDir(root, slugify(input.title));
  await mkdir(paths(dir).sources, { recursive: true });
  await saveProject(dir, {
    schemaVersion: "0.2",
    id,
    title: input.title,
    audience: input.audience,
    durationMinutes: input.durationMinutes,
    defaultLocale: input.defaultLocale,
    locales: [
      input.defaultLocale,
      ...input.locales.filter((l) => l !== input.defaultLocale),
    ],
    ...(input.client ? { client: input.client } : {}),
    ...(input.brief ? { brief: input.brief } : {}),
    outputs: input.outputs.map((profile) => ({ profile })),
    design: {
      theme: input.theme,
      ...(input.brand?.primary || input.brand?.accent
        ? {
            brand: {
              ...(input.brand.primary ? { primary: input.brand.primary } : {}),
              ...(input.brand.accent ? { accent: input.brand.accent } : {}),
            },
          }
        : {}),
    },
    animation: input.animation,
    assessment: {
      questionTypes: input.questionTypes as (
        | "single"
        | "multiple"
        | "hotspot"
        | "sequence"
      )[],
      questionsPerObjective: input.questionsPerObjective,
      passingScore: input.passingScore,
      attempts: input.attempts,
    },
    formality: input.formality,
    approvals: {},
  });
  await acquireLock(dir, me);
  for (const src of input.sources)
    await copyFile(src, join(paths(dir).sources, basename(src)));
  return projectDetail(dir, me);
}

export async function addSources(
  dir: string,
  files: string[],
  me: string,
): Promise<ProjectDetail> {
  await assertEditable(dir, me);
  checkSourceNames(files);
  await mkdir(paths(dir).sources, { recursive: true });
  for (const src of files)
    await copyFile(src, join(paths(dir).sources, basename(src)));
  return projectDetail(dir, me);
}

export async function removeSource(
  dir: string,
  file: string,
  me: string,
): Promise<ProjectDetail> {
  await assertEditable(dir, me);
  if (basename(file) !== file)
    throw new StudioError(`invalid source name: ${file}`);
  await rm(join(paths(dir).sources, file), { force: true });
  return projectDetail(dir, me);
}

export async function ingest(dir: string, me: string): Promise<ProjectDetail> {
  await assertEditable(dir, me);
  await ingestProject(dir);
  return projectDetail(dir, me);
}
