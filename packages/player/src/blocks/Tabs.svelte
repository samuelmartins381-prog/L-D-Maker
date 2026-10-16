<!-- WAI-ARIA APG tabs with automatic activation, roving tabindex, arrows following the reading direction. -->
<script lang="ts">
import type { Block } from "@ldm/schema";
import { tick } from "svelte";
import { usePlayer } from "../player.svelte.ts";
import Rich from "../Rich.svelte";

let { block }: { block: Extract<Block, { type: "tabs" }> } = $props();
const p = usePlayer();
let selected = $state(0);
const tabs: HTMLButtonElement[] = $state([]);

async function select(index: number): Promise<void> {
  const count = block.items.length;
  selected = (index + count) % count;
  await tick();
  tabs[selected]?.focus();
}

function onkeydown(e: KeyboardEvent): void {
  const forward = p.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
  const backward = p.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
  const target =
    e.key === forward
      ? selected + 1
      : e.key === backward
        ? selected - 1
        : e.key === "Home"
          ? 0
          : e.key === "End"
            ? block.items.length - 1
            : null;
  if (target === null) return;
  e.preventDefault();
  select(target);
}
</script>

<div class="tabs">
  {#if block.heading}<h2 id="{block.id}-heading" class="block-heading">{p.t(block.heading)}</h2>{/if}
  {#if block.intro}<p class="intro"><Rich text={p.t(block.intro)} /></p>{/if}
  <div
    class="tablist"
    role="tablist"
    tabindex="-1"
    aria-labelledby={block.heading ? `${block.id}-heading` : undefined}
    {onkeydown}
  >
    {#each block.items as item, i (item.id)}
      <button
        bind:this={tabs[i]}
        id="{block.id}-{item.id}-tab"
        role="tab"
        aria-selected={i === selected}
        aria-controls="{block.id}-{item.id}-panel"
        tabindex={i === selected ? 0 : -1}
        onclick={() => (selected = i)}
      >
        {p.t(item.title)}
      </button>
    {/each}
  </div>
  {#each block.items as item, i (item.id)}
    <div
      class="panel"
      id="{block.id}-{item.id}-panel"
      role="tabpanel"
      aria-labelledby="{block.id}-{item.id}-tab"
      tabindex="0"
      hidden={i !== selected}
    >
      <Rich text={p.t(item.body)} paragraphs />
    </div>
  {/each}
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
  .tablist {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-1);
    background: var(--color-accent-soft);
    border-radius: var(--radius-md);
  }
  .tablist:focus {
    outline: none;
  }
  [role="tab"] {
    flex: 1 1 auto;
    min-block-size: 44px;
    padding: var(--space-2) var(--space-4);
    border: 0;
    border-radius: calc(var(--radius-md) - var(--space-1));
    background: transparent;
    color: var(--color-ink);
    font: inherit;
    font-weight: 550;
    cursor: pointer;
    transition:
      background-color var(--duration-fast),
      box-shadow var(--duration-fast);
  }
  [role="tab"][aria-selected="true"] {
    background: var(--color-surface);
    box-shadow: var(--shadow-raised);
  }
  .panel {
    margin-block-start: var(--space-4);
    padding: var(--space-6);
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    font-size: var(--text-lg);
  }
  .panel :global(p) {
    margin: 0 0 var(--space-3);
  }
  .panel :global(p:last-child) {
    margin-block-end: 0;
  }
</style>
