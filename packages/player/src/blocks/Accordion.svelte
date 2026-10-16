<!-- WAI-ARIA APG accordion: heading > button[aria-expanded] controlling a panel. Several panels may be open. -->
<script lang="ts">
import type { Block } from "@ldm/schema";
import { usePlayer } from "../player.svelte.ts";
import Rich from "../Rich.svelte";

let { block }: { block: Extract<Block, { type: "accordion" }> } = $props();
const p = usePlayer();
let open = $state<Record<string, boolean>>({});
// Item headings sit one level below the block heading (h1 is the screen title).
const itemTag = $derived(block.heading ? "h3" : "h2");
</script>

<div class="accordion">
  {#if block.heading}<h2 class="block-heading">{p.t(block.heading)}</h2>{/if}
  {#if block.intro}<p class="intro"><Rich text={p.t(block.intro)} /></p>{/if}
  <div class="items">
    {#each block.items as item, i (item.id)}
      {@const id = `${block.id}-${item.id}`}
      {@const isOpen = !!open[item.id]}
      <div class="item" class:open={isOpen}>
        <svelte:element this={itemTag} class="item-heading">
          <button
            id="{id}-button"
            aria-expanded={isOpen}
            aria-controls="{id}-panel"
            onclick={() => (open[item.id] = !isOpen)}
          >
            <span class="index" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <span class="title">{p.t(item.title)}</span>
            <span class="chevron" aria-hidden="true"></span>
          </button>
        </svelte:element>
        <div class="panel" id="{id}-panel" inert={!isOpen}>
          <div class="panel-clip">
            <div class="body"><Rich text={p.t(item.body)} paragraphs /></div>
          </div>
        </div>
      </div>
    {/each}
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
  .items {
    border-block-start: 1px solid var(--color-line);
  }
  .item {
    border-block-end: 1px solid var(--color-line);
  }
  .item-heading {
    margin: 0;
    font: inherit;
  }
  button {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    inline-size: 100%;
    min-block-size: 56px;
    padding: var(--space-4) var(--space-2);
    border: 0;
    background: none;
    color: var(--color-ink);
    font: inherit;
    font-size: var(--text-lg);
    font-weight: 550;
    line-height: 1.35;
    text-align: start;
    cursor: pointer;
    transition: color var(--duration-fast);
  }
  button:hover .title {
    color: var(--color-accent);
  }
  .index {
    flex: none;
    font-family: var(--font-display);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    color: var(--color-accent);
  }
  .title {
    flex: 1;
  }
  .chevron {
    flex: none;
    inline-size: 0.6rem;
    block-size: 0.6rem;
    margin-inline-end: var(--space-1);
    border-inline-end: 2px solid currentColor;
    border-block-end: 2px solid currentColor;
    transform: rotate(45deg);
    transition: transform var(--duration-base) var(--ease-out);
  }
  .open .chevron {
    transform: rotate(-135deg);
  }
  /* Height animation without measuring: grid rows 0fr → 1fr. */
  .panel {
    display: grid;
    grid-template-rows: 0fr;
    visibility: hidden;
    transition:
      grid-template-rows var(--duration-base) var(--ease-out),
      visibility 0s linear var(--duration-base);
  }
  .open .panel {
    grid-template-rows: 1fr;
    visibility: visible;
    transition:
      grid-template-rows var(--duration-base) var(--ease-out),
      visibility 0s;
  }
  .panel-clip {
    overflow: hidden;
  }
  .body {
    padding: 0 var(--space-2) var(--space-6);
    padding-inline-start: calc(var(--space-2) + 2.25rem);
    color: var(--color-ink);
  }
  .body :global(p) {
    margin: 0 0 var(--space-3);
  }
  .body :global(p:last-child) {
    margin-block-end: 0;
  }
</style>
