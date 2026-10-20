// End-to-end test of the Studio (ADR 0014): Playwright drives the real Electron app from the first
// launch to a created project whose sources were read, checks every screen with axe, and checks
// the lock between two users. Screenshots go to out/studio-e2e/.
//   node packages/studio/e2e/studio.e2e.ts   (after `pnpm --filter @ldm/studio build`)
//   LDM_STUDIO_EXECUTABLE=<packaged app binary> node …   (the same test on an installed build)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { draftToModule, moduleToDraft } from "@ldm/generator";
import { Module } from "@ldm/schema";
import { _electron, type Page } from "playwright-core";

// Electron needs a display: on a headless Linux, run again under a virtual one.
if (
  process.platform === "linux" &&
  !process.env.DISPLAY &&
  !process.env.LDM_XVFB
) {
  const r = spawnSync(
    "xvfb-run",
    ["-a", process.execPath, ...process.argv.slice(1)],
    {
      stdio: "inherit",
      env: { ...process.env, LDM_XVFB: "1" },
    },
  );
  process.exit(r.status ?? 1);
}

const STUDIO = fileURLToPath(new URL("..", import.meta.url));
const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const DEMO_SOURCES = join(ROOT, "projects/mouvement-mecanique/sources");
const SHOTS = join(ROOT, "out/studio-e2e");
const require = createRequire(join(STUDIO, "package.json"));
const electronPath = require("electron") as unknown as string;
const AXE = readFileSync(
  createRequire(join(ROOT, "packages/qa/package.json")).resolve(
    "axe-core/axe.min.js",
  ),
  "utf8",
);

const userData = mkdtempSync(join(tmpdir(), "ldm-studio-user-"));
const projectsDir = mkdtempSync(join(tmpdir(), "ldm-studio-projects-"));
mkdirSync(SHOTS, { recursive: true });
// Claude is replaced by a recorded answer: the hand-written demo storyboard, at this test's
// passing score (75 %), as the API would return it (without schemaVersion and module).
const yamlLib = createRequire(join(ROOT, "packages/generator/package.json"))(
  "yaml",
) as { parse: (s: string) => Record<string, unknown> };
const {
  schemaVersion: _v,
  module: _m,
  ...draft
} = yamlLib.parse(
  readFileSync(
    join(ROOT, "projects/mouvement-mecanique/storyboard.yaml"),
    "utf8",
  ),
);
draft.assessment = { passingScore: 75 };
const fakeAnswer = join(userData, "fake-storyboard.json");
writeFileSync(fakeAnswer, JSON.stringify(draft));
// The module Claude would write: the hand-written demo module as a draft, its picture taken from the
// sources the test reads. The translator answers every key of it, marked [EN].
const demoModule = Module.parse(
  yamlLib.parse(
    readFileSync(
      join(ROOT, "projects/mouvement-mecanique/module/module.yaml"),
      "utf8",
    ),
  ),
);
const demoDraft = moduleToDraft(
  demoModule,
  JSON.parse(
    readFileSync(
      join(ROOT, "projects/mouvement-mecanique/module/strings/fr.json"),
      "utf8",
    ),
  ),
);
const draftText = JSON.stringify({
  ...demoDraft,
  notes: [
    "Un visuel de la marque remplacerait avantageusement le schéma du guide.",
  ],
}).replaceAll("media/movement.svg", "ingest/media/guide-mouvement/img-000.png");
const fakeModule = join(userData, "fake-module.json");
writeFileSync(fakeModule, draftText);
const { strings: draftStrings } = draftToModule(JSON.parse(draftText), {
  id: "x",
  version: "1.0.0",
  defaultLocale: "fr",
  locales: ["fr"],
  durationMinutes: 20,
  passingScore: 75,
  completion: "all-screens-and-passed",
  bloom: {},
});
const fakeTranslation = join(userData, "fake-translation.json");
writeFileSync(
  fakeTranslation,
  JSON.stringify({
    items: Object.entries(draftStrings).map(([key, text]) => ({
      key,
      text: `[EN] ${text}`,
    })),
  }),
);
// First launch with the folder already chosen (the native folder dialog cannot be driven).
writeFileSync(
  join(userData, "settings.json"),
  JSON.stringify({ projectsDir, locale: "fr" }),
);

async function axe(page: Page, label: string): Promise<void> {
  // evaluate() is not subject to the page's Content-Security-Policy, unlike a script tag.
  if (!(await page.evaluate(() => "axe" in window))) await page.evaluate(AXE);
  const violations = await page.evaluate(async () => {
    const r = await (
      window as unknown as {
        axe: {
          run: (
            d: Document,
            o: object,
          ) => Promise<{
            violations: { id: string; nodes: { target: string[] }[] }[];
          }>;
        };
      }
    ).axe.run(document, {
      runOnly: {
        type: "tag",
        values: [
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22aa",
          "best-practice",
        ],
      },
      resultTypes: ["violations"],
    });
    return r.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
  });
  assert.deepEqual(violations, [], `axe violations on ${label}`);
  await page.screenshot({ path: join(SHOTS, `${label}.png`) });
  console.log(`  ✓ ${label}: 0 axe violation`);
}

const packaged = process.env.LDM_STUDIO_EXECUTABLE;
const app = await _electron.launch({
  executablePath: packaged ?? electronPath,
  args: packaged ? ["--no-sandbox"] : [STUDIO, "--no-sandbox"],
  env: {
    ...process.env,
    LDM_STUDIO_USER_DATA: userData,
    LDM_STUDIO_FAKE_LLM: fakeAnswer,
    LDM_STUDIO_FAKE_LLM_MODULE: fakeModule,
    LDM_STUDIO_FAKE_LLM_TRANSLATE: fakeTranslation,
    LDM_STUDIO_NO_OPEN: "1",
  },
});
const errors: string[] = [];
try {
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.setViewportSize({ width: 1280, height: 840 });
  await page.waitForSelector("html[data-ldm-studio-ready]");

  // Welcome: the name is required.
  await page
    .getByRole("heading", { name: "Bienvenue dans le Studio" })
    .waitFor();
  await axe(page, "01-welcome");
  await page.getByRole("button", { name: "Commencer" }).click();
  await page.getByText("Ce champ est obligatoire.").waitFor();
  await page.getByLabel("Ton prénom").fill("Sam");
  await page.getByRole("button", { name: "Commencer" }).click();

  // Empty project list.
  await page
    .getByRole("heading", { name: "Aucun projet pour l'instant" })
    .waitFor();
  await axe(page, "02-projects-empty");
  await page.getByRole("button", { name: "Nouveau projet" }).first().click();

  // Step 1: essentials (required fields are checked).
  await page.getByRole("heading", { name: "L'essentiel" }).waitFor();
  await page.getByRole("button", { name: "Continuer" }).click();
  assert.equal(await page.getByText("Ce champ est obligatoire.").count(), 2);
  await page.getByLabel("Titre de la formation").fill("Le mouvement mécanique");
  await page.getByLabel(/Marque ou client/).fill("Maison de démonstration");
  await page.getByLabel("Public").fill("Conseillers de vente en boutique");
  await page
    .getByLabel(/Brief de la marque/)
    .fill("Former les conseillers à expliquer le mouvement.");
  await axe(page, "03-new-essentials");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 2: sources, through the file dialog (mocked in the main process).
  const files = [
    "guide-mouvement.pdf",
    "argumentaire.pptx",
    "notes-terrain.docx",
  ].map((f) => join(DEMO_SOURCES, f));
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths,
    })) as typeof dialog.showOpenDialog;
  }, files);
  await page.getByRole("button", { name: "Choisir des fichiers…" }).click();
  await page
    .getByRole("button", { name: "Retirer argumentaire.pptx" })
    .waitFor();
  await axe(page, "04-new-sources");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 3: languages.
  await page.getByRole("heading", { name: "Langues" }).waitFor();
  await page.getByRole("checkbox", { name: "Allemand" }).check();
  await page.getByRole("checkbox", { name: "Japonais" }).check();
  await axe(page, "05-new-languages");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 4: outputs; at least one is required.
  await page.getByRole("heading", { name: "Format de sortie" }).waitFor();
  await page.getByRole("checkbox", { name: /LMS non précisé/ }).uncheck();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByText("Choisis au moins une sortie.").waitFor();
  await page.getByRole("checkbox", { name: /Watch Live/ }).check();
  await page.getByRole("checkbox", { name: /Fichier HTML unique/ }).check();
  await axe(page, "06-new-output");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 5: design.
  await page.getByRole("heading", { name: "Design" }).waitFor();
  await page
    .getByRole("checkbox", { name: "Utiliser les couleurs de la marque" })
    .check();
  await page.getByRole("radio", { name: /Sobres/ }).check();
  await axe(page, "07-new-design");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Step 6: assessment.
  await page.getByRole("heading", { name: "Évaluation" }).waitFor();
  await page.getByLabel("Seuil de réussite (%)").fill("75");
  await page.getByRole("radio", { name: /Tutoiement/ }).check();
  await axe(page, "08-new-assessment");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Summary, then creation and reading of the sources.
  await page.getByRole("heading", { name: "Récapitulatif" }).waitFor();
  await axe(page, "09-new-summary");
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await page
    .getByText(/3 source\(s\) lues, 1\s562 mots/)
    .waitFor({ timeout: 60_000 });
  await axe(page, "10-project");

  const yaml = readFileSync(
    join(projectsDir, "le-mouvement-mecanique/project.yaml"),
    "utf8",
  );
  for (const expected of [
    "client: Maison de démonstration",
    "profile: teach-on-mars",
    "profile: html-file",
    "animation: sober",
    "passingScore: 75",
    "formality: informal",
    'primary: "#8a4b2a"',
  ])
    assert.ok(
      yaml.includes(expected),
      `project.yaml should contain ${expected}`,
    );
  assert.match(yaml, /locales:\n {2}- fr\n {2}- de\n {2}- ja/);
  console.log("  ✓ project.yaml holds every choice");

  // Back to the list: the project is there, waiting for its storyboard.
  await page.getByRole("button", { name: "← Tous les projets" }).click();
  await page.getByRole("button", { name: "Le mouvement mécanique" }).waitFor();
  await page.getByText("Storyboard à générer").waitFor();
  await axe(page, "11-projects");

  // Lock: a project opened by Kylian is read-only until forced open.
  writeFileSync(
    join(projectsDir, "le-mouvement-mecanique/.ldm-lock"),
    JSON.stringify({ by: "Kylian", at: new Date().toISOString() }),
  );
  await page.getByRole("button", { name: "Paramètres" }).click();
  await page.getByRole("button", { name: "Projets" }).click();
  await page.getByText("Ouvert par Kylian").waitFor();
  await page.getByRole("button", { name: "Le mouvement mécanique" }).click();
  await page.getByText(/Kylian a ouvert ce projet/).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Ajouter des sources…" }).count(),
    0,
  );
  await axe(page, "12-project-locked");
  await page.getByRole("button", { name: "Ouvrir quand même" }).click();
  await page.getByRole("button", { name: "Ajouter des sources…" }).waitFor();
  const lock = JSON.parse(
    readFileSync(join(projectsDir, "le-mouvement-mecanique/.ldm-lock"), "utf8"),
  );
  assert.equal(lock.by, "Sam");
  console.log(
    "  ✓ lock: read-only while Kylian holds it, taken over on demand",
  );

  // Settings, then English.
  await page.getByRole("button", { name: "Paramètres" }).click();
  await page.getByRole("heading", { name: "Paramètres" }).waitFor();
  await axe(page, "13-settings");
  await page.getByLabel("Langue du Studio").selectOption("en");
  await page.getByRole("heading", { name: "Settings" }).waitFor();
  await page.getByRole("button", { name: "Projects" }).click();
  await page.getByText("Storyboard to generate").waitFor();
  await axe(page, "14-projects-en");

  // Dark mode.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("button", { name: "Le mouvement mécanique" }).click();
  await page.getByText(/3 source\(s\) read/).waitFor();
  await axe(page, "15-project-dark-en");

  // Generation: price first, consent, progress, result; nothing written before consent.
  await page.getByRole("button", { name: "Generate the storyboard" }).click();
  await page.getByText(/20,000 tokens.*\$0\.24 to/).waitFor();
  assert.ok(
    !existsSync(join(projectsDir, "le-mouvement-mecanique/storyboard.yaml")),
  );
  await axe(page, "16-generate-confirm-dark-en");
  await page.getByRole("button", { name: "Start generating" }).click();
  await page
    .getByText(/Storyboard ready in 1 answer\(s\): 0 error\(s\)/)
    .waitFor({ timeout: 60_000 });
  await page
    .getByText(/Read the storyboard, edit what needs it, then approve it/)
    .waitFor();
  assert.ok(
    existsSync(
      join(projectsDir, "le-mouvement-mecanique/review/storyboard.html"),
    ),
  );
  await axe(page, "17-generated-dark-en");
  console.log(
    "  ✓ generation: estimate, consent, storyboard written and checked",
  );

  // Storyboard screen: read, edit, save, approve (Sam's gate, under his name).
  const dir = join(projectsDir, "le-mouvement-mecanique");
  await page
    .getByRole("button", { name: "Review and approve the storyboard" })
    .click();
  await page.getByText("Awaiting approval").waitFor();
  await axe(page, "18-storyboard-dark-en");
  await page.emulateMedia({ colorScheme: "light" });
  const firstScreen = page.getByLabel("Screen title").first();
  await firstScreen.fill("Bienvenue dans le mouvement");
  await page.getByText("Unsaved changes").waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "Approve the storyboard" })
      .isDisabled(),
    "no approval with unsaved changes",
  );
  await axe(page, "19-storyboard-edited-en");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Changes saved.").waitFor();
  assert.match(
    readFileSync(join(dir, "storyboard.yaml"), "utf8"),
    /title: Bienvenue dans le mouvement/,
  );
  assert.ok(existsSync(join(dir, "storyboard.previous.yaml")));
  await page.getByRole("button", { name: "Approve the storyboard" }).click();
  await page.getByText(/By approving, you agree/).waitFor();
  await axe(page, "20-storyboard-confirm-en");
  await page.getByRole("button", { name: "I approve" }).click();
  await page.getByText(/Approved by Sam on/).waitFor();
  assert.match(
    readFileSync(join(dir, "project.yaml"), "utf8"),
    /storyboard:\s+hash: [0-9a-f]{64}\s+at: \S+\s+by: Sam/,
  );
  await page.getByRole("button", { name: "Back to the project" }).click();
  await page.getByRole("button", { name: "View the storyboard" }).waitFor();
  await axe(page, "21-project-approved-en");
  console.log("  ✓ storyboard: edited, saved (previous kept), approved by Sam");

  // Module: price first (writing + translations), then written, translated, previewed.
  await page.getByRole("button", { name: "Write the module" }).click();
  await page.getByText(/Estimated total:/).waitFor();
  assert.ok(!existsSync(join(dir, "module")), "nothing written before consent");
  await axe(page, "22-module-confirm-en");
  await page.getByRole("button", { name: "Start generating" }).click();
  await page
    .getByText(/Module written in 1 answer\(s\): 0 error\(s\)/)
    .waitFor({ timeout: 60_000 });
  await page.getByText("Translated into: German, Japanese.").waitFor();
  await page.getByText(/visuel de la marque/).waitFor();
  const moduleYaml = readFileSync(join(dir, "module/module.yaml"), "utf8");
  assert.match(moduleYaml, /- fr\n\s+- de\n\s+- ja/);
  assert.ok(existsSync(join(dir, "module/media/guide-mouvement-img-000.png")));
  await axe(page, "23-module-written-en");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).waitFor();
  for (
    let i = 0;
    i < 50 && !existsSync(join(dir, "out/preview/index.html"));
    i++
  )
    await page.waitForTimeout(200);
  assert.ok(existsSync(join(dir, "out/preview/index.html")), "preview built");
  console.log("  ✓ module: estimate, consent, written, translated, previewed");

  // Sam edits one text: its translations become due, and only it is sent again.
  await page.getByRole("button", { name: "Edit the texts" }).click();
  await page.getByLabel("Module title").waitFor();
  await axe(page, "24-texts-en");
  await page.getByLabel("Module title").fill("Le mouvement : expliqué");
  await page.getByText(/1 text\(s\) changed/).waitFor();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Changes saved.").waitFor();
  assert.equal(
    JSON.parse(readFileSync(join(dir, "module/strings/fr.json"), "utf8"))[
      "meta.title"
    ],
    "Le mouvement : expliqué",
  );
  await page.getByRole("button", { name: "Back to the project" }).click();
  await page.getByText("2 text(s) to translate or translate again.").waitFor();
  await page.getByRole("button", { name: "Update the translations" }).click();
  await page.getByRole("button", { name: "Start generating" }).click();
  await page.getByText(/Translations updated: German, Japanese/).waitFor();
  console.log("  ✓ texts: edited with French typography, translations redone");

  // Export: one package per format of the chosen outputs.
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByText(/Exported: .*scorm12\.zip/).waitFor({ timeout: 60_000 });
  assert.ok(
    existsSync(join(dir, "out/le-mouvement-mecanique-1.0.0-scorm12.zip")),
  );
  assert.ok(
    existsSync(join(dir, "out/le-mouvement-mecanique-1.0.0-html5.zip")),
  );
  await axe(page, "25-exported-en");
  console.log("  ✓ export: SCORM 1.2 (Watch Live) and HTML packages in out/");

  assert.deepEqual(errors, [], "no runtime error");
  console.log(
    "✓ Studio end-to-end: welcome → new project → sources read → lock → settings → generation → storyboard approved → module written, edited, translated, exported",
  );
} catch (e) {
  // What the window showed when the test failed.
  const page = await app.firstWindow();
  await page.screenshot({ path: join(SHOTS, "failure.png"), fullPage: true });
  console.error(
    `  window text: ${(await page.innerText("main")).slice(0, 1500)}`,
  );
  throw e;
} finally {
  await app.close();
}
