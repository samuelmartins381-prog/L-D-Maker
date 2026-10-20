// Interface state: which screen is shown, the settings, the open project and the last error.
import type {
  ProjectDetail,
  ProjectState,
  Result,
  Settings,
} from "../shared/api.ts";
import { setLocale } from "./i18n.svelte.ts";

export type Screen =
  | "welcome"
  | "projects"
  | "new"
  | "project"
  | "storyboard"
  | "texts"
  | "settings";

export const app = $state<{
  screen: Screen;
  settings: Settings | null;
  project: ProjectDetail | null;
  error: string | null;
  /** Result of the last long task on a project, kept in view after the page changes. */
  notice: { dir: string; lines: string[]; notes: string[] } | null;
}>({
  screen: "projects",
  settings: null,
  project: null,
  error: null,
  notice: null,
});

export async function loadSettings(): Promise<void> {
  const s = await window.ldm.settings();
  app.settings = s;
  setLocale(s.locale);
  if (!s.userName || !s.projectsDir) app.screen = "welcome";
}

/** The value of a main-process call, or null after showing its error. */
export function unwrap<T>(r: Result<T>): T | null {
  if (r.ok) {
    app.error = null;
    return r.value;
  }
  app.error = r.error;
  return null;
}

export async function openProject(dir: string, force = false): Promise<void> {
  const detail = unwrap(await window.ldm.openProject(dir, force));
  if (!detail) return;
  app.project = detail;
  app.screen = "project";
}

export async function closeProject(): Promise<void> {
  if (app.project?.editable) await window.ldm.closeProject(app.project.dir);
  app.project = null;
  app.screen = "projects";
}

export type StageKey =
  | "stage.sources"
  | "stage.ingest"
  | "stage.storyboard"
  | "stage.storyboardInvalid"
  | "stage.approval"
  | "stage.approvalOutdated"
  | "stage.module"
  | "stage.moduleInvalid"
  | "stage.translations"
  | "stage.export"
  | "stage.ready";

/** The step a project is waiting for, as a catalogue key. */
export function stageOf(s: ProjectState, hasSources = true): StageKey {
  if (s.ingest.state === "missing")
    return hasSources ? "stage.ingest" : "stage.sources";
  if (s.ingest.state === "stale") return "stage.ingest";
  if (s.storyboard.state === "missing") return "stage.storyboard";
  if (s.storyboard.state === "invalid") return "stage.storyboardInvalid";
  if (s.approval.state === "missing") return "stage.approval";
  if (s.approval.state === "outdated") return "stage.approvalOutdated";
  if (!s.module.exists) return "stage.module";
  if (s.module.errors) return "stage.moduleInvalid";
  if (s.module.translations.some((x) => x.pending)) return "stage.translations";
  return s.module.exports.length ? "stage.ready" : "stage.export";
}
