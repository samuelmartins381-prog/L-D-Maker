<script lang="ts">
import { onMount } from "svelte";
import { t } from "./i18n.svelte.ts";
import NewProject from "./screens/NewProject.svelte";
import Projects from "./screens/Projects.svelte";
import ProjectView from "./screens/ProjectView.svelte";
import SettingsScreen from "./screens/Settings.svelte";
import Welcome from "./screens/Welcome.svelte";
import { app, closeProject, loadSettings } from "./store.svelte.ts";

let ready = $state(false);
onMount(async () => {
  await loadSettings();
  ready = true;
  document.documentElement.dataset.ldmStudioReady = "";
});

async function go(screen: "projects" | "settings") {
  if (app.project) await closeProject();
  app.screen = screen;
}
</script>

{#if ready}
  {#if app.screen === "welcome"}
    <Welcome />
  {:else}
    <div class="shell">
      <header class="rail">
        <p class="brand">
          <span class="mark" aria-hidden="true"></span>
          <span>{t("app.name")}</span>
        </p>
        <nav aria-label={t("nav.main")}>
          <ul>
            <li>
              <button
                type="button"
                aria-current={app.screen === "projects" || app.screen === "new" || app.screen === "project" ? "page" : undefined}
                onclick={() => go("projects")}>{t("nav.projects")}</button
              >
            </li>
            <li>
              <button
                type="button"
                aria-current={app.screen === "settings" ? "page" : undefined}
                onclick={() => go("settings")}>{t("nav.settings")}</button
              >
            </li>
          </ul>
        </nav>
        {#if app.settings?.userName}
          <p class="user muted">{app.settings.userName}</p>
        {/if}
      </header>
      <main>
        <div aria-live="polite">
          {#if app.error}
            <p class="notice notice-error" role="alert">
              {t("common.error", { message: app.error })}
            </p>
          {/if}
        </div>
        {#if app.screen === "projects"}
          <Projects />
        {:else if app.screen === "new"}
          <NewProject />
        {:else if app.screen === "project" && app.project}
          <ProjectView />
        {:else if app.screen === "settings"}
          <SettingsScreen />
        {/if}
      </main>
    </div>
  {/if}
{/if}

<style>
  .shell {
    display: grid;
    grid-template-columns: 15rem 1fr;
    min-block-size: 100vh;
  }

  .rail {
    position: sticky;
    inset-block-start: 0;
    block-size: 100vh;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1.5rem 1rem;
    border-inline-end: 1px solid var(--line);
    background: var(--surface-sunk);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: var(--text-lg);
    font-weight: 600;
    padding-inline: 0.5rem;
  }

  /* A balance wheel seen from above: ring and four spokes. */
  .mark {
    inline-size: 1.4rem;
    block-size: 1.4rem;
    border-radius: 50%;
    border: 2px solid var(--accent);
    background:
      linear-gradient(var(--accent), var(--accent)) center / 2px 100% no-repeat,
      linear-gradient(var(--accent), var(--accent)) center / 100% 2px no-repeat;
    flex: none;
  }

  nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
  }

  nav button {
    inline-size: 100%;
    text-align: start;
    padding: 0.55rem 0.75rem;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-weight: 550;
    cursor: pointer;
  }

  nav button:hover {
    background: var(--surface);
  }

  nav button[aria-current="page"] {
    background: var(--surface);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .user {
    margin-block-start: auto;
    padding-inline: 0.75rem;
    font-size: var(--text-sm);
  }

  main {
    padding: 2.5rem clamp(1.5rem, 4vw, 3.5rem) 4rem;
    min-inline-size: 0;
    display: grid;
    align-content: start;
    gap: 1rem;
  }
</style>
