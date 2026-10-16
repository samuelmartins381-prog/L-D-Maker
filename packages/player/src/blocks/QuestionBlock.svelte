<!--
  Single/multiple choice question. Native radios/checkboxes in a fieldset (robust with screen readers).
  Feedback rules (ADR 0002 addendum): the player gives the verdict; choice explanations are neutral.
  Wrong with attempts left → only the selected choices are explained (the key stays hidden).
  Final (correct or out of attempts) → every choice is explained and the answer key is shown.
-->
<script lang="ts">
import type { Question } from "@ldm/schema";
import { tick } from "svelte";
import { attemptsLeft, isFinal } from "../grading.ts";
import { usePlayer } from "../player.svelte.ts";
import Rich from "../Rich.svelte";

let { block }: { block: Question } = $props();
const p = usePlayer();
let verdictEl: HTMLParagraphElement | undefined = $state();

const answer = $derived(p.answer(block));
const final = $derived(isFinal(block, answer));
const choices = $derived(
  answer.order
    .map((id) => block.choices.find((c) => c.id === id))
    .filter((c) => !!c),
);
const inputType = $derived(block.variant === "single" ? "radio" : "checkbox");
const verdict = $derived(
  answer.correct === true
    ? p.ui("question.correct")
    : answer.correct === false && final
      ? p.ui("question.incorrect.final")
      : answer.correct === false
        ? p.ui("question.incorrect.retry", {
            count: attemptsLeft(block, answer),
          })
        : "",
);

const explained = (id: string) =>
  final || (answer.correct === false && answer.selected.includes(id));

async function onsubmit(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  p.submit(block);
  await tick();
  verdictEl?.focus();
}
</script>

<form class="question" class:final {onsubmit} novalidate>
  {#if block.heading}<h2 class="block-heading">{p.t(block.heading)}</h2>{/if}
  <!-- The legend must be the fieldset's first child to name the group. -->
  <fieldset aria-describedby="{block.id}-instructions">
    <legend class="prompt"><Rich text={p.t(block.prompt)} /></legend>
    <p id="{block.id}-instructions" class="instructions">
      {#if !block.scored}<span class="practice">{p.ui("question.practice")}</span>{/if}
      {p.ui(block.variant === "single" ? "question.instructions.single" : "question.instructions.multiple")}
    </p>

    <ul class="choices">
      {#each choices as choice (choice.id)}
        {@const selected = answer.selected.includes(choice.id)}
        {@const show = explained(choice.id)}
        <li
          class="choice"
          class:selected
          class:expected={final && choice.correct}
          class:wrong={show && selected && !choice.correct}
        >
          <label>
            <input
              type={inputType}
              name={block.id}
              value={choice.id}
              checked={selected}
              disabled={final}
              aria-describedby={show ? `${block.id}-${choice.id}-feedback` : undefined}
              onchange={() => p.select(block, choice.id)}
            />
            <span class="text"><Rich text={p.t(choice.text)} /></span>
            {#if final && choice.correct}
              <span class="badge expected-badge">
                <span aria-hidden="true">✓</span>
                {p.ui("question.choice.expected")}
              </span>
            {:else if show && selected}
              <span class="badge wrong-badge">
                <span aria-hidden="true">✕</span>
                {p.ui("question.choice.notExpected")}
              </span>
            {/if}
          </label>
          {#if show}
            <p class="feedback" id="{block.id}-{choice.id}-feedback">
              <Rich text={p.t(choice.feedback)} />
            </p>
          {/if}
        </li>
      {/each}
    </ul>
  </fieldset>

  <div class="footer">
    <p
      bind:this={verdictEl}
      class="verdict"
      class:ok={answer.correct === true}
      class:ko={answer.correct === false}
      role="status"
      tabindex="-1"
    >
      {verdict}
    </p>
    {#if !final}
      <button type="submit" disabled={answer.selected.length === 0 || answer.correct !== null}>
        {p.ui("question.submit")}
      </button>
    {/if}
  </div>
</form>

<style>
  .question {
    padding: var(--space-6);
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-raised);
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }
  .block-heading {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    font-weight: 650;
    color: var(--color-accent);
  }
  /* Prompts can be long scenarios: body font, not the display serif. */
  .prompt {
    padding: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.45;
  }
  .instructions {
    margin: var(--space-2) 0 var(--space-6);
    font-size: var(--text-sm);
    color: var(--color-ink-muted);
  }
  .practice {
    display: block;
    margin-block-end: var(--space-1);
    font-weight: 600;
    color: var(--color-accent);
  }
  .choices {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .choice {
    border: 1.5px solid var(--color-line);
    border-radius: var(--radius-sm);
    background: var(--color-bg);
    transition:
      border-color var(--duration-fast),
      background-color var(--duration-fast);
  }
  label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    min-block-size: 52px;
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
  }
  .final label {
    cursor: default;
  }
  input {
    flex: none;
    inline-size: 1.25rem;
    block-size: 1.25rem;
    margin: 0;
    accent-color: var(--color-accent);
  }
  .text {
    flex: 1 1 12rem;
  }
  .choice:not(.expected, .wrong):hover {
    border-color: var(--color-ink-muted);
  }
  .final .choice:hover {
    border-color: var(--color-line);
  }
  .choice.selected {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
  }
  .choice.expected {
    border-color: var(--color-success);
    background: var(--color-success-soft);
  }
  .choice.wrong {
    border-color: var(--color-error);
    background: var(--color-error-soft);
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    font-weight: 650;
  }
  .expected-badge {
    color: var(--color-success);
  }
  .wrong-badge {
    color: var(--color-error);
  }
  .feedback {
    margin: 0;
    padding: 0 var(--space-4) var(--space-4);
    padding-inline-start: calc(var(--space-4) + 1.25rem + var(--space-3));
    font-size: var(--text-base);
    color: var(--color-ink);
  }
  .footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    margin-block-start: var(--space-6);
  }
  .verdict {
    margin: 0;
    font-weight: 650;
  }
  .verdict:empty {
    display: none;
  }
  .verdict:focus {
    outline: none;
  }
  .verdict.ok {
    color: var(--color-success);
  }
  .verdict.ko {
    color: var(--color-error);
  }
  button {
    min-block-size: 48px;
    margin-inline-start: auto;
    padding-inline: var(--space-8);
    border: 1px solid var(--color-ink);
    border-radius: 999px;
    background: var(--color-ink);
    color: var(--color-surface);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background-color var(--duration-fast);
  }
  button:hover:not(:disabled) {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
