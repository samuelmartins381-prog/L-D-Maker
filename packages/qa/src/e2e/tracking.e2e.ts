// End-to-end tracking: the demo SCORM 1.2 package in a fake LMS, over two sessions (suspend, then resume
// and finish). Run after `pnpm build:examples`: node packages/qa/src/e2e/tracking.e2e.ts
import assert from "node:assert/strict";
import { chromium, type Frame, type Page } from "playwright-core";
import { startFakeLms } from "../fake-lms.ts";

const SCO = "/out/phishing-basics/scorm12/index.html";
const lms = await startFakeLms();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ??
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const errors: string[] = [];
let failed = false;

async function open(
  initial: Record<string, string> = {},
): Promise<{ page: Page; sco: Frame }> {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !m.text().includes("404") &&
      errors.push(m.text()),
  );
  page.on(
    "response",
    (r) =>
      r.status() >= 400 &&
      errors.push(`${r.status()} ${new URL(r.url()).pathname}`),
  );
  await page.goto(lms.url(`${SCO}?lang=fr`, initial));
  const sco = page.frameLocator("#sco");
  await sco.locator("html[data-ldm-ready] h1").waitFor();
  const frame = page.frames().find((f) => f.url().includes(SCO));
  assert.ok(frame, "SCO frame loaded");
  return { page, sco: frame };
}

const lmsState = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __lms: { values: Record<string, string>; calls: string[] };
        }
      ).__lms,
  );
const next = (sco: Frame) => sco.locator("footer.pager .primary").click();
const heading = (sco: Frame) => sco.locator("h1").innerText();
/** Moves forward until the screen titled `title`; returns its 0-based index (the SCORM bookmark). */
async function nextUntil(sco: Frame, title: string): Promise<number> {
  for (let i = 0; i < 30; i++) {
    if ((await heading(sco)) === title) return i;
    await next(sco);
  }
  throw new Error(`screen "${title}" not found`);
}

async function answer(sco: Frame, labels: RegExp[]): Promise<void> {
  const form = sco
    .locator("form.question")
    .filter({ has: sco.getByLabel(labels[0] as RegExp) });
  for (const label of labels) await form.getByLabel(label).check();
  await form.getByRole("button", { name: "Valider" }).click();
}

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed = true;
    console.log(
      `  ✗ ${name}\n    ${(e as Error).message.split("\n").join("\n    ")}`,
    );
  }
}

let saved: Record<string, string> = {};

console.log("SCORM 1.2 — session 1 (start, answer half the quiz, leave)");
{
  const { page, sco } = await open();
  await step("initializes and reports incomplete", async () => {
    const s = await lmsState(page);
    assert.deepEqual(s.calls.slice(0, 1), ["LMSInitialize"]);
    assert.equal(s.values["cmi.core.lesson_status"], "incomplete");
  });
  const quizIndex = await nextUntil(sco, "Vérifiez vos acquis");
  await answer(sco, [/C'est suspect/]);
  await answer(sco, [
    /La demande de mot de passe/,
    /Le lien mène vers une adresse/,
  ]);
  await answer(sco, [/Le lien est suspect/]);
  await step(
    "saves location, suspend data and interactions as the learner goes",
    async () => {
      const s = await lmsState(page);
      assert.equal(s.values["cmi.core.lesson_location"], String(quizIndex));
      assert.match(s.values["cmi.suspend_data"] ?? "", /^2\|phishing-basics@/);
      assert.equal(s.values["cmi.interactions.0.id"], "q-sender");
      assert.equal(s.values["cmi.interactions.0.result"], "correct");
      assert.equal(s.values["cmi.interactions.1.student_response"], "a,b");
      assert.equal(s.values["cmi.core.exit"], "suspend");
    },
  );
  // Learner closes the course: the SCO frame goes away.
  await sco.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await step(
    "finishes the LMS session on page hide, keeping exit=suspend",
    async () => {
      const s = await lmsState(page);
      assert.equal(s.calls.at(-1), "LMSFinish");
      assert.equal(s.values["cmi.core.lesson_status"], "incomplete");
    },
  );
  const s = await lmsState(page);
  saved = {
    "cmi.core.entry": "resume",
    "cmi.core.lesson_status": "incomplete",
    "cmi.core.lesson_location": s.values["cmi.core.lesson_location"] ?? "",
    "cmi.suspend_data": s.values["cmi.suspend_data"] ?? "",
    "cmi.student_data.mastery_score": "80",
  };
  await page.close();
}

console.log(
  "SCORM 1.2 — session 2 (resume, finish the quiz, finish the module)",
);
{
  const { page, sco } = await open(saved);
  await step("resumes on the screen where the learner left", async () => {
    assert.equal(await heading(sco), "Vérifiez vos acquis");
  });
  await step("restores answered questions as locked", async () => {
    const first = sco.locator("form.question").first();
    assert.equal(await first.getByRole("radio").first().isDisabled(), true);
  });
  await answer(sco, [/Je le signale via le bouton/]);
  await answer(sco, [/J'appelle le fournisseur/]);
  await answer(sco, [/J'attends de voir/]); // one deliberate mistake: 5/6 = 83 %
  await next(sco);
  await sco.getByRole("button", { name: "Terminer" }).click();
  await step("reports passed with the score, then LMSFinish", async () => {
    const s = await lmsState(page);
    assert.equal(s.values["cmi.core.lesson_status"], "passed");
    assert.equal(s.values["cmi.core.score.raw"], "83");
    assert.equal(s.values["cmi.core.exit"], "");
    assert.match(
      s.values["cmi.core.session_time"] ?? "",
      /^\d{4}:\d{2}:\d{2}\.\d{2}$/,
    );
    assert.equal(s.calls.at(-1), "LMSFinish");
  });
  await step("records the wrong answer as an interaction", async () => {
    const s = await lmsState(page);
    const ids = Object.entries(s.values).filter(([k]) =>
      /^cmi\.interactions\.\d+\.id$/.test(k),
    );
    const react = ids.find(([, v]) => v === "q-react")?.[0].replace(".id", "");
    assert.ok(react, "q-react interaction recorded");
    assert.equal(s.values[`${react}.result`], "wrong");
  });
  await step("shows the end panel with the score", async () => {
    assert.match(await sco.locator("main").innerText(), /Votre score : 83 %/);
  });
  await page.close();
}

console.log("HTML5 standalone — reload resumes from browser storage");
{
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  const url = lms
    .url("/")
    .replace(/\/__lms.*/, "/out/phishing-basics/web/index.html?lang=en");
  await page.goto(url);
  await page.locator("html[data-ldm-ready]").waitFor({ state: "attached" });
  for (let i = 0; i < 2; i++)
    await page.locator("footer.pager .primary").click();
  await page.reload();
  await page.locator("html[data-ldm-ready]").waitFor({ state: "attached" });
  await step("comes back to the same screen after a reload", async () => {
    assert.equal(await page.locator("h1").innerText(), "A worked example");
  });
  await page.close();
}

console.log("Hotspots — markers open one explanation at a time");
{
  const web = lms.url("/").replace(/\/__lms.*/, "/out/phishing-basics/web/");
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${web}index.html?lang=en`);
  await page.locator("html[data-ldm-ready]").waitFor({ state: "attached" });
  const h1 = page.locator("h1");
  for (
    let i = 0;
    i < 30 && (await h1.innerText()) !== "Anatomy of a message";
    i++
  )
    await page.locator("footer.pager .primary").click();
  const markers = page.locator(".hotspots .marker");
  const detail = page.locator(".hotspots .detail");
  await step("names each marker and opens its explanation", async () => {
    await page.getByRole("button", { name: "The button" }).click();
    assert.equal(await markers.nth(2).getAttribute("aria-expanded"), "true");
    assert.match(await detail.innerText(), /secure-login\.co/);
    assert.match(
      await page.locator(".hotspots .progress").innerText(),
      /1 of 4 explored/,
    );
  });
  await step("closes on a second press and keeps it explored", async () => {
    await markers.nth(2).click();
    assert.equal(await markers.nth(2).getAttribute("aria-expanded"), "false");
    assert.match(await detail.innerText(), /Select a numbered marker/);
    await page.locator("footer.pager .secondary").click();
    await page.locator("footer.pager .primary").click();
    assert.match(
      await page.locator(".hotspots .progress").innerText(),
      /1 of 4 explored/,
    );
  });
  await page.close();
}

console.log("Image zoom — modal viewer, keyboard zoom, focus restored");
{
  const web = lms.url("/").replace(/\/__lms.*/, "/out/phishing-basics/web/");
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${web}index.html?lang=en`);
  await page.locator("html[data-ldm-ready]").waitFor({ state: "attached" });
  const h1 = page.locator("h1");
  for (let i = 0; i < 30 && (await h1.innerText()) !== "A worked example"; i++)
    await page.locator("footer.pager .primary").click();
  const open = page.getByRole("button", { name: "Enlarge image" });
  const dialog = page.getByRole("dialog", { name: "Enlarged image" });
  const level = dialog.locator("output");
  await step("opens a named modal viewer from the keyboard", async () => {
    await open.focus();
    await page.keyboard.press("Enter");
    await dialog.locator("img").waitFor();
    assert.match(
      (await dialog.locator("img").getAttribute("alt")) ?? "",
      /payroll\.secure-login\.co/,
    );
    assert.equal(await level.innerText(), "Zoom 100%");
  });
  await step(
    "zooms in and out with + and −, the image overflows to pan",
    async () => {
      await page.keyboard.press("+");
      await page.keyboard.press("+");
      assert.equal(await level.innerText(), "Zoom 225%");
      const pan = await dialog
        .locator(".viewport")
        .evaluate((v) => v.scrollWidth > v.clientWidth);
      assert.ok(pan, "zoomed image wider than the viewer");
      await page.keyboard.press("-");
      assert.equal(await level.innerText(), "Zoom 150%");
    },
  );
  await step(
    "closes with Escape and gives focus back to the button",
    async () => {
      await page.keyboard.press("Escape");
      assert.equal(await dialog.count(), 0);
      assert.ok(await open.evaluate((b) => b === document.activeElement));
    },
  );
  await page.close();
}

console.log(
  "Hotspot question — neutral marker names, graded like single choice",
);
{
  const web = lms.url("/").replace(/\/__lms.*/, "/out/phishing-basics/web/");
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${web}index.html?lang=en`);
  await page.locator("html[data-ldm-ready]").waitFor({ state: "attached" });
  const h1 = page.locator("h1");
  for (let i = 0; i < 30 && (await h1.innerText()) !== "Practice"; i++)
    await page.locator("footer.pager .primary").click();
  const form = page.locator("form.question", {
    has: page.getByText("really tells you which site"),
  });
  const radios = form.getByRole("radio");
  await step(
    "names markers by number only, so the name never gives the answer",
    async () => {
      assert.equal(await radios.count(), 4);
      for (let n = 1; n <= 4; n++)
        assert.equal(
          await form
            .getByRole("radio", { name: `Marker ${n}`, exact: true })
            .count(),
          1,
        );
    },
  );
  await step("a wrong answer explains only the chosen marker", async () => {
    await form.locator("input[value=padlock]").check();
    await form.getByRole("button", { name: "Submit" }).click();
    assert.match(
      await form.locator(".verdict").innerText(),
      /Attempts left: 1/,
    );
    assert.equal(await form.locator(".results li").count(), 1);
    assert.match(await form.locator(".results").innerText(), /The padlock/);
  });
  await step(
    "the right marker ends the question and shows every explanation",
    async () => {
      await form.locator("input[value=domain]").check();
      await form.getByRole("button", { name: "Submit" }).click();
      assert.equal(await form.locator(".verdict").innerText(), "Correct");
      assert.equal(await form.locator(".results li").count(), 4);
      assert.equal(await radios.and(page.locator(":disabled")).count(), 4);
    },
  );
  await page.close();
}

console.log("Sequence question — move buttons, announcements, graded order");
{
  const web = lms.url("/").replace(/\/__lms.*/, "/out/phishing-basics/web/");
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${web}index.html?lang=en`);
  await page.locator("html[data-ldm-ready]").waitFor({ state: "attached" });
  const h1 = page.locator("h1");
  for (let i = 0; i < 30 && (await h1.innerText()) !== "Checking a link"; i++)
    await page.locator("footer.pager .primary").click();
  const form = page.locator('form.question[data-question="s2-check-steps"]');
  const order = () =>
    form
      .locator('.steps button[data-move="up"]')
      .evaluateAll((bs) => bs.map((b) => (b as HTMLElement).dataset.id));
  await step(
    "starts shuffled, never solved, with buttons named after each step",
    async () => {
      assert.notDeepEqual(await order(), [
        "hover",
        "read",
        "domain",
        "compare",
      ]);
      assert.equal(
        await form
          .getByRole("button", {
            name: "Move up: Read the address that appears",
          })
          .count(),
        1,
      );
    },
  );
  await step(
    "a move is announced and keeps focus on the moved step",
    async () => {
      const [first] = await order();
      await form
        .locator(`button[data-id="${first}"][data-move="down"]`)
        .focus();
      await page.keyboard.press("Enter");
      assert.equal((await order())[1], first);
      assert.match(
        await form.locator("[aria-live=polite]").innerText(),
        /is now in position 2 of 4/,
      );
      assert.equal(
        await page.evaluate(
          () => (document.activeElement as HTMLElement).dataset.id,
        ),
        first,
      );
    },
  );
  await step(
    "the right order is graded correct and shows every explanation",
    async () => {
      for (const [i, id] of ["hover", "read", "domain", "compare"].entries())
        while ((await order()).indexOf(id) > i)
          await form.locator(`button[data-id="${id}"][data-move="up"]`).click();
      await form.getByRole("button", { name: "Submit" }).click();
      assert.equal(await form.locator(".verdict").innerText(), "Correct");
      assert.equal(await form.locator(".final li").count(), 4);
      assert.equal(await form.getByText("In the right place").count(), 4);
    },
  );
  await page.close();
}

console.log(
  "Prerendered first screen — visible before the script, replaced by the live player",
);
{
  const web = lms.url("/").replace(/\/__lms.*/, "/out/phishing-basics/web/");
  const blocked = await browser.newPage({ reducedMotion: "reduce" });
  await blocked.route("**/player-*.js", (r) => r.abort());
  await step(
    "shows the first screen without the player script, inert",
    async () => {
      // ?lang=fr: the browser's own languages (en-US here) would otherwise rightly hide it.
      await blocked.goto(`${web}index.html?lang=fr`);
      assert.equal(await blocked.locator("h1").innerText(), "Bienvenue");
      assert.ok(
        await blocked.locator("#ldm-app[inert][data-prerender]").isVisible(),
      );
    },
  );
  await step(
    "hides it when the learner will get another language",
    async () => {
      await blocked.goto(`${web}index.html?lang=en`);
      const visibility = await blocked
        .locator("#ldm-app")
        .evaluate((e) => getComputedStyle(e).visibility);
      assert.equal(visibility, "hidden");
    },
  );
  await blocked.close();
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  await step("is replaced by one live, interactive screen", async () => {
    await page.goto(`${web}index.html?lang=en`);
    await page.locator("html[data-ldm-ready]").waitFor({ state: "attached" });
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("h1").innerText(), "Welcome");
    assert.equal(
      await page.locator("#ldm-app[inert], [data-prerender]").count(),
      0,
    );
    await page.locator("footer.pager .primary").click();
    assert.notEqual(await page.locator("h1").innerText(), "Welcome");
  });
  await page.close();
}

console.log("Locale packs — loaded on demand, missing pack keeps the language");
{
  const web = lms.url("/").replace(/\/__lms.*/, "/out/phishing-basics/web/");
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${web}index.html?lang=fr`);
  await page.locator("html[data-ldm-ready] h1").waitFor();
  await step("embeds only the default locale in index.html", async () => {
    const html = await (await fetch(`${web}index.html`)).text();
    assert.ok(html.includes("Bienvenue"));
    assert.ok(!html.includes("Добро пожаловать"));
  });
  await step("switches to Japanese from the language menu", async () => {
    await page.locator("header select").selectOption("ja");
    await page.locator("h1", { hasText: "はじめに" }).waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "ja");
    assert.equal(
      await page.locator("footer.pager .primary").innerText(),
      "次へ\n→",
    );
  });
  await step(
    "keeps the current language when a pack fails to load",
    async () => {
      await page.route("**/locales/ko.js", (r) => r.abort());
      await page.locator("header select").selectOption("ko");
      await page.waitForTimeout(300);
      assert.equal(await page.locator("html").getAttribute("lang"), "ja");
      assert.equal(await page.locator("header select").inputValue(), "ja");
    },
  );
  await page.close();
}

await browser.close();
await lms.close();
if (errors.length) {
  failed = true;
  console.log(`  ✗ browser errors:\n    ${errors.join("\n    ")}`);
}
process.exit(failed ? 1 : 0);
