// Generic SCORM run in the fake LMS, driven by the module data (works for any module), for SCORM 1.2
// and 2004: session 1 stops halfway and leaves; session 2 must resume there, then completes with all
// correct answers and finishes. Asserts what the LMS received.
import { relative } from "node:path";
import type { Module, StringCatalog } from "@ldm/schema";
import type { Browser, Frame, Page } from "playwright-core";
import { REPO_ROOT, type ScormVersion, startFakeLms } from "../fake-lms.ts";
import type { CheckResult } from "../types.ts";

type Values = Record<string, string>;
type LmsLog = { values: Values; calls: string[] };
const lmsLog = (page: Page) =>
  page.evaluate(() => (window as unknown as { __lms: LmsLog }).__lms);

/** What differs between the two versions, as seen from the LMS. */
interface Dialect {
  label: string;
  init: string;
  finish: string;
  /** Data the LMS keeps between sessions, from what the SCO wrote. */
  resume: (v: Values) => Values;
  incomplete: (v: Values) => boolean;
  suspended: (v: Values) => boolean;
  /** Problems with the final state after a perfect run. */
  final: (v: Values, assessed: boolean) => string[];
  closedNormally: (v: Values) => boolean;
  sessionTime: RegExp;
  timeKey: string;
  describe: (v: Values) => string;
  suspendLimit: number;
  /** Internal margin under the limit (phase 0 §5.4 for 1.2). */
  suspendBudget: number;
}

const DIALECTS: Record<ScormVersion, Dialect> = {
  "1.2": {
    label: "SCORM 1.2",
    init: "LMSInitialize",
    finish: "LMSFinish",
    resume: (v) => ({
      "cmi.core.entry": "resume",
      "cmi.core.lesson_status": "incomplete",
      "cmi.suspend_data": v["cmi.suspend_data"] ?? "",
      "cmi.core.lesson_location": v["cmi.core.lesson_location"] ?? "",
    }),
    incomplete: (v) => v["cmi.core.lesson_status"] === "incomplete",
    suspended: (v) => v["cmi.core.exit"] === "suspend",
    final: (v, assessed) => {
      const status = v["cmi.core.lesson_status"];
      const out: string[] = [];
      if (assessed) {
        if (status !== "passed")
          out.push(`statut final « ${status} » au lieu de « passed »`);
        if (v["cmi.core.score.raw"] !== "100")
          out.push(`score « ${v["cmi.core.score.raw"]} » au lieu de 100`);
      } else if (status !== "completed")
        out.push(`statut final « ${status} » au lieu de « completed »`);
      return out;
    },
    closedNormally: (v) => v["cmi.core.exit"] === "",
    sessionTime: /^\d{4}:\d{2}:\d{2}\.\d{2}$/,
    timeKey: "cmi.core.session_time",
    describe: (v) =>
      `statut ${v["cmi.core.lesson_status"]}, score ${v["cmi.core.score.raw"] ?? "—"} %`,
    suspendLimit: 4096,
    suspendBudget: 3500,
  },
  "2004": {
    label: "SCORM 2004 4e éd.",
    init: "Initialize",
    finish: "Terminate",
    resume: (v) => ({
      "cmi.entry": "resume",
      "cmi.completion_status": "incomplete",
      "cmi.suspend_data": v["cmi.suspend_data"] ?? "",
      "cmi.location": v["cmi.location"] ?? "",
    }),
    incomplete: (v) => v["cmi.completion_status"] === "incomplete",
    suspended: (v) => v["cmi.exit"] === "suspend",
    final: (v, assessed) => {
      const out: string[] = [];
      if (v["cmi.completion_status"] !== "completed")
        out.push(
          `complétion « ${v["cmi.completion_status"]} » au lieu de « completed »`,
        );
      if (assessed) {
        if (v["cmi.success_status"] !== "passed")
          out.push(
            `réussite « ${v["cmi.success_status"]} » au lieu de « passed »`,
          );
        if (Number(v["cmi.score.scaled"]) !== 1)
          out.push(`score normalisé « ${v["cmi.score.scaled"]} » au lieu de 1`);
      }
      if (v["cmi.progress_measure"] !== "1.00")
        out.push(
          `progression « ${v["cmi.progress_measure"]} » au lieu de 1.00`,
        );
      return out;
    },
    closedNormally: (v) => v["cmi.exit"] === "normal",
    sessionTime: /^PT(\d+H)?(\d+M)?\d+(\.\d{1,2})?S$/,
    timeKey: "cmi.session_time",
    describe: (v) =>
      `complétion ${v["cmi.completion_status"]}, réussite ${v["cmi.success_status"]}, score normalisé ${v["cmi.score.scaled"] ?? "—"}`,
    suspendLimit: 64000,
    suspendBudget: 60000,
  },
};

export async function scormChecks(
  browser: Browser,
  scoIndex: string,
  module: Module,
  strings: StringCatalog,
  version: ScormVersion = "1.2",
): Promise<CheckResult[]> {
  const d = DIALECTS[version];
  const lms = await startFakeLms();
  const sco = `/${relative(REPO_ROOT, scoIndex)}?lang=${module.defaultLocale}`;
  const screens = module.sections.flatMap((s) => s.screens);
  const assessed = screens.some((s) =>
    s.blocks.some((b) => b.type === "question" && b.scored),
  );
  const half = Math.floor(screens.length / 2);
  const problems: string[] = [];
  const facts: string[] = [];
  const expect = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };

  async function session(initial: Values) {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    // The adapters log every value the LMS rejects ("[scorm12] … failed"): any such message is a defect.
    page.on("console", (m) => {
      if (/\[scorm(12|2004)\].*(failed|too long)/.test(m.text()))
        problems.push(`valeur refusée par le LMS : ${m.text()}`);
    });
    await page.goto(lms.url(sco, initial, version));
    await page.frameLocator("#sco").locator("h1").waitFor();
    // The LMS page URL also contains "index.html" (as a query parameter): target the iframe itself.
    const frame = (await (await page.$("#sco"))?.contentFrame()) as Frame;
    return { page, frame };
  }
  const next = (f: Frame) => f.locator("footer.pager .primary").click();
  /** Answers every open question of a screen with its correct choices. */
  async function answerScreen(f: Frame, index: number): Promise<void> {
    for (const block of screens[index]?.blocks ?? []) {
      if (block.type !== "question") continue;
      const form = f.locator(`form.question[data-question="${block.id}"]`);
      if ((await form.locator('button[type="submit"]').count()) === 0) continue;
      if (block.variant === "sequence") {
        // Bring each step up to its place, in order, with the Move up buttons.
        for (const [i, c] of block.choices.entries()) {
          for (;;) {
            const ids = await form
              .locator('.steps button[data-move="up"]')
              .evaluateAll((bs) =>
                bs.map((b) => (b as HTMLElement).dataset.id),
              );
            if (ids.indexOf(c.id) <= i) break;
            await form
              .locator(`button[data-id="${c.id}"][data-move="up"]`)
              .click();
          }
        }
      } else
        for (const c of block.choices.filter((c) => c.correct))
          await form.locator(`input[value="${c.id}"]`).check();
      await form.locator('button[type="submit"]').click();
    }
  }

  try {
    // Session 1: halfway, then the learner leaves.
    const s1 = await session({});
    let log = await lmsLog(s1.page);
    expect(log.calls[0] === d.init, `${d.init} n'est pas le premier appel`);
    expect(
      d.incomplete(log.values),
      "le statut initial n'est pas « incomplete »",
    );
    for (let i = 0; i < half; i++) {
      await answerScreen(s1.frame, i);
      await next(s1.frame);
    }
    await s1.frame.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    log = await lmsLog(s1.page);
    expect(
      log.calls.at(-1) === d.finish,
      `pas de ${d.finish} quand l'apprenant quitte`,
    );
    expect(
      d.suspended(log.values),
      "la sortie n'est pas « suspend » pour une session interrompue",
    );
    const saved = d.resume(log.values);
    await s1.page.close();

    // Session 2: resume, answer every question correctly, finish.
    const s2 = await session(saved);
    const expectedTitle = strings[screens[half]?.title ?? ""] ?? "";
    expect(
      (await s2.frame.locator("h1").innerText()) === expectedTitle,
      `la reprise ne ramène pas à l'écran ${half + 1} (« ${expectedTitle} »)`,
    );
    let maxSuspend = saved["cmi.suspend_data"]?.length ?? 0;
    for (let i = half; i < screens.length; i++) {
      await answerScreen(s2.frame, i);
      maxSuspend = Math.max(
        maxSuspend,
        (await lmsLog(s2.page)).values["cmi.suspend_data"]?.length ?? 0,
      );
      await next(s2.frame); // the last click is the Finish button
    }
    log = await lmsLog(s2.page);
    problems.push(...d.final(log.values, assessed));
    expect(
      d.closedNormally(log.values),
      "la sortie n'est pas une fin normale une fois le module terminé",
    );
    expect(
      log.calls.at(-1) === d.finish,
      `le bouton Terminer n'appelle pas ${d.finish}`,
    );
    expect(
      d.sessionTime.test(log.values[d.timeKey] ?? ""),
      `${d.timeKey} mal formé (« ${log.values[d.timeKey]} »)`,
    );
    const interactions = Object.keys(log.values).filter((k) =>
      /^cmi\.interactions\.\d+\.id$/.test(k),
    ).length;
    facts.push(
      `État final : ${d.describe(log.values)}`,
      `Interactions envoyées (session 2) : ${interactions}`,
      `Données de reprise : ${maxSuspend} caractères au maximum (limite ${d.label} : ${d.suspendLimit.toLocaleString("fr-FR")} ; seuil interne : ${d.suspendBudget.toLocaleString("fr-FR")})`,
    );
    expect(
      maxSuspend <= d.suspendBudget,
      `données de reprise trop longues (${maxSuspend} > ${d.suspendBudget})`,
    );
    await s2.page.close();
  } catch (e) {
    problems.push(
      `échec du scénario : ${(e as Error).message
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 3)
        .join(" ")}`,
    );
  } finally {
    await lms.close();
  }

  return [
    {
      id: `scorm${version.replace(".", "")}-tracking`,
      title: `Suivi ${d.label} (faux LMS)`,
      criterion:
        "Initialisation, statut, score, temps, interactions, reprise de session, fin de session",
      status: problems.length ? "fail" : "pass",
      summary: problems.length
        ? `${problems.length} problème(s)`
        : "Deux sessions jouées : interruption, reprise au bon écran, réussite",
      details: [...problems, ...facts],
    },
  ];
}
