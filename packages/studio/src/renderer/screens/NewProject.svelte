<script lang="ts">
import { PROFILE_IDS, PROFILES, type ProfileId } from "@ldm/builder/profiles";
import { tick } from "svelte";
import {
  MODULE_LOCALES,
  type NewProject,
  QUESTION_TYPES,
  THEMES,
} from "../../shared/api.ts";
import { hasKey, t, tk } from "../i18n.svelte.ts";
import { app, openProject, unwrap } from "../store.svelte.ts";

const STEPS = [
  "essentials",
  "sources",
  "languages",
  "output",
  "design",
  "assessment",
  "summary",
] as const;
type Step = (typeof STEPS)[number];
const FILE_PROFILES: ProfileId[] = ["html-file", "html-site"];
const LMS_PROFILES = PROFILE_IDS.filter((p) => !FILE_PROFILES.includes(p));

let step = $state<Step>("essentials");
let touched = $state(false);
let busy = $state<"" | "creating" | "reading">("");
let dragging = $state(false);
let heading = $state<HTMLHeadingElement>();

const form = $state<NewProject>({
  title: "",
  client: "",
  brief: "",
  audience: "",
  durationMinutes: 20,
  defaultLocale: app.settings?.locale ?? "fr",
  locales: [],
  outputs: ["lms-unknown"],
  theme: "lumiere",
  brand: { primary: "#8a4b2a", accent: "#2d6a45" },
  animation: "standard",
  questionTypes: [...QUESTION_TYPES],
  questionsPerObjective: 3,
  passingScore: 80,
  attempts: 1,
  formality: "formal",
  sources: [],
});
let useBrand = $state(false);

const index = $derived(STEPS.indexOf(step));
const name = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Problems that keep the current step from being left. */
const problems = $derived.by(() => {
  const p: string[] = [];
  if (step === "essentials") {
    if (!form.title.trim()) p.push("title");
    if (!form.audience.trim()) p.push("audience");
    if (!(form.durationMinutes >= 1)) p.push("duration");
  }
  if (step === "output" && form.outputs.length === 0) p.push("outputs");
  if (step === "assessment" && form.questionTypes.length === 0) p.push("types");
  return p;
});
const invalid = (field: string) => touched && problems.includes(field);

async function goTo(next: Step) {
  step = next;
  touched = false;
  await tick();
  heading?.focus();
}

function next() {
  touched = true;
  if (problems.length) return;
  const n = STEPS[index + 1];
  if (n) void goTo(n);
}

function back() {
  const n = STEPS[index - 1];
  if (n) void goTo(n);
  else app.screen = "projects";
}

function addFiles(paths: string[]) {
  for (const p of paths)
    if (p && !form.sources.includes(p)) form.sources.push(p);
}

async function pick() {
  addFiles(await window.ldm.pickSources());
}

function onDrop(e: DragEvent) {
  if (step !== "sources") return;
  e.preventDefault();
  dragging = false;
  addFiles(
    [...(e.dataTransfer?.files ?? [])].map((f) => window.ldm.pathForFile(f)),
  );
}

function onDragOver(e: DragEvent) {
  if (step !== "sources") return;
  e.preventDefault();
  dragging = true;
}

async function create() {
  busy = "creating";
  const input: NewProject = {
    ...$state.snapshot(form),
    locales: [
      form.defaultLocale,
      ...form.locales.filter((l) => l !== form.defaultLocale),
    ],
  };
  if (!useBrand) delete input.brand;
  const created = unwrap(await window.ldm.createProject(input));
  if (!created) {
    busy = "";
    return;
  }
  if (created.sources.length) {
    busy = "reading";
    unwrap(await window.ldm.ingest(created.dir));
  }
  busy = "";
  await openProject(created.dir);
}
</script>

<svelte:window
  ondragover={onDragOver}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
/>

<div class="wizard">
  <header>
    <p class="eyebrow">{t("new.title")}</p>
    <nav aria-label={t("new.steps")}>
      <ol class="steps">
        {#each STEPS as s, i (s)}
          <li
            aria-current={s === step ? "step" : undefined}
            class:done={i < index}
          >
            <span class="dot num" aria-hidden="true">{i + 1}</span>
            <span>{t(`new.step.${s}`)}</span>
          </li>
        {/each}
      </ol>
    </nav>
  </header>

  <section class="card panel" aria-labelledby="step-title">
    <p class="muted num">{t("new.stepOf", { n: index + 1, total: STEPS.length })}</p>
    <h1 id="step-title" tabindex="-1" bind:this={heading}>{t(`new.step.${step}`)}</h1>

    {#if step === "essentials"}
      <div class="field">
        <label for="title">{t("new.essentials.title")}</label>
        <input
          id="title"
          type="text"
          bind:value={form.title}
          aria-invalid={invalid("title")}
          aria-describedby={invalid("title") ? "title-error" : undefined}
        />
        {#if invalid("title")}<p id="title-error" class="error-text">{t("new.required")}</p>{/if}
      </div>
      <div class="field">
        <label for="client">{t("new.essentials.client")} <span class="muted">({t("common.optional")})</span></label>
        <input id="client" type="text" bind:value={form.client} />
      </div>
      <div class="field">
        <label for="audience">{t("new.essentials.audience")}</label>
        <input
          id="audience"
          type="text"
          bind:value={form.audience}
          aria-invalid={invalid("audience")}
          aria-describedby="audience-help {invalid('audience') ? 'audience-error' : ''}"
        />
        <p id="audience-help" class="help">{t("new.essentials.audienceHelp")}</p>
        {#if invalid("audience")}<p id="audience-error" class="error-text">{t("new.required")}</p>{/if}
      </div>
      <div class="field">
        <label for="duration">{t("new.essentials.duration")}</label>
        <input
          id="duration"
          type="number"
          min="1"
          max="600"
          bind:value={form.durationMinutes}
          aria-invalid={invalid("duration")}
        />
      </div>
      <div class="field">
        <label for="brief">{t("new.essentials.brief")} <span class="muted">({t("common.optional")})</span></label>
        <textarea id="brief" bind:value={form.brief} aria-describedby="brief-help"></textarea>
        <p id="brief-help" class="help">{t("new.essentials.briefHelp")}</p>
      </div>
    {:else if step === "sources"}
      <p class="muted">{t("new.sources.intro")}</p>
      <div class="drop" class:dragging>
        <p class="drop-title">{t("new.sources.drop")}</p>
        <p class="muted">{t("new.sources.or")}</p>
        <button type="button" class="btn" onclick={pick}>{t("new.sources.pick")}</button>
        <p class="help">{t("new.sources.types")}</p>
      </div>
      <h2 class="sub">{t("new.sources.list")}</h2>
      {#if form.sources.length === 0}
        <p class="muted">{t("new.sources.none")}</p>
      {:else}
        <ul class="files">
          {#each form.sources as path (path)}
            <li>
              <span>{name(path)}</span>
              <button
                type="button"
                class="btn btn-quiet"
                onclick={() => (form.sources = form.sources.filter((p) => p !== path))}
                >{t("common.remove")}<span class="visually-hidden"> {name(path)}</span></button
              >
            </li>
          {/each}
        </ul>
      {/if}
    {:else if step === "languages"}
      <fieldset>
        <legend>{t("new.languages.default")}</legend>
        <div class="choices">
          {#each MODULE_LOCALES as l (l)}
            <label class="choice">
              <input type="radio" name="default-locale" value={l} bind:group={form.defaultLocale} />
              <span class="title">{tk(`locale.${l}`)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("new.languages.others")}</legend>
        <p class="help">{t("new.languages.help")}</p>
        <div class="choices">
          {#each MODULE_LOCALES.filter((l) => l !== form.defaultLocale) as l (l)}
            <label class="choice">
              <input type="checkbox" value={l} bind:group={form.locales} />
              <span class="title">{tk(`locale.${l}`)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {:else if step === "output"}
      <p class="muted">{t("new.output.intro")}</p>
      {#each [["new.output.lms", LMS_PROFILES], ["new.output.files", FILE_PROFILES]] as const as [legend, ids] (legend)}
        <fieldset aria-describedby={invalid("outputs") ? "outputs-error" : undefined}>
          <legend>{t(legend)}</legend>
          <div class="choices">
            {#each ids as id (id)}
              <label class="choice">
                <input type="checkbox" value={id} bind:group={form.outputs} />
                <span class="title">{tk(`profile.${id}`)}</span>
                {#if hasKey(`profile.${id}.help`)}
                  <span class="help">{tk(`profile.${id}.help`)}</span>
                {/if}
                {#if !PROFILES[id].ready && PROFILES[id].format !== "html-file"}
                  <span class="help pending">{t("new.output.preparing")}</span>
                {/if}
              </label>
            {/each}
          </div>
        </fieldset>
      {/each}
      {#if invalid("outputs")}<p id="outputs-error" class="error-text">{t("new.output.required")}</p>{/if}
    {:else if step === "design"}
      <fieldset>
        <legend>{t("new.design.theme")}</legend>
        <div class="choices">
          {#each THEMES as theme (theme)}
            <label class="choice">
              <input type="radio" name="theme" value={theme} bind:group={form.theme} />
              <span class="title">{tk(`theme.${theme}`)}</span>
              <span class="help">{tk(`theme.${theme}.help`)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("new.design.brand")}</legend>
        <p class="help">{t("new.design.brandHelp")}</p>
        <label class="inline">
          <input type="checkbox" bind:checked={useBrand} />
          {t("new.design.useBrand")}
        </label>
        {#if useBrand && form.brand}
          <div class="colors">
            <label class="inline">
              <input type="color" bind:value={form.brand.primary} />
              {t("new.design.primary")} <code>{form.brand.primary}</code>
            </label>
            <label class="inline">
              <input type="color" bind:value={form.brand.accent} />
              {t("new.design.accent")} <code>{form.brand.accent}</code>
            </label>
          </div>
        {/if}
      </fieldset>
      <fieldset>
        <legend>{t("new.design.animation")}</legend>
        <p class="help">{t("new.design.animationHelp")}</p>
        <div class="choices">
          {#each ["sober", "standard", "rich"] as const as a (a)}
            <label class="choice">
              <input type="radio" name="animation" value={a} bind:group={form.animation} />
              <span class="title">{t(`animation.${a}`)}</span>
              <span class="help">{t(`animation.${a}.help`)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {:else if step === "assessment"}
      <fieldset aria-describedby={invalid("types") ? "types-error" : undefined}>
        <legend>{t("new.assessment.types")}</legend>
        <div class="choices">
          {#each QUESTION_TYPES as q (q)}
            <label class="choice">
              <input type="checkbox" value={q} bind:group={form.questionTypes} />
              <span class="title">{t(`question.${q}`)}</span>
            </label>
          {/each}
        </div>
        {#if invalid("types")}<p id="types-error" class="error-text">{t("new.assessment.typesRequired")}</p>{/if}
      </fieldset>
      <div class="row">
        <div class="field">
          <label for="per-objective">{t("new.assessment.perObjective")}</label>
          <input id="per-objective" type="number" min="3" max="10" bind:value={form.questionsPerObjective} />
        </div>
        <div class="field">
          <label for="passing">{t("new.assessment.passing")}</label>
          <input id="passing" type="number" min="1" max="100" bind:value={form.passingScore} />
        </div>
        <div class="field">
          <label for="attempts">{t("new.assessment.attempts")}</label>
          <input id="attempts" type="number" min="1" max="5" bind:value={form.attempts} />
        </div>
      </div>
      <fieldset>
        <legend>{t("new.assessment.formality")}</legend>
        <div class="choices">
          {#each ["formal", "informal"] as const as f (f)}
            <label class="choice">
              <input type="radio" name="formality" value={f} bind:group={form.formality} />
              <span class="title">{t(`formality.${f}`)}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {:else if step === "summary"}
      <p class="muted">{t("new.summary.intro")}</p>
      <dl class="summary">
        <dt>{t("new.essentials.title")}</dt>
        <dd>{form.title}</dd>
        {#if form.client}<dt>{t("new.essentials.client")}</dt><dd>{form.client}</dd>{/if}
        <dt>{t("project.audience")}</dt>
        <dd>{form.audience}</dd>
        <dt>{t("project.duration")}</dt>
        <dd class="num">{t("common.minutes", { n: form.durationMinutes })}</dd>
        <dt>{t("project.sources")}</dt>
        <dd>{form.sources.map(name).join(", ") || "—"}</dd>
        <dt>{t("project.languages")}</dt>
        <dd>
          {[form.defaultLocale, ...form.locales.filter((l) => l !== form.defaultLocale)]
            .map((l) => tk(`locale.${l}`))
            .join(", ")}
        </dd>
        <dt>{t("project.outputs")}</dt>
        <dd>{form.outputs.map((o) => tk(`profile.${o}`)).join(", ")}</dd>
        <dt>{t("project.design")}</dt>
        <dd>
          {tk(`theme.${form.theme}`)}{#if useBrand && form.brand} · <code>{form.brand.primary}</code> <code>{form.brand.accent}</code>{/if}
        </dd>
        <dt>{t("project.animation")}</dt>
        <dd>{t(`animation.${form.animation}`)}</dd>
        <dt>{t("project.assessment")}</dt>
        <dd>
          {t("project.assessmentValue", {
            types: form.questionTypes.map((q) => tk(`question.${q}`)).join(", "),
            n: form.questionsPerObjective,
            score: form.passingScore,
            attempts: form.attempts,
          })}
        </dd>
        <dt>{t("project.formality")}</dt>
        <dd>{t(`formality.${form.formality}`)}</dd>
      </dl>
    {/if}

    <div class="actions">
      <button type="button" class="btn" onclick={back} disabled={busy !== ""}>
        {index === 0 ? t("common.cancel") : t("common.back")}
      </button>
      {#if step === "summary"}
        <button type="button" class="btn btn-primary" onclick={create} disabled={busy !== ""}>
          {busy === "creating"
            ? t("new.summary.creating")
            : busy === "reading"
              ? t("new.summary.reading")
              : t("new.summary.create")}
        </button>
      {:else}
        <button type="button" class="btn btn-primary" onclick={next}>{t("common.next")}</button>
      {/if}
    </div>
    <p class="visually-hidden" aria-live="polite">
      {busy === "creating" ? t("new.summary.creating") : busy === "reading" ? t("new.summary.reading") : ""}
    </p>
  </section>
</div>

<style>
  .wizard {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 60rem;
  }

  .steps {
    list-style: none;
    margin: 0.6rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.2rem;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .dot {
    display: inline-grid;
    place-items: center;
    inline-size: 1.5rem;
    block-size: 1.5rem;
    border-radius: 50%;
    border: 1px solid var(--line-strong);
    font-size: var(--text-xs);
    font-weight: 600;
  }

  .steps li.done .dot {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }

  .steps li[aria-current="step"] {
    color: var(--ink);
    font-weight: 600;
  }

  .steps li[aria-current="step"] .dot {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }

  .panel {
    padding: clamp(1.5rem, 3vw, 2.5rem);
    display: grid;
    gap: 1.4rem;
  }

  h1:focus {
    outline: none;
  }

  .sub {
    font-size: var(--text-lg);
  }

  .drop {
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    padding: 2.5rem 1rem;
    border: 2px dashed var(--line-strong);
    border-radius: var(--radius);
    background: var(--bg);
    text-align: center;
  }

  .drop.dragging {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .drop-title {
    font-family: var(--font-display);
    font-size: var(--text-lg);
  }

  .files {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }

  .files li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.35rem 0.75rem;
    border-block-end: 1px solid var(--line);
    overflow-wrap: anywhere;
  }

  /* Long file names wrap; the size and the Remove button never do. */
  .files li > span:first-child {
    flex: 1;
    min-inline-size: 0;
  }

  .files li .btn,
  .files li .size {
    flex: none;
    white-space: nowrap;
  }

  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
  }

  .colors {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
  }

  input[type="color"] {
    inline-size: 2.5rem;
    block-size: 2rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    padding: 0.1rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
  }

  .pending {
    color: var(--warning);
  }

  .summary {
    display: grid;
    grid-template-columns: minmax(9rem, max-content) 1fr;
    gap: 0.5rem 1.5rem;
    margin: 0;
  }

  .summary dt {
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }

  .summary dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding-block-start: 1rem;
    border-block-start: 1px solid var(--line);
  }
</style>
