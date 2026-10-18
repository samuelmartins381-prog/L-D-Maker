<script lang="ts">
import type { Storyboard, StoryboardDetail } from "../../shared/api.ts";
import { t, tk } from "../i18n.svelte.ts";
import { app, unwrap } from "../store.svelte.ts";

const p = $derived(app.project);
let detail = $state<StoryboardDetail | null>(null);
/** Sam's working copy; saved to storyboard.yaml on demand. */
let draft = $state<Storyboard | null>(null);
let saving = $state(false);
let confirming = $state(false);
let saved = $state(false);

function take(d: StoryboardDetail | null) {
  if (!d) return;
  detail = d;
  draft = d.storyboard ? structuredClone(d.storyboard) : null;
}

$effect(() => {
  if (p) void window.ldm.storyboard(p.dir).then((r) => take(unwrap(r)));
});

const dirty = $derived(
  !!draft &&
    !!detail?.storyboard &&
    JSON.stringify(draft) !== JSON.stringify(detail.storyboard),
);
const errors = $derived(
  detail?.issues.filter((i) => i.severity === "error") ?? [],
);
const warnings = $derived(
  detail?.issues.filter((i) => i.severity === "warning") ?? [],
);
const approvedNow = $derived(!!detail?.approval?.current);

async function save() {
  if (!p || !draft) return;
  saving = true;
  const d = unwrap(
    await window.ldm.saveStoryboard(p.dir, $state.snapshot(draft)),
  );
  saving = false;
  take(d);
  saved = !!d;
}

function discard() {
  if (detail?.storyboard) draft = structuredClone(detail.storyboard);
}

async function approve() {
  if (!p) return;
  confirming = false;
  take(unwrap(await window.ldm.approveStoryboard(p.dir)));
}

async function back() {
  if (!p) return;
  const updated = unwrap(await window.ldm.openProject(p.dir));
  if (updated) app.project = updated;
  app.screen = "project";
}

const editable = $derived(!!p?.editable);
</script>

{#if p}
  <div class="storyboard">
    <p>
      <button type="button" class="btn btn-quiet back" onclick={back}
        >← {t("storyboard.back")}</button
      >
    </p>
    <header>
      <p class="eyebrow">{t("storyboard.eyebrow")}</p>
      <h1>{draft?.module.title ?? p.title}</h1>
    </header>

    {#if !detail}
      <p class="muted">{t("common.loading")}</p>
    {:else}
      <section class="card status" aria-labelledby="status-title">
        <h2 id="status-title" class="visually-hidden">{t("storyboard.status")}</h2>
        <p class="state" aria-live="polite">
          {#if dirty}
            <span class="pill pill-warning">{t("storyboard.unsaved")}</span>
          {:else if approvedNow && detail.approval}
            <span class="pill pill-success"
              >{t("storyboard.approved", { by: detail.approval.by, at: detail.approval.at })}</span
            >
          {:else if detail.approval}
            <span class="pill pill-warning">{t("storyboard.approvalOutdated")}</span>
          {:else}
            <span class="pill">{t("storyboard.pending")}</span>
          {/if}
          <span class="muted">
            {t("storyboard.counts", { errors: errors.length, warnings: warnings.length })}
          </span>
          {#if saved && !dirty}
            <span class="muted">{t("storyboard.saved")}</span>
          {/if}
        </p>
        {#if editable}
          <div class="actions">
            <button type="button" class="btn" onclick={save} disabled={!dirty || saving}
              >{t("storyboard.save")}</button
            >
            <button type="button" class="btn btn-quiet" onclick={discard} disabled={!dirty || saving}
              >{t("storyboard.discard")}</button
            >
            {#if !approvedNow}
              <button
                type="button"
                class="btn btn-primary"
                onclick={() => (confirming = true)}
                disabled={dirty || errors.length > 0 || !detail.storyboard || confirming}
                >{t("storyboard.approve")}</button
              >
            {/if}
          </div>
          {#if dirty}
            <p class="help">{t("storyboard.saveFirst")}</p>
          {:else if errors.length && !approvedNow}
            <p class="help">{t("storyboard.fixFirst")}</p>
          {/if}
          {#if confirming}
            <div class="confirm" role="group" aria-labelledby="confirm-text">
              <p id="confirm-text">{t("storyboard.confirm")}</p>
              <div class="actions">
                <button type="button" class="btn btn-primary" onclick={approve}
                  >{t("storyboard.confirmYes")}</button
                >
                <button type="button" class="btn" onclick={() => (confirming = false)}
                  >{t("common.cancel")}</button
                >
              </div>
            </div>
          {/if}
        {/if}
      </section>

      {#if detail.issues.length}
        <section class="card block" aria-labelledby="issues-title">
          <h2 id="issues-title">{t("storyboard.issues")}</h2>
          <ul class="issues">
            {#each detail.issues as issue, i (i)}
              <li class={issue.severity}>
                <span class="sev">{t(issue.severity === "error" ? "storyboard.error" : "storyboard.warning")}</span>
                <span>
                  <strong>{tk(`issue.${issue.code}`)}</strong>
                  <span class="muted detail">{issue.message} · <code>{issue.where}</code></span>
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      {#if draft}
        {#if draft.openQuestions.length}
          <section class="card block questions" aria-labelledby="open-title">
            <h2 id="open-title">{t("storyboard.openQuestions")}</h2>
            <p class="help">{t("storyboard.openQuestionsHelp")}</p>
            <ol>
              {#each draft.openQuestions as q, i (i)}
                <li>{q}</li>
              {/each}
            </ol>
          </section>
        {/if}

        <section class="card block" aria-labelledby="module-title">
          <h2 id="module-title">{t("storyboard.module")}</h2>
          <div class="field">
            <label for="sb-title">{t("storyboard.moduleTitle")}</label>
            <input id="sb-title" type="text" bind:value={draft.module.title} disabled={!editable} />
          </div>
          <div class="field">
            <label for="sb-audience">{t("storyboard.audience")}</label>
            <input id="sb-audience" type="text" bind:value={draft.module.audience} disabled={!editable} />
          </div>
        </section>

        <section class="card block" aria-labelledby="objectives-title">
          <h2 id="objectives-title">{t("storyboard.objectives")}</h2>
          {#each draft.objectives as o, i (o.id)}
            <div class="field">
              <label for="obj-{o.id}"
                >{t("storyboard.objective", { n: i + 1 })}
                <span class="muted">· {tk(`bloom.${o.bloom}`)}</span></label
              >
              <textarea id="obj-{o.id}" class="short" bind:value={o.text} disabled={!editable}></textarea>
            </div>
          {/each}
        </section>

        {#each draft.sections as section (section.id)}
          <section class="section" aria-labelledby="sec-{section.id}">
            <h2 id="sec-{section.id}" class="section-title">{section.title}</h2>
            <div class="field">
              <label for="sec-title-{section.id}">{t("storyboard.sectionTitle")}</label>
              <input id="sec-title-{section.id}" type="text" bind:value={section.title} disabled={!editable} />
            </div>
            {#each section.screens as screen, si (screen.id)}
              <article class="card screen" aria-labelledby="scr-{screen.id}">
                <h3 id="scr-{screen.id}">
                  <span class="muted num">{t("storyboard.screen", { n: si + 1 })}</span>
                  {screen.title}
                  <span class="muted num minutes">{t("common.minutes", { n: screen.minutes })}</span>
                </h3>
                <div class="field">
                  <label for="scr-title-{screen.id}">{t("storyboard.screenTitle")}</label>
                  <input id="scr-title-{screen.id}" type="text" bind:value={screen.title} disabled={!editable} />
                </div>
                {#each screen.blocks as b (b.id)}
                  <div class="sb-block">
                    <p class="kind">
                      {tk(`block.${b.type}`)}{#if b.variant}
                        · {tk(`question.${b.variant}`)}{/if}{#if b.type === "question"}
                        · {t(b.scored === false ? "storyboard.practice" : "storyboard.scored")}{/if}{#if b.role}
                        · {tk(`role.${b.role}`)}{/if}
                    </p>
                    <div class="field">
                      <label for="intent-{b.id}">{t("storyboard.intent")}</label>
                      <textarea id="intent-{b.id}" class="short" bind:value={b.intent} disabled={!editable}></textarea>
                    </div>
                    <div class="field">
                      <label for="content-{b.id}">{t("storyboard.content")}</label>
                      <textarea id="content-{b.id}" bind:value={b.content} disabled={!editable}></textarea>
                    </div>
                    {#if b.media}
                      <div class="field">
                        <label for="media-{b.id}">{t("storyboard.media")}</label>
                        <textarea id="media-{b.id}" class="short" bind:value={b.media} disabled={!editable}></textarea>
                      </div>
                    {/if}
                    {#if b.choices?.length}
                      <fieldset class="answers">
                        <legend>
                          {t(b.variant === "sequence" ? "storyboard.order" : "storyboard.choices")}
                        </legend>
                        {#each b.choices as c, ci (ci)}
                          <div class="answer">
                            <label class="visually-hidden" for="ch-{b.id}-{ci}"
                              >{t("storyboard.choice", { n: ci + 1 })}</label
                            >
                            <input id="ch-{b.id}-{ci}" type="text" bind:value={c.text} disabled={!editable} />
                            {#if b.variant !== "sequence"}
                              <label class="correct">
                                <input type="checkbox" bind:checked={c.correct} disabled={!editable} />
                                {t("storyboard.correct")}
                                <span class="visually-hidden">({t("storyboard.choice", { n: ci + 1 })})</span>
                              </label>
                            {/if}
                            {#if c.misconception !== undefined}
                              <p class="help misconception">
                                {t("storyboard.misconception", { text: c.misconception })}
                              </p>
                            {/if}
                          </div>
                        {/each}
                      </fieldset>
                    {/if}
                    {#if b.sourceRefs.length}
                      <p class="help refs">
                        {t("storyboard.sources")}
                        {#each b.sourceRefs as r (r)}<code>{r}</code>{" "}{/each}
                      </p>
                    {/if}
                  </div>
                {/each}
              </article>
            {/each}
          </section>
        {/each}
      {/if}
    {/if}
  </div>
{/if}

<style>
  .storyboard {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 60rem;
  }

  .back {
    padding-inline: 0;
  }

  .status {
    position: sticky;
    inset-block-start: 0.75rem;
    z-index: 2;
    padding: 1rem 1.25rem;
    display: grid;
    gap: 0.75rem;
    border-inline-start: 4px solid var(--accent);
  }

  .state {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
  }

  .pill {
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    background: var(--surface-sunk);
    font-weight: 600;
    font-size: var(--text-sm);
  }

  .pill-success {
    background: var(--success-soft);
    color: var(--success);
  }

  .pill-warning {
    background: var(--warning-soft);
    color: var(--warning);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .confirm {
    display: grid;
    gap: 0.6rem;
    padding: 0.85rem 1rem;
    border-radius: var(--radius-sm);
    background: var(--accent-soft);
  }

  .block {
    padding: 1.5rem;
    display: grid;
    gap: 1rem;
    min-inline-size: 0;
  }

  .issues {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }

  .issues li {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    gap: 0.75rem;
    overflow-wrap: anywhere;
  }

  .sev {
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .issues .error .sev {
    color: var(--error);
  }

  .issues .warning .sev {
    color: var(--warning);
  }

  .detail {
    display: block;
    font-size: var(--text-sm);
  }

  .questions ol {
    margin: 0;
    padding-inline-start: 1.25rem;
    display: grid;
    gap: 0.5rem;
  }

  textarea.short {
    min-block-size: 4rem;
  }

  .section {
    display: grid;
    gap: 1rem;
  }

  .section-title {
    font-family: var(--font-display);
    margin-block-start: 1rem;
  }

  .screen {
    padding: 1.5rem;
    display: grid;
    gap: 1rem;
    min-inline-size: 0;
  }

  .screen h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0;
  }

  .minutes {
    margin-inline-start: auto;
    font-weight: 400;
    font-size: var(--text-sm);
  }

  .sb-block {
    display: grid;
    gap: 0.75rem;
    padding-block-start: 1rem;
    border-block-start: 1px solid var(--line);
  }

  .kind {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--accent);
  }

  .answers {
    gap: 0.75rem;
  }

  .answer {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.35rem 0.75rem;
    align-items: center;
  }

  .correct {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-sm);
    white-space: nowrap;
  }

  .misconception {
    grid-column: 1 / -1;
  }

  .refs code {
    margin-inline-end: 0.35rem;
  }
</style>
