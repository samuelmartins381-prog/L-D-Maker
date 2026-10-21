// The narrow bridge between the Studio's interface and its main process (ADR 0014): the
// interface never touches files or keys itself; it calls these functions through the preload.
import type { ProfileId } from "@ldm/builder/profiles";
import type {
  Project,
  ProjectState,
  Storyboard,
  StoryboardIssue,
} from "@ldm/generator";

export type { ProfileId, Project, ProjectState, Storyboard, StoryboardIssue };

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
  /** Generation possible: a key is stored (or a test double is configured). */
  canGenerate: boolean;
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

export interface GenerationEstimate {
  model: string;
  inputTokens: number;
  lowUsd: number;
  highUsd: number;
}

export interface GenerationSummary {
  rounds: number;
  errors: number;
  warnings: number;
  costUsd: number;
}

/** Progress of a generation, pushed by the main process. */
export type GenerationProgress =
  | {
      stage: "writing";
      round: number;
      chars: number;
      /** The characters are Claude's thinking, not yet the answer. */
      thinking?: boolean;
      locale?: string;
    }
  | { stage: "checking"; round: number; locale?: string }
  | { stage: "done" };

export interface ModuleEstimate extends GenerationEstimate {
  /** Languages the module will then be translated into, and the price range of that. */
  translationLocales: string[];
  translationLowUsd: number;
  translationHighUsd: number;
}

export interface ModuleWriteSummary extends GenerationSummary {
  /** Claude's notes for Sam (a missing image, an assumption…). */
  notes: string[];
  /** Languages translated after writing. */
  translated: string[];
}

export interface TranslationSummary {
  translated: { locale: string; texts: number }[];
  costUsd: number;
}

/** The module's texts in the writing language, grouped as the learner meets them. */
export interface ModuleTexts {
  defaultLocale: string;
  groups: {
    id: string;
    title: string;
    entries: { key: string; field: string; text: string }[];
  }[];
}

export interface ExportSummary {
  folder: string;
  files: string[];
  /** Profiles exported in a generic format until their own options are ready (ADR 0016). */
  generic: string[];
}

/** What the storyboard screen shows and edits. */
export interface StoryboardDetail {
  /** Absent when storyboard.yaml cannot be read (the issues say why). */
  storyboard?: Storyboard;
  issues: StoryboardIssue[];
  hash: string;
  /** current: the approval is for the storyboard as it is now. */
  approval?: { at: string; by: string; current: boolean };
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
  /** Price range of generating the storyboard (counts what would be sent). */
  estimateStoryboard(dir: string): Promise<Result<GenerationEstimate>>;
  /** Claude writes storyboard.yaml from the sources, the brief and the choices. */
  generateStoryboard(dir: string): Promise<Result<GenerationSummary>>;
  storyboard(dir: string): Promise<Result<StoryboardDetail>>;
  /** Writes Sam's edits to storyboard.yaml (an earlier approval no longer applies). */
  saveStoryboard(
    dir: string,
    storyboard: Storyboard,
  ): Promise<Result<StoryboardDetail>>;
  /** Records the approval: the gate before the module is written. */
  approveStoryboard(dir: string): Promise<Result<StoryboardDetail>>;
  /** Price of writing the module, then translating it into the project's languages. */
  estimateModule(dir: string): Promise<Result<ModuleEstimate>>;
  /** Claude writes the module from the approved storyboard, then translates it. */
  writeModule(dir: string): Promise<Result<ModuleWriteSummary>>;
  /** Translates the texts new or changed since the last translation, in every language. */
  translateModule(dir: string): Promise<Result<TranslationSummary>>;
  /** Builds the module and opens it in the browser, as a learner sees it. */
  previewModule(dir: string): Promise<Result<void>>;
  moduleTexts(dir: string): Promise<Result<ModuleTexts>>;
  saveModuleTexts(
    dir: string,
    changes: Record<string, string>,
  ): Promise<Result<ModuleTexts>>;
  /** One package per output chosen for the project, in out/; the folder opens. */
  exportModule(dir: string): Promise<Result<ExportSummary>>;
  /** Writes a line in the Studio's diagnostic journal (interface errors). */
  log(message: string): Promise<void>;
  /** Opens the diagnostic journal, to send it when something goes wrong. */
  openLog(): Promise<void>;
  /** Subscribes to generation progress; returns the unsubscribe function. */
  onGenerationProgress(listener: (p: GenerationProgress) => void): () => void;
}

declare global {
  interface Window {
    ldm: StudioApi;
  }
}
