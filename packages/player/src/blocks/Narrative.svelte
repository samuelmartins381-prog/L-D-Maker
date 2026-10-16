<script lang="ts">
import type { Block } from "@ldm/schema";
import { usePlayer } from "../player.svelte.ts";
import Rich from "../Rich.svelte";

let { block }: { block: Extract<Block, { type: "narrative" }> } = $props();
const p = usePlayer();
</script>

<div class="narrative">
  {#if block.heading}<h2>{p.t(block.heading)}</h2>{/if}
  <div class="body"><Rich text={p.t(block.body)} paragraphs /></div>
</div>

<style>
  h2 {
    font-family: var(--font-display);
    font-size: var(--text-xl);
    font-weight: 500;
    line-height: var(--leading-tight);
    margin: 0 0 var(--space-4);
  }
  .body :global(p) {
    margin: 0 0 var(--space-4);
    font-size: var(--text-lg);
    color: var(--color-ink);
  }
  .body :global(p:last-child) {
    margin-block-end: 0;
  }
</style>
