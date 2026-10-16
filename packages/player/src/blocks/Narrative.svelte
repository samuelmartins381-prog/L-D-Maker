<script lang="ts">
import type { Block } from "@ldm/schema";
import ImageZoom from "../ImageZoom.svelte";
import { usePlayer } from "../player.svelte.ts";
import Rich from "../Rich.svelte";

let { block }: { block: Extract<Block, { type: "narrative" }> } = $props();
const p = usePlayer();
const image = $derived(block.media?.kind === "image" ? block.media : undefined);
</script>

<div class="narrative layout-{image ? block.layout : 'text'}">
  {#if image}
    <figure class="media">
      <img src={image.src} alt={image.decorative || !image.alt ? "" : p.t(image.alt)} loading="lazy" decoding="async" />
      {#if image.zoom && image.alt}
        <ImageZoom id="{block.id}-zoom" src={image.src} zoomSrc={image.zoomSrc} alt={p.t(image.alt)} />
      {/if}
    </figure>
  {/if}
  <div class="content">
    {#if block.heading}<h2>{p.t(block.heading)}</h2>{/if}
    <div class="body"><Rich text={p.t(block.body)} paragraphs /></div>
  </div>
</div>

<style>
  .narrative {
    display: grid;
    gap: var(--space-6);
  }
  @media (min-width: 720px) {
    .layout-media-start,
    .layout-media-end {
      grid-template-columns: 1fr 1fr;
      align-items: center;
    }
    .layout-media-end .media {
      order: 2;
    }
  }
  figure {
    position: relative;
    margin: 0;
  }
  img {
    display: block;
    inline-size: 100%;
    block-size: auto;
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
  }
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
