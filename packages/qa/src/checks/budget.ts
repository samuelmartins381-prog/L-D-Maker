// Player weight budget (phase 0 §5.4): JS ≤ 60 KB gzip, CSS ≤ 20 KB gzip, fonts and media excluded.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { CheckResult } from "../types.ts";

const KB = 1024;

export async function budgetCheck(webDir: string): Promise<CheckResult> {
  const files = await readdir(webDir, { recursive: true });
  const size = async (ext: string) => {
    let total = 0;
    for (const f of files.filter((f) => f.endsWith(ext)))
      total += gzipSync(await readFile(join(webDir, f)), { level: 9 }).length;
    return total;
  };
  const js = await size(".js");
  const css = await size(".css");
  const ok = js <= 60 * KB && css <= 20 * KB;
  return {
    id: "player-budget",
    title: "Poids du lecteur",
    criterion: "JS ≤ 60 Ko gzip, CSS ≤ 20 Ko gzip (hors polices et médias)",
    status: ok ? "pass" : "fail",
    summary: `JS ${(js / KB).toFixed(1)} Ko · CSS ${(css / KB).toFixed(1)} Ko (gzip)`,
    details: [],
  };
}
