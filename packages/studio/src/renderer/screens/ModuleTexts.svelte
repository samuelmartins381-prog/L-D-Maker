<script lang="ts">
import type { ModuleTexts } from "../../shared/api.ts";
import { t, tk } from "../i18n.svelte.ts";
import { app, unwrap } from "../store.svelte.ts";

const p = $derived(app.project);
let texts = $state<ModuleTexts | null>(null);
/** Sam's working copy, key → text. */
let draft = $state<Record<string, string>>({});
let saving = $state(false);
let saved = $state(false);

function take(m: ModuleTexts | null) {
  if (!m) return;
  texts = m;
  draft = Object.fromEntries(
    m.groups.flatMap((g) => g.entries.map((e) => [e.key, e.text])),
  );
}

$effect(() => {
  if (p) void window.ldm.moduleTexts(p.dir).then((r) => take(unwrap(r)));
});

const original = $derived(
  Object.fromEntries(
    texts?.groups.flatMap((g) => g.entries.map((e) => [e.key, e.text])) ?? [],
  ),
);
const changes = $derived(
  Object.fromEntries(
    Object.entries(draft).filter(([k, v]) => v !== original[k]),
  ),
);
const dirty = $derived(Object.keys(changes).length > 0);

async function save() {
  if (!p) return;
  saving = true;
  const r = unwrap(await window.ldm.saveModuleTexts(p.dir, changes));
  saving = false;
  take(r);
  saved = !!r;
}

async function back() {
  if (!p) return;
  const updated = unwrap(await window.ldm.openProject(p.dir));
  if (updated) app.project = updated;
  app.screen = "project";
}

/** One line is enough for titles and answer options. */
const short = (field: string) =>
  [
    "title",
    "section",
    "screen",
    "heading",
    "choice",
    "item-title",
    "alt",
  ].includes(field);
const editable = $derived(!!p?.editable);
</script>

{#if p}
  <div class="texts">
    <p>
      <button type="button" class="btn btn-quiet back" onclick={back}
        >← {t("storyboard.back")}</button
      >
    </p>
    <header>
      <p class="eyebrow">{t("texts.eyebrow")}</p>
      <h1>{p.title}</h1>
      {#if texts}
        <p class="muted">{t("texts.intro", { language: tk(`locale.${texts.defaultLocale}`) })}</p>
      {/if}
    </header>

    {#if !texts}
      <p class="muted">{t("common.loading")}</p>
    {:else}
      {#if editable}
        <section class="card status" aria-label={t("texts.status")}>
          <p class="state" aria-live="polite">
            {#if dirty}
              <span class="pill pill-warning"
                >{t("texts.unsaved", { n: Object.keys(changes).length })}</span
              >
            {:else if saved}
              <span class="muted">{t("texts.saved")}</span>
            {/if}
          </p>
          <div class="actions">
            <button type="button" class="btn btn-primary" onclick={save} disabled={!dirty || saving}
              >{t("storyboard.save")}</button
            >
            <button type="button" class="btn btn-quiet" onclick={() => take(texts)} disabled={!dirty || saving}
              >{t("storyboard.discard")}</button
            >
          </div>
          <p class="help">{t("texts.translationsHelp")}</p>
        </section>
      {/if}

      {#each texts.groups as g (g.id)}
        <section class="card group" aria-labelledby="group-{g.id}">
          <h2 id="group-{g.id}">{g.title}</h2>
          {#each g.entries as e (e.key)}
            <div class="field">
              <label for="text-{e.key}">{tk(`field.${e.field}`)}</label>
              {#if short(e.field)}
                <input id="text-{e.key}" type="text" bind:value={draft[e.key]} disabled={!editable} />
              {:else}
                <textarea id="text-{e.key}" bind:value={draft[e.key]} disabled={!editable}></textarea>
              {/if}
            </div>
          {/each}
        </section>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .texts {
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
    gap: 0.5rem 1rem;
  }

  .state:empty {
    display: none;
  }

  .pill {
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-weight: 600;
    font-size: var(--text-sm);
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

  .group {
    padding: 1.5rem;
    display: grid;
    gap: 1rem;
    min-inline-size: 0;
  }

  .group textarea {
    min-block-size: 5rem;
  }
</style>
