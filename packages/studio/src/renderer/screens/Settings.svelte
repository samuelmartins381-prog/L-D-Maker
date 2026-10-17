<script lang="ts">
import { STUDIO_LOCALES, type StudioLocale } from "../../shared/api.ts";
import { setLocale, t } from "../i18n.svelte.ts";
import { app, unwrap } from "../store.svelte.ts";

let name = $state(app.settings?.userName ?? "");
let key = $state("");
let saved = $state("");

async function saveName(e: SubmitEvent) {
  e.preventDefault();
  if (!name.trim()) return;
  app.settings = await window.ldm.setUserName(name);
  saved = t("settings.saved");
}

async function changeLocale(e: Event) {
  const locale = (e.currentTarget as HTMLSelectElement).value as StudioLocale;
  app.settings = await window.ldm.setLocale(locale);
  setLocale(locale);
}

async function chooseFolder() {
  app.settings = await window.ldm.chooseProjectsDir();
}

async function saveKey(e: SubmitEvent) {
  e.preventDefault();
  if (!key.trim()) return;
  const s = unwrap(await window.ldm.setApiKey(key));
  if (s) {
    app.settings = s;
    key = "";
    saved = t("settings.saved");
  }
}

async function removeKey() {
  const s = unwrap(await window.ldm.setApiKey(null));
  if (s) app.settings = s;
}
</script>

<div class="settings">
  <h1>{t("settings.title")}</h1>

  <form class="card block" onsubmit={saveName}>
    <div class="field">
      <label for="user-name">{t("settings.name")}</label>
      <input id="user-name" type="text" autocomplete="given-name" bind:value={name} />
    </div>
    <button type="submit" class="btn">{t("common.save")}</button>
  </form>

  <section class="card block" aria-labelledby="folder-title">
    <h2 id="folder-title" class="label-like">{t("settings.folder")}</h2>
    <code class="path">{app.settings?.projectsDir ?? t("welcome.folder.none")}</code>
    <button type="button" class="btn" onclick={chooseFolder}>{t("welcome.folder.choose")}</button>
  </section>

  <section class="card block">
    <div class="field">
      <label for="studio-locale">{t("settings.language")}</label>
      <select id="studio-locale" value={app.settings?.locale} onchange={changeLocale}>
        {#each STUDIO_LOCALES as l (l)}
          <option value={l}>{l === "fr" ? "Français" : "English"}</option>
        {/each}
      </select>
    </div>
  </section>

  <form class="card block" onsubmit={saveKey} aria-labelledby="key-title">
    <h2 id="key-title" class="label-like">{t("settings.apiKey")}</h2>
    <p class="help">{t("settings.apiKeyHelp")}</p>
    <p>{app.settings?.hasApiKey ? t("settings.apiKeySet") : t("settings.apiKeyUnset")}</p>
    {#if app.settings?.canStoreKey}
      <div class="field">
        <label for="api-key" class="visually-hidden">{t("settings.apiKey")}</label>
        <input
          id="api-key"
          type="password"
          autocomplete="off"
          spellcheck="false"
          placeholder={t("settings.apiKeyPlaceholder")}
          bind:value={key}
        />
      </div>
      <div class="actions">
        <button type="submit" class="btn btn-primary">{t("settings.apiKeySave")}</button>
        {#if app.settings.hasApiKey}
          <button type="button" class="btn" onclick={removeKey}>{t("settings.apiKeyRemove")}</button>
        {/if}
      </div>
    {:else}
      <p class="notice">{t("settings.apiKeyNoKeychain")}</p>
    {/if}
  </form>

  <p class="visually-hidden" aria-live="polite">{saved}</p>
</div>

<style>
  .settings {
    display: grid;
    gap: 1.25rem;
    max-inline-size: 40rem;
  }

  .block {
    padding: 1.5rem;
    display: grid;
    gap: 0.9rem;
    justify-items: start;
  }

  .block .field {
    justify-self: stretch;
  }

  .label-like {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0;
  }

  .path {
    font-size: var(--text-sm);
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
  }
</style>
