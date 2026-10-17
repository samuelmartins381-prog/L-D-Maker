<script lang="ts">
import { t } from "../i18n.svelte.ts";
import { app } from "../store.svelte.ts";

let name = $state(app.settings?.userName ?? "");
let touched = $state(false);

async function chooseFolder() {
  app.settings = await window.ldm.chooseProjectsDir();
}

async function start(e: SubmitEvent) {
  e.preventDefault();
  touched = true;
  if (!name.trim() || !app.settings?.projectsDir) return;
  app.settings = await window.ldm.setUserName(name);
  app.screen = "projects";
}
</script>

<main class="welcome">
  <form class="card" onsubmit={start} novalidate>
    <span class="mark" aria-hidden="true"></span>
    <h1>{t("welcome.title")}</h1>
    <p class="muted">{t("welcome.intro")}</p>

    <div class="field">
      <label for="name">{t("welcome.name.label")}</label>
      <input
        id="name"
        type="text"
        autocomplete="given-name"
        bind:value={name}
        aria-describedby="name-help {touched && !name.trim() ? 'name-error' : ''}"
        aria-invalid={touched && !name.trim()}
      />
      <p id="name-help" class="help">{t("welcome.name.help")}</p>
      {#if touched && !name.trim()}
        <p id="name-error" class="error-text">{t("new.required")}</p>
      {/if}
    </div>

    <div class="field">
      <p class="label" id="folder-label">{t("welcome.folder.label")}</p>
      <p class="help" id="folder-help">{t("welcome.folder.help")}</p>
      <div class="folder">
        <button
          type="button"
          class="btn"
          aria-describedby="folder-label folder-help"
          onclick={chooseFolder}>{t("welcome.folder.choose")}</button
        >
        <code class="path">{app.settings?.projectsDir ?? t("welcome.folder.none")}</code>
      </div>
      {#if touched && !app.settings?.projectsDir}
        <p class="error-text">{t("new.required")}</p>
      {/if}
    </div>

    <button type="submit" class="btn btn-primary">{t("welcome.start")}</button>
  </form>
</main>

<style>
  .welcome {
    min-block-size: 100vh;
    display: grid;
    place-items: center;
    padding: 2rem;
  }

  form {
    inline-size: min(34rem, 100%);
    padding: 2.5rem;
    display: grid;
    gap: 1.5rem;
  }

  .mark {
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: 50%;
    border: 3px solid var(--accent);
    background:
      linear-gradient(var(--accent), var(--accent)) center / 3px 100% no-repeat,
      linear-gradient(var(--accent), var(--accent)) center / 100% 3px no-repeat;
  }

  .folder {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .path {
    font-size: var(--text-sm);
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  button[type="submit"] {
    justify-self: start;
  }
</style>
