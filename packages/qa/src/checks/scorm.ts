// Generic SCORM 1.2 run in the fake LMS, driven by the module data (works for any module):
// session 1 stops halfway and leaves; session 2 must resume there, then completes with all
// correct answers and finishes. Asserts what the LMS received.
import { relative } from "node:path";
import type { Module, StringCatalog } from "@ldm/schema";
import type { Browser, Frame, Page } from "playwright-core";
import { REPO_ROOT, startFakeLms } from "../fake-lms.ts";
import type { CheckResult } from "../types.ts";

type LmsLog = { values: Record<string, string>; calls: string[] };
const lmsLog = (page: Page) =>
  page.evaluate(() => (window as unknown as { __lms: LmsLog }).__lms);

export async function scormChecks(
  browser: Browser,
  scoIndex: string,
  module: Module,
  strings: StringCatalog,
): Promise<CheckResult[]> {
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

  async function session(initial: Record<string, string>) {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.goto(lms.url(sco, initial));
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
      const form = f
        .locator("form.question")
        .filter({ has: f.locator(`input[name="${block.id}"]`) });
      if ((await form.locator('button[type="submit"]').count()) === 0) continue;
      for (const c of block.choices.filter((c) => c.correct))
        await form.locator(`input[value="${c.id}"]`).check();
      await form.locator('button[type="submit"]').click();
    }
  }

  try {
    // Session 1: halfway, then the learner leaves.
    const s1 = await session({});
    let log = await lmsLog(s1.page);
    expect(
      log.calls[0] === "LMSInitialize",
      "LMSInitialize n'est pas le premier appel",
    );
    expect(
      log.values["cmi.core.lesson_status"] === "incomplete",
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
      log.calls.at(-1) === "LMSFinish",
      "pas de LMSFinish quand l'apprenant quitte",
    );
    expect(
      log.values["cmi.core.exit"] === "suspend",
      "cmi.core.exit n'est pas « suspend » pour une session interrompue",
    );
    const saved = {
      "cmi.core.entry": "resume",
      "cmi.core.lesson_status": "incomplete",
      "cmi.suspend_data": log.values["cmi.suspend_data"] ?? "",
      "cmi.core.lesson_location": log.values["cmi.core.lesson_location"] ?? "",
    };
    await s1.page.close();

    // Session 2: resume, answer every question correctly, finish.
    const s2 = await session(saved);
    const expectedTitle = strings[screens[half]?.title ?? ""] ?? "";
    expect(
      (await s2.frame.locator("h1").innerText()) === expectedTitle,
      `la reprise ne ramène pas à l'écran ${half + 1} (« ${expectedTitle} »)`,
    );
    let maxSuspend = saved["cmi.suspend_data"].length;
    for (let i = half; i < screens.length; i++) {
      await answerScreen(s2.frame, i);
      maxSuspend = Math.max(
        maxSuspend,
        (await lmsLog(s2.page)).values["cmi.suspend_data"]?.length ?? 0,
      );
      await next(s2.frame); // the last click is the Finish button
    }
    log = await lmsLog(s2.page);
    const status = log.values["cmi.core.lesson_status"];
    const interactions = Object.keys(log.values).filter((k) =>
      /^cmi\.interactions\.\d+\.id$/.test(k),
    ).length;
    if (assessed) {
      expect(
        status === "passed",
        `statut final « ${status} » au lieu de « passed »`,
      );
      expect(
        log.values["cmi.core.score.raw"] === "100",
        `score « ${log.values["cmi.core.score.raw"]} » au lieu de 100 (toutes les réponses justes)`,
      );
    } else
      expect(
        status === "completed",
        `statut final « ${status} » au lieu de « completed »`,
      );
    expect(
      log.values["cmi.core.exit"] === "",
      "cmi.core.exit devrait être vide une fois le module terminé",
    );
    expect(
      log.calls.at(-1) === "LMSFinish",
      "le bouton Terminer n'appelle pas LMSFinish",
    );
    expect(
      /^\d{4}:\d{2}:\d{2}\.\d{2}$/.test(
        log.values["cmi.core.session_time"] ?? "",
      ),
      "cmi.core.session_time mal formé",
    );
    facts.push(
      `Statut final : ${status}${assessed ? `, score ${log.values["cmi.core.score.raw"]} %` : ""}`,
      `Interactions envoyées (session 2) : ${interactions}`,
      `Données de reprise : ${maxSuspend} caractères au maximum (limite SCORM 1.2 : 4 096 ; seuil interne : 3 500)`,
    );
    expect(
      maxSuspend <= 3500,
      `données de reprise trop longues (${maxSuspend} > 3 500)`,
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
      id: "scorm12-tracking",
      title: "Suivi SCORM 1.2 (faux LMS)",
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
