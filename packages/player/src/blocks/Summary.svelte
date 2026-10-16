<script lang="ts">
import type { Block } from "@ldm/schema";
import { usePlayer } from "../player.svelte.ts";
import Rich from "../Rich.svelte";

let { block }: { block: Extract<Block, { type: "summary" }> } = $props();
const p = usePlayer();
</script>

<div class="summary">
  {#if block.heading}<h2>{p.t(block.heading)}</h2>{/if}
  <ul>
    {#each block.points as key (key)}
      <li><Rich text={p.t(key)} /></li>
    {/each}
  </ul>
</div>

<style>
  .summary {
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    box-shadow: var(--shadow-raised);
  }
  h2 {
    font-family: var(--font-body);
    font-size: var(--text-base);
    font-weight: 650;
    letter-spacing: 0.01em;
    margin: 0 0 var(--space-4);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-3);
  }
  li {
    position: relative;
    padding-inline-start: var(--space-6);
  }
  li::before {
    content: "";
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: 0.6em;
    inline-size: 0.5rem;
    block-size: 0.5rem;
    border-radius: 50%;
    background: var(--color-accent);
  }
</style>
