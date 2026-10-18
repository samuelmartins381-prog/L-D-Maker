// Sam's edits and approval of the storyboard (ADR 0013), shared by the CLI and the Studio.
import { copyFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import { loadProject, paths, saveProject } from "./project.ts";
import { refreshReview } from "./review.ts";
import {
  GateError,
  loadStoryboard,
  Storyboard,
  type StoryboardResult,
} from "./storyboard.ts";

/** Writes an edited storyboard (the previous file is kept), checks it and refreshes the review page. */
export async function saveStoryboard(
  dir: string,
  storyboard: unknown,
  by: string,
): Promise<StoryboardResult> {
  // Refuse a malformed storyboard before touching the file on disk.
  const parsed = Storyboard.parse(storyboard);
  const file = paths(dir).storyboard;
  await copyFile(file, join(dir, "storyboard.previous.yaml")).catch(() => {});
  const header = `# Storyboard edited by ${by} on ${new Date().toISOString().slice(0, 10)}.\n`;
  await writeFile(file, header + stringify(parsed));
  return refreshReview(dir);
}

/** Records the approval of the storyboard as it is on disk now: the gate before writing the module. */
export async function approveStoryboard(
  dir: string,
  by: string,
): Promise<StoryboardResult> {
  const { storyboard, issues, hash } = await loadStoryboard(dir);
  if (!storyboard || issues.some((i) => i.severity === "error"))
    throw new GateError("storyboard missing or invalid: nothing approved");
  const project = await loadProject(dir);
  project.approvals.storyboard = {
    hash,
    at: new Date().toISOString().slice(0, 10),
    by,
  };
  await saveProject(dir, project);
  return refreshReview(dir); // the review page now shows "approved"
}
