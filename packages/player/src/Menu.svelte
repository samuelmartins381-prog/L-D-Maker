<!-- Table of contents: a disclosure panel listing sections and screens. -->
<script lang="ts">
import { usePlayer } from "./player.svelte.ts";

let {
  open = $bindable(false),
  onnavigate,
}: { open?: boolean; onnavigate: () => void } = $props();
const p = usePlayer();
let toggle: HTMLButtonElement;

function close(): void {
  open = false;
  toggle.focus();
}

function onkeydown(e: KeyboardEvent): void {
  if (e.key === "Escape" && open) close();
}
</script>

<svelte:window {onkeydown} />

<div class="menu">
  <button
    bind:this={toggle}
    class="toggle"
    aria-expanded={open}
    aria-controls="ldm-toc"
    onclick={() => (open = !open)}
  >
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
      <path d="M3 5h14M3 10h14M3 15h9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none" />
    </svg>
    <span>{open ? p.ui("nav.menu.close") : p.ui("nav.menu")}</span>
  </button>

  <nav id="ldm-toc" class="panel" aria-label={p.ui("nav.label")} hidden={!open}>
    <ol class="sections">
      {#each p.content.module.sections as section (section.id)}
        <li>
          <h2>{p.t(section.title)}</h2>
          <ol>
            {#each section.screens as screen (screen.id)}
              {@const index = p.screens.findIndex((s) => s.screen.id === screen.id)}
              {@const isCurrent = index === p.index}
              <li>
                <button
                  aria-current={isCurrent ? "step" : undefined}
                  onclick={() => {
                    p.goTo(index);
                    open = false;
                    onnavigate();
                  }}
                >
                  <span class="mark" class:visited={p.visited.has(screen.id)} aria-hidden="true"></span>
                  <span>{p.t(screen.title)}</span>
                  {#if isCurrent}
                    <span class="visually-hidden">({p.ui("nav.current")})</span>
                  {:else if p.visited.has(screen.id)}
                    <span class="visually-hidden">({p.ui("nav.visited")})</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ol>
        </li>
      {/each}
    </ol>
  </nav>
</div>

<style>
  .menu {
    position: relative;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-block-size: 44px;
    padding-inline: var(--space-3);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 550;
    cursor: pointer;
  }
  .toggle:hover {
    border-color: var(--color-ink-muted);
  }
  .panel {
    position: absolute;
    inset-inline-end: 0;
    inset-block-start: calc(100% + var(--space-2));
    z-index: 10;
    inline-size: min(22rem, calc(100vw - 2 * var(--space-4)));
    max-block-size: min(70vh, 36rem);
    overflow-y: auto;
    padding: var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-raised);
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .sections > li + li {
    margin-block-start: var(--space-4);
  }
  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 650;
    color: var(--color-ink-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  :global(:lang(ar)) h2 {
    text-transform: none;
    letter-spacing: 0;
  }
  li button {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    inline-size: 100%;
    min-block-size: 44px;
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-ink);
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  li button:hover {
    background: var(--color-bg);
  }
  li button[aria-current="step"] {
    background: var(--color-accent-soft);
    font-weight: 600;
  }
  .mark {
    flex: none;
    inline-size: 0.625rem;
    block-size: 0.625rem;
    border-radius: 50%;
    border: 1.5px solid var(--color-ink-muted);
  }
  .mark.visited {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
</style>
