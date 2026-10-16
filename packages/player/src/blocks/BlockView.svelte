<script lang="ts">
import type { Block } from "@ldm/schema";
import Narrative from "./Narrative.svelte";
import Pending from "./Pending.svelte";
import Summary from "./Summary.svelte";

let { block }: { block: Block } = $props();
</script>

{#if block.type === "narrative"}
  <Narrative {block} />
{:else if block.type === "summary"}
  <Summary {block} />
{:else}
  <Pending {block} />
{/if}
