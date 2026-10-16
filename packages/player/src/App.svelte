<script lang="ts">
import { tick } from "svelte";
import { fly } from "svelte/transition";
import BlockView from "./blocks/BlockView.svelte";
import Menu from "./Menu.svelte";
import { usePlayer } from "./player.svelte.ts";

const p = usePlayer();
const module = p.content.module;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let menuOpen = $state(false);
let heading: HTMLHeadingElement | undefined = $state();
let announcement = $state("");
let direction = $state(1);

const languageName = (locale: string) =>
  new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;

// Keep <html lang/dir> and the document title in sync with the chosen locale.
$effect(() => {
  document.documentElement.lang = p.locale;
  document.documentElement.dir = p.dir;
  document.title = p.t(module.meta.title);
});

/** After a screen change, move focus to the new heading and announce the position. */
async function afterNavigate(): Promise<void> {
  announcement = p.ui("progress.label", {
    current: p.index + 1,
    total: p.screens.length,
  });
  await tick();
  heading?.focus();
}

function go(delta: number): void {
  direction = delta;
  p.goTo(p.index + delta);
  afterNavigate();
}

const offset = $derived(
  (reducedMotion ? 0 : 24) * direction * (p.dir === "rtl" ? -1 : 1),
);
</script>

<a class="skip" href="#ldm-main">{p.ui("skip.content")}</a>

<header class="topbar">
  <div class="bar">
    <p class="module-title">{p.t(module.meta.title)}</p>
    <div class="tools">
      {#if module.locales.length > 1}
        <label class="locale">
          <span class="visually-hidden">{p.ui("locale.label")}</span>
          <select bind:value={p.locale}>
            {#each module.locales as locale (locale)}
              <option value={locale} lang={locale}>{languageName(locale)}</option>
            {/each}
          </select>
        </label>
      {/if}
      <Menu bind:open={menuOpen} onnavigate={afterNavigate} />
    </div>
  </div>
  <div class="progress" aria-hidden="true">
    <div class="progress-fill" style:inline-size="{p.percent}%"></div>
  </div>
</header>

<main id="ldm-main">
  {#key p.index}
    <article class="screen" in:fly={{ x: offset, duration: reducedMotion ? 0 : 320, opacity: 0 }}>
      <p class="eyebrow">
        <span>{p.t(p.current.section.title)}</span>
        <span class="position">{p.ui("progress.label", { current: p.index + 1, total: p.screens.length })}</span>
      </p>
      <h1 bind:this={heading} tabindex="-1">{p.t(p.current.screen.title)}</h1>
      <div class="blocks">
        {#each p.current.screen.blocks as block (block.id)}
          <div class="block" data-block-id={block.id}>
            <BlockView {block} />
          </div>
        {/each}
      </div>
    </article>
  {/key}
</main>

<footer class="pager">
  <div class="pager-inner">
    <button class="secondary" disabled={p.isFirst} onclick={() => go(-1)}>
      <span class="arrow" aria-hidden="true">←</span>
      {p.ui("nav.previous")}
    </button>
    <button class="primary" disabled={p.isLast} onclick={() => go(1)}>
      {p.ui("nav.next")}
      <span class="arrow" aria-hidden="true">→</span>
    </button>
  </div>
</footer>

<div class="visually-hidden" aria-live="polite">{announcement}</div>

<style>
  .skip {
    position: absolute;
    inset-inline-start: var(--space-4);
    inset-block-start: -100px;
    z-index: 20;
    padding: var(--space-2) var(--space-4);
    background: var(--color-ink);
    color: var(--color-surface);
    border-radius: var(--radius-sm);
  }
  .skip:focus {
    inset-block-start: var(--space-4);
  }

  .topbar {
    position: sticky;
    inset-block-start: 0;
    z-index: 5;
    background: color-mix(in srgb, var(--color-bg) 88%, transparent);
    backdrop-filter: blur(8px);
    border-block-end: 1px solid var(--color-line);
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    max-inline-size: calc(var(--measure) + 2 * var(--space-6));
    margin-inline: auto;
    padding: var(--space-3) var(--space-4);
  }
  .module-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 550;
    color: var(--color-ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: none;
  }
  select {
    min-block-size: 44px;
    padding-inline: var(--space-3);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--text-sm);
  }
  .progress {
    block-size: 3px;
    background: var(--color-line);
  }
  .progress-fill {
    block-size: 100%;
    background: var(--color-accent);
    transition: inline-size var(--duration-base) var(--ease-out);
  }

  main {
    max-inline-size: calc(var(--measure) + 2 * var(--space-6));
    margin-inline: auto;
    padding: var(--space-12) var(--space-4) var(--space-16);
  }
  @media (min-width: 640px) {
    main,
    .bar {
      padding-inline: var(--space-6);
    }
  }
  .eyebrow {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-2);
    margin: 0 0 var(--space-3);
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-accent);
  }
  .position {
    color: var(--color-ink-muted);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  h1 {
    margin: 0 0 var(--space-8);
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 450;
    line-height: var(--leading-tight);
    letter-spacing: -0.015em;
    font-variation-settings: "opsz" 96;
  }
  h1:focus {
    outline: none;
  }
  .blocks {
    display: grid;
    gap: var(--space-12);
  }

  .pager {
    position: sticky;
    inset-block-end: 0;
    background: color-mix(in srgb, var(--color-bg) 92%, transparent);
    backdrop-filter: blur(8px);
    border-block-start: 1px solid var(--color-line);
  }
  .pager-inner {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    max-inline-size: calc(var(--measure) + 2 * var(--space-6));
    margin-inline: auto;
    padding: var(--space-3) var(--space-4);
  }
  .pager button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: 48px;
    padding-inline: var(--space-6);
    border-radius: 999px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color var(--duration-fast),
      transform var(--duration-fast) var(--ease-out);
  }
  .pager button:active:not(:disabled) {
    transform: scale(0.98);
  }
  .pager button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .primary {
    border: 1px solid var(--color-ink);
    background: var(--color-ink);
    color: var(--color-surface);
  }
  .primary:hover:not(:disabled) {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
  .secondary {
    border: 1px solid var(--color-line);
    background: var(--color-surface);
    color: var(--color-ink);
  }
  /* Arrows point the reading direction. */
  :global([dir="rtl"]) .arrow {
    display: inline-block;
    transform: scaleX(-1);
  }
</style>
