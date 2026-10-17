<script lang="ts">
import { onMount } from "svelte";
import type { ProjectSummary } from "../../shared/api.ts";
import { t } from "../i18n.svelte.ts";
import { app, openProject, stageOf, unwrap } from "../store.svelte.ts";

let projects = $state<ProjectSummary[] | null>(null);

async function load() {
  projects = unwrap(await window.ldm.listProjects()) ?? [];
}
onMount(load);

async function changeFolder() {
  app.settings = await window.ldm.chooseProjectsDir();
  await load();
}
</script>

<header class="head">
  <div>
    <h1>{t("projects.title")}</h1>
    <p class="muted folder">
      {t("projects.folder", { path: app.settings?.projectsDir ?? "" })}
      <button type="button" class="btn btn-quiet" onclick={changeFolder}
        >{t("projects.changeFolder")}</button
      >
    </p>
  </div>
  <button type="button" class="btn btn-primary" onclick={() => (app.screen = "new")}
    >{t("projects.new")}</button
  >
</header>

{#if projects === null}
  <p class="muted">{t("common.loading")}</p>
{:else if projects.length === 0}
  <section class="empty card">
    <h2>{t("projects.empty.title")}</h2>
    <p class="muted">{t("projects.empty.body")}</p>
    <button type="button" class="btn btn-primary" onclick={() => (app.screen = "new")}
      >{t("projects.new")}</button
    >
  </section>
{:else}
  <ul class="list">
    {#each projects as p (p.dir)}
      <li class="card item">
        <p class="eyebrow">{p.client ?? t("projects.noClient")}</p>
        <h2>
          <button type="button" class="open" onclick={() => openProject(p.dir)}>{p.title}</button>
        </h2>
        <p class="stage">{t(stageOf(p.state))}</p>
        {#if p.lockedBy}
          <p class="lock muted">{t("projects.lockedBy", { name: p.lockedBy.by })}</p>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin-block-end: 1rem;
  }

  .folder {
    margin-block-start: 0.4rem;
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .empty {
    padding: 2.5rem;
    display: grid;
    gap: 1rem;
    justify-items: start;
    max-inline-size: 40rem;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    gap: 1rem;
  }

  .item {
    position: relative;
    padding: 1.25rem 1.25rem 1.1rem;
    display: grid;
    gap: 0.4rem;
    align-content: start;
  }

  .item:hover {
    border-color: var(--line-strong);
  }

  h2 {
    font-size: var(--text-lg);
  }

  /* The whole card is clickable through the title button. */
  .open {
    all: unset;
    cursor: pointer;
  }

  .open::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: var(--radius);
  }

  .open:focus-visible::after {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .stage {
    font-size: var(--text-sm);
    color: var(--accent);
    font-weight: 550;
  }

  .lock {
    font-size: var(--text-sm);
  }
</style>
