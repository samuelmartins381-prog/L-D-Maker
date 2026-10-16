<!--
  Image with numbered markers (ADR 0008). Each marker is a real button, in reading order; it shows its
  explanation in one panel under the image (a disclosure: aria-expanded + aria-controls), announced by a
  polite live region. No tooltip over the image: unreadable on a phone and it would hide the picture.
-->
<script lang="ts">
import type { Block } from "@ldm/schema";
import type { SvelteSet } from "svelte/reactivity";
import { usePlayer } from "../player.svelte.ts";
import Rich from "../Rich.svelte";

let { block }: { block: Extract<Block, { type: "hotspots" }> } = $props();
const p = usePlayer();
// Created by the Player for every hotspots block (state is never created during rendering).
const explored = $derived(p.explored.get(block.id) as SvelteSet<string>);
let active = $state<string | null>(null);
const current = $derived(block.items.findIndex((i) => i.id === active));
const detailId = $derived(`${block.id}-detail`);
// Item headings sit one level below the block heading (h1 is the screen title).
const itemTag = $derived(block.heading ? "h3" : "h2");

function toggle(id: string): void {
  active = active === id ? null : id;
  explored.add(id);
}
</script>

<div class="hotspots">
  {#if block.heading}<h2 class="block-heading">{p.t(block.heading)}</h2>{/if}
  {#if block.intro}<p class="intro"><Rich text={p.t(block.intro)} /></p>{/if}
  <figure>
    <div class="stage">
      <img src={block.image.src} alt={p.t(block.image.alt)} decoding="async" />
      {#each block.items as item, i (item.id)}
        <button
          class="marker"
          class:active={active === item.id}
          class:explored={explored.has(item.id)}
          aria-expanded={active === item.id}
          aria-controls={detailId}
          style:inset-inline-start="{p.dir === 'rtl' ? 100 - item.x : item.x}%"
          style:inset-block-start="{item.y}%"
          onclick={() => toggle(item.id)}
        >
          <span aria-hidden="true">{i + 1}</span>
          <span class="visually-hidden">{p.t(item.title)}</span>
        </button>
      {/each}
    </div>
    <figcaption class="progress">
      {p.ui("hotspots.progress", { explored: explored.size, total: block.items.length })}
    </figcaption>
  </figure>
  <div class="detail" class:empty={current < 0} id={detailId} aria-live="polite">
    {#if current >= 0}
      {@const item = block.items[current]}
      {#if item}
        <svelte:element this={itemTag} class="detail-title">
          <span class="index" aria-hidden="true">{current + 1}</span>
          {p.t(item.title)}
        </svelte:element>
        <div class="body"><Rich text={p.t(item.body)} paragraphs /></div>
      {/if}
    {:else}
      <p class="hint">{p.ui("hotspots.instructions")}</p>
    {/if}
  </div>
</div>

<style>
  .block-heading {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 500;
    line-height: var(--leading-tight);
    margin: 0 0 var(--space-3);
  }
  .intro {
    margin: 0 0 var(--space-6);
    font-size: var(--text-lg);
    color: var(--color-ink-muted);
  }
  figure {
    margin: 0;
  }
  .stage {
    position: relative;
  }
  img {
    display: block;
    inline-size: 100%;
    block-size: auto;
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
  }
  /* Marker centred on its point: half its size back on both axes (logical, so RTL works too).
     Ink disc + light ring + shadow: stays visible on any image (WCAG 1.4.11, 3:1). */
  .marker {
    --size: 2.25rem;
    position: absolute;
    display: grid;
    place-items: center;
    inline-size: var(--size);
    block-size: var(--size);
    margin-inline-start: calc(var(--size) / -2);
    margin-block-start: calc(var(--size) / -2);
    padding: 0;
    border: 2px solid var(--color-surface);
    border-radius: 50%;
    background: var(--color-ink);
    color: var(--color-surface);
    box-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition:
      background-color var(--duration-fast),
      transform var(--duration-fast) var(--ease-out);
  }
  .marker:hover {
    transform: scale(1.08);
  }
  .marker.explored {
    background: var(--color-ink-muted);
  }
  .marker.active {
    background: var(--color-accent);
    transform: scale(1.12);
  }
  @media (max-width: 480px) {
    .marker {
      --size: 1.875rem;
    }
  }
  .progress {
    margin-block-start: var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
    font-variant-numeric: tabular-nums;
  }
  .detail {
    margin-block-start: var(--space-4);
    padding: var(--space-4) var(--space-6);
    border-inline-start: 3px solid var(--color-accent);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
  }
  .detail.empty {
    border-inline-start-color: var(--color-line);
  }
  .detail-title {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin: 0 0 var(--space-2);
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.35;
  }
  .index {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
  }
  .hint {
    margin: 0;
    color: var(--color-ink-muted);
  }
  .body :global(p) {
    margin: 0 0 var(--space-3);
  }
  .body :global(p:last-child) {
    margin-block-end: 0;
  }
</style>
