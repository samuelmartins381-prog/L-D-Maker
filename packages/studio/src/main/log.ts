// Diagnostic journal of the Studio: what was asked of the main process, how long it took, what
// failed, and the interface's own errors. Names and durations only: never a key, never a text.
import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

let file: string | undefined;

/** Where the journal goes: set once at start-up (Electron's userData folder). */
export function setLogFolder(folder: string): string {
  file = join(folder, "studio.log");
  mkdirSync(dirname(file), { recursive: true });
  // One previous journal is kept; the current one never grows past 2 MB.
  try {
    if (statSync(file).size > 2_000_000) renameSync(file, `${file}.1`);
  } catch {
    // No journal yet.
  }
  return file;
}

export function logPath(): string | undefined {
  return file;
}

export function log(message: string): void {
  if (!file) return;
  try {
    appendFileSync(file, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // A journal that cannot be written must never break the Studio.
  }
}
