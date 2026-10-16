<!-- Renders a module string with its inline markup (ADR 0002), as DOM nodes — never as HTML. -->
<script lang="ts">
import { type Inline, parseInline, splitParagraphs } from "./markup.ts";

let { text, paragraphs = false }: { text: string; paragraphs?: boolean } =
  $props();
</script>

{#snippet inline(nodes: Inline[])}
  {#each nodes as node, i (i)}
    {#if node.kind === "text"}{node.text}{:else if node.kind === "strong"}<strong>{@render inline(node.children)}</strong
      >{:else if node.kind === "em"}<em>{@render inline(node.children)}</em>{:else}<a
        href={node.href}
        target="_blank"
        rel="noopener noreferrer">{@render inline(node.children)}</a
      >{/if}
  {/each}
{/snippet}

{#if paragraphs}
  {#each splitParagraphs(text) as p, i (i)}
    <p>{@render inline(parseInline(p))}</p>
  {/each}
{:else}
  {@render inline(parseInline(text))}
{/if}
