<!--
  Sequence question body (ADR 0011): put the steps in order. Each step has Move up / Move down buttons
  (keyboard, touch and pointer alike; no drag and drop required, WCAG 2.5.7), named after the step.
  A move is announced and focus follows the moved step. Final: the right order, with where the
  learner had placed each step and its explanation.
-->
<script lang="ts">
import type { Question } from "@ldm/schema";
import { type Inline, parseInline } from "@ldm/schema/markup";
import { tick } from "svelte";
import { flip } from "svelte/animate";
import type { AnswerState } from "../grading.ts";
import { usePlayer } from "../player.svelte.ts";
import Rich from "../Rich.svelte";

let {
  block,
  answer,
  final,
}: { block: Question; answer: AnswerState; final: boolean } = $props();
const p = usePlayer();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let list: HTMLOListElement | undefined = $state();
let announcement = $state("");

const byId = (id: string) => block.choices.find((c) => c.id === id);
/** The learner's current arrangement, as choices. */
const steps = $derived(
  answer.selected.map(byId).filter((c) => c !== undefined),
);
/** Step text without markup, for button names and announcements. */
const plain = (key: string) => {
  const text = (nodes: Inline[]): string =>
    nodes.map((n) => (n.kind === "text" ? n.text : text(n.children))).join("");
  return text(parseInline(p.t(key)));
};

async function moveStep(id: string, delta: -1 | 1): Promise<void> {
  const choice = byId(id);
  if (!choice) return;
  p.move(block, id, delta);
  await tick();
  const position = answer.selected.indexOf(id) + 1;
  announcement = p.ui("sequence.moved", {
    step: plain(choice.text),
    position,
    total: answer.selected.length,
  });
  // Keep focus on the moved step: the same button, or the other one once it reaches an end.
  const own = list?.querySelector<HTMLButtonElement>(
    `[data-id="${id}"][data-move="${delta < 0 ? "up" : "down"}"]`,
  );
  const other = list?.querySelector<HTMLButtonElement>(
    `[data-id="${id}"][data-move="${delta < 0 ? "down" : "up"}"]`,
  );
  (own && !own.disabled ? own : other)?.focus();
}
</script>

{#if !final}
  <ol class="steps" bind:this={list}>
    {#each steps as choice, i (choice.id)}
        <li class="step" animate:flip={{ duration: reducedMotion ? 0 : 200 }}>
          <span class="pos" aria-hidden="true">{i + 1}</span>
          <span class="text"><Rich text={p.t(choice.text)} /></span>
          <span class="moves">
            <button
              type="button"
              data-id={choice.id}
              data-move="up"
              disabled={i === 0}
              onclick={() => moveStep(choice.id, -1)}
            >
              <span aria-hidden="true">↑</span>
              <span class="visually-hidden">{p.ui("sequence.up", { step: plain(choice.text) })}</span>
            </button>
            <button
              type="button"
              data-id={choice.id}
              data-move="down"
              disabled={i === steps.length - 1}
              onclick={() => moveStep(choice.id, 1)}
            >
              <span aria-hidden="true">↓</span>
              <span class="visually-hidden">{p.ui("sequence.down", { step: plain(choice.text) })}</span>
            </button>
          </span>
        </li>
    {/each}
  </ol>
  <p class="visually-hidden" aria-live="polite">{announcement}</p>
{:else}
  <ol class="steps final">
    {#each block.choices as choice, i (choice.id)}
      {@const placed = answer.selected.indexOf(choice.id)}
      <li class="step" class:expected={placed === i} class:wrong={placed !== i}>
        <span class="pos">{i + 1}</span>
        <span class="text"><Rich text={p.t(choice.text)} /></span>
        <span class="badge" class:ok={placed === i}>
          <span aria-hidden="true">{placed === i ? "✓" : "✕"}</span>
          {placed === i
            ? p.ui("sequence.placed")
            : p.ui("sequence.yourPosition", { position: placed + 1 })}
        </span>
        <p class="feedback"><Rich text={p.t(choice.feedback)} /></p>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .steps {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .step {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    min-block-size: 56px;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
    border: 1.5px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
  }
  .final .step {
    padding: var(--space-3) var(--space-4);
  }
  .step.expected {
    border-color: var(--color-success);
    background: var(--color-success-soft);
  }
  .step.wrong {
    border-color: var(--color-error);
    background: var(--color-error-soft);
  }
  .pos {
    display: grid;
    place-items: center;
    flex: none;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border-radius: 50%;
    background: var(--color-ink);
    color: var(--color-surface);
    font-size: var(--text-sm);
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .text {
    flex: 1 1 12rem;
    font-weight: 550;
  }
  .moves {
    display: flex;
    gap: var(--space-1);
    margin-inline-start: auto;
  }
  .moves button {
    display: grid;
    place-items: center;
    inline-size: 44px;
    block-size: 44px;
    padding: 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-ink);
    font: inherit;
    font-size: var(--text-lg);
    cursor: pointer;
  }
  .moves button:hover:not(:disabled) {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
  .moves button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    font-weight: 650;
    color: var(--color-error);
  }
  .badge.ok {
    color: var(--color-success);
  }
  .feedback {
    flex-basis: 100%;
    margin: 0;
    padding-inline-start: calc(1.75rem + var(--space-3));
    color: var(--color-ink);
  }
</style>
