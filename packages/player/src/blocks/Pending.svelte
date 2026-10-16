<!-- Placeholder for block types implemented in J1 step 4. -->
<script lang="ts">
import type { Block } from "@ldm/schema";
import { usePlayer } from "../player.svelte.ts";

let { block }: { block: Block } = $props();
const p = usePlayer();
</script>

<div class="pending" data-block-type={block.type}>
  {#if block.heading}<h2>{p.t(block.heading)}</h2>{/if}
  <p>{p.ui("block.pending")}</p>
</div>

<style>
  .pending {
    border: 1px dashed var(--color-line);
    border-radius: var(--radius-md);
    padding: var(--space-6);
    color: var(--color-ink-muted);
  }
  h2 {
    font-size: var(--text-lg);
    margin: 0 0 var(--space-2);
    color: var(--color-ink);
  }
  p {
    margin: 0;
  }
</style>
