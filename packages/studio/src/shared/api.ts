// The narrow bridge between the Studio's interface and its main process (ADR 0014): the
// interface never touches files or keys itself; it calls these functions through the preload.
import type { ProfileId } from "@ldm/builder/profiles";
import type { Project, ProjectState } from "@ldm/generator";

export type { ProfileId, Project, ProjectState };

/** Languages a module can be produced in: one player interface catalogue each (ADR 0007). */
export const MODULE_LOCALES = [
  "fr",
  "en",
  "de",
  "it",
  "es",
  "pt-BR",
  "ru",
  "ar",
  "ja",
  "zh-Hans",
  "ko",
] as const;

/** Player themes (packages/player/src/themes). */
export const THEMES = ["lumiere"] as const;

export const QUESTION_TYPES = [
  "single",
  "multiple",
  "hotspot",
  "sequence",
] as const;

export const STUDIO_LOCALES = ["fr", "en"] as const;
export type StudioLocale = (typeof STUDIO_LOCALES)[number];

export interface Settings {
  /** Folder holding the projects, usually inside a shared cloud folder. */
  projectsDir?: string;
  /** First name, written in locks and approvals. */
  userName?: string;
  /** The key itself never leaves the main process. */
  hasApiKey: boolean;
  /** false when the system offers no keychain (the key cannot be stored safely). */
  canStoreKey: boolean;
  locale: StudioLocale;
}

export interface Lock {
  by: string;
  at: string;
}

export interface ProjectSummary {
  dir: string;
  id: string;
  title: string;
  client?: string;
  state: ProjectState;
  /** Set when someone else has the project open. */
  lockedBy?: Lock;
}

export interface SourceFile {
  file: string;
  bytes: number;
}

export interface ProjectDetail extends ProjectSummary {
  project: Project;
  sources: SourceFile[];
  /** true when this Studio holds the lock and may change the project. */
  editable: boolean;
}

/** What the new-project form collects; everything but the sources lands in project.yaml. */
export interface NewProject {
  title: string;
  client?: string;
  brief?: string;
  audience: string;
  durationMinutes: number;
  defaultLocale: string;
  locales: string[];
  outputs: ProfileId[];
  theme: string;
  brand?: { primary?: string; accent?: string };
  animation: "sober" | "standard" | "rich";
  questionTypes: string[];
  questionsPerObjective: number;
  passingScore: number;
  attempts: number;
  formality: "formal" | "informal";
  /** Absolute paths of the files to copy into sources/. */
  sources: string[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface StudioApi {
  settings(): Promise<Settings>;
  setUserName(name: string): Promise<Settings>;
  setLocale(locale: StudioLocale): Promise<Settings>;
  chooseProjectsDir(): Promise<Settings>;
  setApiKey(key: string | null): Promise<Result<Settings>>;

  listProjects(): Promise<Result<ProjectSummary[]>>;
  createProject(input: NewProject): Promise<Result<ProjectDetail>>;
  /** Opens a project and takes its lock, unless someone else holds it (then read-only). */
  openProject(dir: string, force?: boolean): Promise<Result<ProjectDetail>>;
  closeProject(dir: string): Promise<void>;
  pickSources(): Promise<string[]>;
  /** Path of a file dropped on the window (Electron's webUtils). */
  pathForFile(file: File): string;
  addSources(dir: string, files: string[]): Promise<Result<ProjectDetail>>;
  removeSource(dir: string, file: string): Promise<Result<ProjectDetail>>;
  /** Reads the sources again (after adding or changing some). */
  ingest(dir: string): Promise<Result<ProjectDetail>>;
  openPath(path: string): Promise<void>;
}

declare global {
  interface Window {
    ldm: StudioApi;
  }
}
