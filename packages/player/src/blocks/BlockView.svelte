<script lang="ts">
import type { Block } from "@ldm/schema";
import Accordion from "./Accordion.svelte";
import Narrative from "./Narrative.svelte";
import QuestionBlock from "./QuestionBlock.svelte";
import Summary from "./Summary.svelte";
import Tabs from "./Tabs.svelte";

let { block }: { block: Block } = $props();
</script>

{#if block.type === "narrative"}
  <Narrative {block} />
{:else if block.type === "accordion"}
  <Accordion {block} />
{:else if block.type === "tabs"}
  <Tabs {block} />
{:else if block.type === "question"}
  <QuestionBlock {block} />
{:else if block.type === "summary"}
  <Summary {block} />
{/if}
