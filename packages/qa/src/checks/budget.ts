// Player weight budget (phase 0 §5.4): JS ≤ 60 KB gzip, CSS ≤ 20 KB gzip, fonts and media excluded.
// Locale packs (locales/*.js, ADR 0007) are module text, not player code: like the strings embedded
// in index.html they are left out of the budget, and reported separately.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { CheckResult } from "../types.ts";

const KB = 1024;
/** Same folder as LOCALES_DIR in packages/player/src/content.ts. */
const LOCALES_DIR = "locales";

export async function budgetCheck(webDir: string): Promise<CheckResult> {
  const files = await readdir(webDir, { recursive: true });
  const isPack = (f: string) => f.startsWith(`${LOCALES_DIR}/`);
  const size = async (ext: string, pack = false) => {
    let total = 0;
    for (const f of files.filter((f) => f.endsWith(ext) && isPack(f) === pack))
      total += gzipSync(await readFile(join(webDir, f)), { level: 9 }).length;
    return total;
  };
  const js = await size(".js");
  const css = await size(".css");
  const packs = files.filter((f) => isPack(f) && f.endsWith(".js")).length;
  const packWeight = await size(".js", true);
  const ok = js <= 60 * KB && css <= 20 * KB;
  return {
    id: "player-budget",
    title: "Poids du lecteur",
    criterion: "JS ≤ 60 Ko gzip, CSS ≤ 20 Ko gzip (hors polices et médias)",
    status: ok ? "pass" : "fail",
    summary: `JS ${(js / KB).toFixed(1)} Ko · CSS ${(css / KB).toFixed(1)} Ko (gzip)`,
    details: packs
      ? [
          `Hors budget : ${packs} fichier(s) de langue chargé(s) à la demande, ${(packWeight / KB).toFixed(1)} Ko gzip au total`,
        ]
      : [],
  };
}
