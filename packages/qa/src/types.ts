// A QA check result. Titles and summaries are in French: the report is read by Sam (docs language).
export type Status = "pass" | "fail" | "warn" | "manual";

export interface CheckResult {
  id: string;
  title: string;
  /** The quality bar it proves (brief §5 / phase 0 §5.4). */
  criterion: string;
  status: Status;
  summary: string;
  details: string[];
}

export interface Viewport {
  name: "mobile" | "desktop";
  width: number;
  height: number;
}

export const VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];
