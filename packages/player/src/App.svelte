<script lang="ts">
import { tick } from "svelte";
import { fly } from "svelte/transition";
import BlockView from "./blocks/BlockView.svelte";
import Menu from "./Menu.svelte";
import { usePlayer } from "./player.svelte.ts";
import { useSession } from "./tracking/session.svelte.ts";

const p = usePlayer();
const session = useSession();
const module = p.content.module;
let endHeading: HTMLHeadingElement | undefined = $state();
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

/** Finish button: closes the LMS session and shows the end panel. */
async function finish(): Promise<void> {
  session.finish();
  await tick();
  endHeading?.focus();
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
          <select
            value={p.locale}
            onchange={async (e) => {
              const select = e.currentTarget;
              await p.setLocale(select.value);
              select.value = p.locale; // a failed load keeps the previous language
            }}
          >
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
  {#if p.finished}
    {@const scorePercent = Math.round(p.score.scaled * 100)}
    <article class="screen end">
      <h1 bind:this={endHeading} tabindex="-1">{p.ui("finish.title")}</h1>
      <div class="end-body">
        {#if p.allViewed}<p>{p.ui("finish.complete")}</p>{/if}
        {#if p.score.max > 0 && p.score.complete}
          <p class="end-score">{p.ui("finish.score", { score: scorePercent })}</p>
          <p>{p.ui(p.score.passed ? "finish.passed" : "finish.failed", { threshold: p.passingScore })}</p>
        {/if}
        {#if !p.allViewed || !p.score.complete}<p>{p.ui("finish.saved")}</p>{/if}
        <p>{p.ui("finish.close")}</p>
      </div>
    </article>
  {:else}
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
  {/if}
</main>

{#if !p.finished}
<footer class="pager">
  <div class="pager-inner">
    <button class="secondary" disabled={p.isFirst} onclick={() => go(-1)}>
      <span class="arrow" aria-hidden="true">←</span>
      {p.ui("nav.previous")}
    </button>
    {#if p.isLast}
      <button class="primary" onclick={finish}>{p.ui("nav.finish")}</button>
    {:else}
      <button class="primary" onclick={() => go(1)}>
        {p.ui("nav.next")}
        <span class="arrow" aria-hidden="true">→</span>
      </button>
    {/if}
  </div>
</footer>
{/if}

<div class="visually-hidden" aria-live="polite">{announcement}</div>

<style>
  /* Skip link: off-screen until focused, then in the flow above the top bar (GOV.UK pattern), so it
     pushes the header down instead of covering its controls (long labels, e.g. Russian, hid the
     language menu: WCAG 2.5.8 / 2.4.11). */
  .skip {
    position: absolute;
    inset-block-start: -100px;
    padding: var(--space-3) var(--space-4);
    background: var(--color-ink);
    color: var(--color-surface);
    font-weight: 600;
  }
  .skip:focus {
    position: static;
    display: block;
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
    letter-spacing: var(--tracking-display);
    font-variation-settings: "opsz" 96;
  }
  h1:focus {
    outline: none;
  }
  .end-body {
    display: grid;
    gap: var(--space-3);
    font-size: var(--text-lg);
  }
  .end-body p {
    margin: 0;
  }
  .end-score {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    color: var(--color-accent);
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
