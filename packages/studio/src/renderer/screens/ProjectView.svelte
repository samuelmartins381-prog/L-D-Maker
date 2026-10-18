<script lang="ts">
import { t, tk } from "../i18n.svelte.ts";
import {
  app,
  closeProject,
  openProject,
  stageOf,
  unwrap,
} from "../store.svelte.ts";
import GenerateStoryboard from "./GenerateStoryboard.svelte";

const p = $derived(app.project);
let reading = $state(false);
let dragging = $state(false);

/** Stepper: which steps are done and which one is current. */
const progress = $derived.by(() => {
  if (!p) return [];
  const s = p.state;
  const done = {
    sources: s.ingest.state === "done",
    storyboard: s.storyboard.state === "done",
    approval: s.approval.state === "done",
    module: s.module.exists,
    export: false,
  };
  const keys = [
    "sources",
    "storyboard",
    "approval",
    "module",
    "export",
  ] as const;
  const current = keys.find((k) => !done[k]);
  return keys.map((k) => ({
    key: k,
    state: done[k] ? "done" : k === current ? "current" : "todo",
  }));
});

const nextKey = $derived.by(() => {
  if (!p) return null;
  const stage = stageOf(p.state, p.sources.length > 0);
  return stage === "stage.sources"
    ? "project.next.sources"
    : stage === "stage.ingest"
      ? "project.next.ingest"
      : stage === "stage.storyboard" || stage === "stage.storyboardInvalid"
        ? "project.next.storyboard"
        : stage === "stage.approval" || stage === "stage.approvalOutdated"
          ? "project.next.approval"
          : "project.next.module";
});

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat(app.settings?.locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

async function add(paths: string[]) {
  if (!p || paths.length === 0) return;
  const updated = unwrap(await window.ldm.addSources(p.dir, paths));
  if (updated) app.project = updated;
}

async function pick() {
  await add(await window.ldm.pickSources());
}

async function remove(file: string) {
  if (!p) return;
  const updated = unwrap(await window.ldm.removeSource(p.dir, file));
  if (updated) app.project = updated;
}

async function read() {
  if (!p) return;
  reading = true;
  const updated = unwrap(await window.ldm.ingest(p.dir));
  reading = false;
  if (updated) app.project = updated;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dragging = false;
  if (p?.editable)
    void add(
      [...(e.dataTransfer?.files ?? [])].map((f) => window.ldm.pathForFile(f)),
    );
}

const sep = (dir: string) => (dir.includes("\\") ? "\\" : "/");
const kb = (bytes: number) => Math.max(1, Math.round(bytes / 1024));
</script>

<svelte:window
  ondragover={(e) => {
    e.preventDefault();
    dragging = true;
  }}
  ondragleave={() => (dragging = false)}
  ondrop={onDrop}
/>

{#if p}
  <div class="project">
    <p>
      <button type="button" class="btn btn-quiet back" onclick={closeProject}
        >← {t("project.back")}</button
      >
    </p>
    <header>
      <p class="eyebrow">{p.client ?? t("projects.noClient")}</p>
      <h1>{p.title}</h1>
    </header>

    {#if p.lockedBy}
      <div class="notice" role="status">
        <p>{t("project.locked", { name: p.lockedBy.by, time: fmtTime(p.lockedBy.at) })}</p>
        <button type="button" class="btn" onclick={() => openProject(p.dir, true)}
          >{t("project.forceOpen")}</button
        >
      </div>
    {/if}

    <section aria-labelledby="progress-title">
      <h2 id="progress-title" class="visually-hidden">{t("project.progress")}</h2>
      <ol class="progress">
        {#each progress as s (s.key)}
          <li class={s.state} aria-current={s.state === "current" ? "step" : undefined}>
            <span class="tick" aria-hidden="true"></span>
            <span class="label">{t(`progress.${s.key}`)}</span>
            <span class="visually-hidden">({t(`step.${s.state as "done" | "current" | "todo"}`)})</span>
          </li>
        {/each}
      </ol>
    </section>

    {#if nextKey}
      <section class="card next" aria-labelledby="next-title">
        <h2 id="next-title" class="eyebrow">{t("project.next")}</h2>
        <p>{tk(nextKey)}</p>
        {#if p.state.ingest.state === "done" && p.state.approval.state !== "done"}
          <GenerateStoryboard project={p} again={p.state.storyboard.state !== "missing"} />
        {/if}
        {#if p.state.storyboard.state !== "missing"}
          <div class="actions">
            <button
              type="button"
              class="btn {p.state.approval.state === 'done' ? '' : 'btn-primary'}"
              onclick={() => (app.screen = "storyboard")}
              >{t(p.state.approval.state === "done" ? "project.viewStoryboard" : "project.reviewStoryboard")}</button
            >
            <button
              type="button"
              class="btn btn-quiet"
              onclick={() => window.ldm.openPath(`${p.dir}${sep(p.dir)}review${sep(p.dir)}storyboard.html`)}
              >{t("project.openReview")}</button
            >
          </div>
        {/if}
      </section>
    {/if}

    <div class="grid">
      <section class="card block" aria-labelledby="sources-title">
        <h2 id="sources-title">{t("project.sources")}</h2>
        {#if p.sources.length === 0}
          <p class="muted">{t("project.noSources")}</p>
        {:else}
          <ul class="files" class:dragging>
            {#each p.sources as s (s.file)}
              <li>
                <span>{s.file}</span>
                <span class="muted num size">{t("common.kilobytes", { n: kb(s.bytes) })}</span>
                {#if p.editable}
                  <button type="button" class="btn btn-quiet" onclick={() => remove(s.file)}
                    >{t("common.remove")}<span class="visually-hidden"> {s.file}</span></button
                  >
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
        <p class="muted state" aria-live="polite">
          {#if reading}
            {t("project.reading")}
          {:else if p.state.ingest.state === "done"}
            {t("project.sourcesRead", {
              sources: p.state.ingest.sources,
              words: p.state.ingest.words,
              anchors: p.state.ingest.anchors,
            })}
          {:else if p.state.ingest.state === "stale"}
            {t("project.sourcesStale", { files: p.state.ingest.files.join(", ") })}
          {:else if p.sources.length}
            {t("project.sourcesUnread")}
          {/if}
        </p>
        {#if p.editable}
          <div class="actions">
            <button type="button" class="btn" onclick={pick}>{t("project.addSources")}</button>
            <button
              type="button"
              class="btn btn-primary"
              onclick={read}
              disabled={reading || p.sources.length === 0 || p.state.ingest.state === "done"}
              >{t("project.readSources")}</button
            >
          </div>
        {/if}
      </section>

      <section class="card block" aria-labelledby="choices-title">
        <h2 id="choices-title">{t("project.choices")}</h2>
        <dl>
          <dt>{t("project.audience")}</dt>
          <dd>{p.project.audience}</dd>
          <dt>{t("project.duration")}</dt>
          <dd class="num">{t("common.minutes", { n: p.project.durationMinutes })}</dd>
          <dt>{t("project.languages")}</dt>
          <dd>{p.project.locales.map((l) => tk(`locale.${l}`)).join(", ")}</dd>
          <dt>{t("project.outputs")}</dt>
          <dd>{p.project.outputs.map((o) => tk(`profile.${o.profile}`)).join(", ")}</dd>
          <dt>{t("project.design")}</dt>
          <dd>
            {tk(`theme.${p.project.design.theme}`)}
            {#if p.project.design.brand?.primary}
              · <code>{p.project.design.brand.primary}</code>
            {/if}
          </dd>
          <dt>{t("project.animation")}</dt>
          <dd>{t(`animation.${p.project.animation}`)}</dd>
          <dt>{t("project.assessment")}</dt>
          <dd>
            {t("project.assessmentValue", {
              types: p.project.assessment.questionTypes.map((q) => tk(`question.${q}`)).join(", "),
              n: p.project.assessment.questionsPerObjective,
              score: p.project.assessment.passingScore,
              attempts: p.project.assessment.attempts,
            })}
          </dd>
          <dt>{t("project.formality")}</dt>
          <dd>{t(`formality.${p.project.formality}`)}</dd>
        </dl>
        {#if p.project.brief}
          <details>
            <summary>{t("project.brief")}</summary>
            <p class="brief">{p.project.brief}</p>
          </details>
        {/if}
        <p>
          <button type="button" class="btn btn-quiet" onclick={() => window.ldm.openPath(p.dir)}
            >{t("project.openFolder")}</button
          >
        </p>
      </section>
    </div>
  </div>
{/if}

<style>
  .project {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 72rem;
  }

  .back {
    padding-inline: 0;
  }

  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  /* Stepper drawn like a minute track: ticks joined by a hairline. */
  .progress {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0;
  }

  .progress li {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 0.5rem;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }

  .progress li::before {
    content: "";
    position: absolute;
    inset-block-start: 0.55rem;
    inset-inline: 0;
    border-block-start: 1px solid var(--line-strong);
    z-index: 0;
  }

  .progress li:first-child::before {
    inset-inline-start: 50%;
  }

  .progress li:last-child::before {
    inset-inline-end: 50%;
  }

  .tick {
    position: relative;
    z-index: 1;
    inline-size: 1.1rem;
    block-size: 1.1rem;
    border-radius: 50%;
    border: 2px solid var(--line-strong);
    background: var(--bg);
  }

  .progress li.done .tick {
    background: var(--accent);
    border-color: var(--accent);
  }

  .progress li.current {
    color: var(--ink);
    font-weight: 600;
  }

  .progress li.current .tick {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }

  .next {
    padding: 1.25rem 1.5rem;
    display: grid;
    gap: 0.6rem;
    border-inline-start: 4px solid var(--accent);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
    gap: 1.5rem;
    align-items: start;
  }

  .block {
    padding: 1.5rem;
    display: grid;
    gap: 1rem;
    min-inline-size: 0;
  }

  .files {
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: var(--radius-sm);
  }

  .files.dragging {
    outline: 2px dashed var(--accent);
  }

  .files li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.45rem 0;
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

  .size {
    margin-inline-start: auto;
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  .state {
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  dl {
    display: grid;
    grid-template-columns: minmax(7rem, max-content) 1fr;
    gap: 0.45rem 1.25rem;
    margin: 0;
  }

  dt {
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  summary {
    cursor: pointer;
    font-weight: 600;
  }

  .brief {
    white-space: pre-wrap;
    margin-block-start: 0.5rem;
  }
</style>
