#!/usr/bin/env node
// Validates a built SCORM 1.2 package on SCORM Cloud (Rustici), the brief's reference LMS.
// Credentials come only from SCORM_CLOUD_APP_ID / SCORM_CLOUD_SECRET_KEY (environment secrets).
// Usage: node packages/qa/src/scorm-cloud.ts <module-folder> [--version 1.2|2004]   (build the module first)
// Run with NODE_USE_ENV_PROXY=1 when outbound traffic goes through a proxy.
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadModuleSource, type Question, validateModule } from "@ldm/schema";
import {
  type BrowserContext,
  chromium,
  type Frame,
  type Page,
} from "playwright-core";
import { CHROMIUM_PATH } from "./browser.ts";

const API = "https://cloud.scorm.com/api/v2";
const appId = process.env.SCORM_CLOUD_APP_ID;
const secret = process.env.SCORM_CLOUD_SECRET_KEY;
if (!appId || !secret) {
  console.error(
    "SCORM_CLOUD_APP_ID and SCORM_CLOUD_SECRET_KEY must be set (environment secrets)",
  );
  process.exit(2);
}
const auth = `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`;

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = { method, headers: { authorization: auth } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { authorization: auth, "content-type": "application/json" };
  }
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok)
    throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

interface ImportJob {
  status: "RUNNING" | "COMPLETE" | "ERROR";
  message?: string;
  importResult?: {
    parserWarnings?: string[];
    course?: { title?: string; version?: number };
  };
}

interface Activity {
  runtime?: Record<string, unknown> & { runtimeInteractions?: unknown[] };
  children?: Activity[];
}

/** The SCO runtime sits on a child activity (the root is the course organization). */
function scoRuntime(a: Activity | undefined): NonNullable<Activity["runtime"]> {
  if (!a) return {};
  if (a.runtime) return a.runtime;
  for (const c of a.children ?? []) {
    const r = scoRuntime(c);
    if (Object.keys(r).length) return r;
  }
  return {};
}

interface Registration {
  registrationCompletion: string;
  registrationSuccess: string;
  score?: { scaled?: number };
  totalSecondsTracked?: number;
  activityDetails?: Activity;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { version: { type: "string", default: "1.2" } },
});
const [moduleDir] = positionals;
const format = values.version === "2004" ? "scorm2004" : "scorm12";
if (!moduleDir || !["1.2", "2004"].includes(values.version ?? "")) {
  console.error("usage: scorm-cloud.ts <module-folder> [--version 1.2|2004]");
  process.exit(2);
}
const source = await loadModuleSource(moduleDir);
const module = validateModule(source).module;
if (!module) throw new Error("module is invalid");
const zip = resolve(
  "out",
  module.id,
  `${module.id}-${module.version}-${format}.zip`,
);
// One SCORM Cloud course per format, each import being a new version of it (the trial allows 3
// courses). SCORM 1.2 keeps the course id used since its first validation.
const courseId =
  format === "scorm12" ? `ldm-${module.id}` : `ldm-${module.id}-${format}`;
const registrationId = `ldm-qa-${Date.now()}`;
const screens = module.sections.flatMap((s) => s.screens);
const problems: string[] = [];
const check = (ok: boolean, message: string) => {
  console.log(`  ${ok ? "✓" : "✗"} ${message}`);
  if (!ok) problems.push(message);
};

console.log(`SCORM Cloud — ${basename(zip)}`);

// 1. Import (a new version of the same course id on each run).
const form = new FormData();
form.append(
  "file",
  new Blob([await readFile(zip)], { type: "application/zip" }),
  basename(zip),
);
const { result: jobId } = await api<{ result: string }>(
  "POST",
  `/courses/importJobs/upload?courseId=${courseId}&mayCreateNewVersion=true`,
  form,
);
let job: ImportJob;
do {
  await new Promise((r) => setTimeout(r, 1500));
  job = await api<ImportJob>("GET", `/courses/importJobs/${jobId}`);
} while (job.status === "RUNNING");
check(
  job.status === "COMPLETE",
  `import: ${job.status}${job.message ? ` (${job.message})` : ""}`,
);
const warnings = job.importResult?.parserWarnings ?? [];
check(
  warnings.length === 0,
  `parser warnings: ${warnings.length ? warnings.join(" | ") : "none"}`,
);

// 2. Registration for a test learner. Previous QA registrations are deleted first: the trial plan
// allows only 10 active registrations.
const previous = await api<{ registrations: { id: string }[] }>(
  "GET",
  `/registrations?courseId=${courseId}`,
);
const stale = previous.registrations.filter((r) => r.id.startsWith("ldm-qa-"));
try {
  for (const r of stale) await api("DELETE", `/registrations/${r.id}`);
} catch (e) {
  // Deletion is an app setting in SCORM Cloud ("Allow Delete API calls"); without it, old runs pile up.
  console.log(
    `  ! old QA registrations not deleted (${stale.length}): ${(e as Error).message.split(" → ")[1] ?? ""}`,
  );
}
await api("POST", "/registrations", {
  courseId,
  registrationId,
  learner: { id: "ldm-qa-learner", firstName: "QA", lastName: "L-D-Maker" },
});
const registration = () =>
  api<Registration>(
    "GET",
    `/registrations/${registrationId}?includeRuntime=true&includeInteractionsAndObjectives=true&includeChildResults=true`,
  );

const browser = await chromium.launch({
  executablePath: CHROMIUM_PATH,
  ...(process.env.HTTPS_PROXY
    ? { proxy: { server: process.env.HTTPS_PROXY } }
    : {}),
});

/** Opens a fresh launch link and returns the frame where our player runs (inside the SCORM Cloud player). */
async function launch(): Promise<{ page: Page; sco: Frame }> {
  const { launchLink } = await api<{ launchLink: string }>(
    "POST",
    `/registrations/${registrationId}/launchLink`,
    {
      redirectOnExitUrl: "https://example.com/",
      expiry: 600,
    },
  );
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(launchLink);
  // SCORM Cloud opens the SCO in a new window by default (our API lookup then goes through the opener).
  for (let i = 0; i < 60; i++) {
    for (const p of context.pages()) {
      for (const frame of p.frames()) {
        if (
          (await frame
            .locator("html[data-ldm-ready] footer.pager")
            .count()
            .catch(() => 0)) > 0
        )
          return { page: p, sco: frame };
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(
    "player not found in the SCORM Cloud launch page or its popup",
  );
}

async function answer(sco: Frame, index: number): Promise<void> {
  for (const block of screens[index]?.blocks ?? []) {
    if (block.type !== "question") continue;
    const q = block as Question;
    const form = sco
      .locator("form.question")
      .filter({ has: sco.locator(`input[name="${q.id}"]`) });
    if ((await form.locator('button[type="submit"]').count()) === 0) continue;
    for (const c of q.choices.filter((c) => c.correct))
      await form.locator(`input[value="${c.id}"]`).check();
    await form.locator('button[type="submit"]').click();
  }
}

/** Lets the SCORM Cloud player save (it may close the popup itself), then closes the session. */
async function settle(context: BrowserContext): Promise<void> {
  await new Promise((r) => setTimeout(r, 5000));
  await context.close().catch(() => {});
}

const half = Math.floor(screens.length / 2);
try {
  // 3. Session 1: halfway, then the learner closes the course.
  let { page, sco } = await launch();
  for (let i = 0; i < half; i++) {
    await answer(sco, i);
    await sco.locator("footer.pager .primary").click();
  }
  const context1 = page.context();
  await page.goto("about:blank"); // leaving the page: pagehide → LMSFinish with exit=suspend
  await settle(context1);
  let reg = await registration();
  check(
    reg.registrationCompletion !== "COMPLETED",
    `after session 1: completion ${reg.registrationCompletion}`,
  );

  // 4. Session 2: must resume on the same screen, then complete everything correctly.
  ({ page, sco } = await launch());
  const heading = await sco.locator("h1").innerText();
  // The SCO picks the learner's language (LMS preference or browser): accept the title in any locale.
  const titleKey = screens[half]?.title ?? "";
  const titles = Object.values(
    source.strings as Record<string, Record<string, string>>,
  ).map((c) => c[titleKey]);
  check(
    titles.includes(heading),
    `resume on screen ${half + 1}: « ${heading} »`,
  );
  for (let i = half; i < screens.length; i++) {
    await answer(sco, i);
    await sco.locator("footer.pager .primary").click(); // last click = Finish
  }
  await settle(page.context());

  // 5. What SCORM Cloud recorded.
  reg = await registration();
  const runtime = scoRuntime(reg.activityDetails);
  check(
    reg.registrationCompletion === "COMPLETED",
    `completion: ${reg.registrationCompletion}`,
  );
  check(
    reg.registrationSuccess === "PASSED",
    `success: ${reg.registrationSuccess}`,
  );
  check(reg.score?.scaled === 100, `score: ${reg.score?.scaled}`);
  check(
    (reg.totalSecondsTracked ?? 0) > 0,
    `time tracked: ${reg.totalSecondsTracked} s`,
  );
  const interactions = runtime.runtimeInteractions?.length ?? 0;
  check(interactions > 0, `interactions recorded: ${interactions}`);
  console.log(
    `  · runtime: ${JSON.stringify({ completionStatus: runtime.completionStatus, successStatus: runtime.successStatus, exit: runtime.exit, location: runtime.location, suspendDataLength: String(runtime.suspendData ?? "").length })}`,
  );
  console.log(
    `  · registration kept for review in the SCORM Cloud dashboard: ${registrationId}`,
  );
} finally {
  await browser.close();
}

console.log(
  problems.length
    ? `✗ ${problems.length} problem(s)`
    : "✓ SCORM Cloud validation passed",
);
process.exit(problems.length ? 1 : 0);
