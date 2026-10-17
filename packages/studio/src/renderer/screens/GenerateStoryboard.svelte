<script lang="ts">
import { onDestroy } from "svelte";
import type {
  GenerationEstimate,
  GenerationProgress,
  GenerationSummary,
  ProjectDetail,
} from "../../shared/api.ts";
import { locale, t } from "../i18n.svelte.ts";
import { app, unwrap } from "../store.svelte.ts";

const { project, again = false }: { project: ProjectDetail; again?: boolean } =
  $props();

let step = $state<"idle" | "estimating" | "confirm" | "running" | "done">(
  "idle",
);
let estimate = $state<GenerationEstimate | null>(null);
let progress = $state<GenerationProgress | null>(null);
let summary = $state<GenerationSummary | null>(null);

const usd = (n: number) =>
  new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);

const unsubscribe = window.ldm.onGenerationProgress((p) => {
  progress = p;
});
onDestroy(unsubscribe);

async function prepare() {
  step = "estimating";
  estimate = unwrap(await window.ldm.estimateStoryboard(project.dir));
  step = estimate ? "confirm" : "idle";
}

async function run() {
  step = "running";
  progress = null;
  summary = unwrap(await window.ldm.generateStoryboard(project.dir));
  step = summary ? "done" : "idle";
  // The project changed on disk: read it again.
  const updated = unwrap(await window.ldm.openProject(project.dir));
  if (updated) app.project = updated;
}

const status = $derived(
  step === "estimating"
    ? t("generate.estimating")
    : step === "running"
      ? progress?.stage === "writing"
        ? t("generate.writing", {
            round: progress.round,
            chars: progress.chars,
          })
        : progress?.stage === "checking"
          ? t("generate.checking", { round: progress.round })
          : t("generate.starting")
      : "",
);
</script>

<div class="generate">
  {#if !app.settings?.canGenerate}
    <p class="muted">{t("generate.noKey")}</p>
    <p>
      <button type="button" class="btn" onclick={() => (app.screen = "settings")}
        >{t("nav.settings")}</button
      >
    </p>
  {:else if step === "idle" || step === "estimating"}
    <p>
      <button
        type="button"
        class="btn {again ? '' : 'btn-primary'}"
        onclick={prepare}
        disabled={step === "estimating" || !project.editable}
        >{again ? t("generate.again") : t("generate.start")}</button
      >
    </p>
  {:else if step === "confirm" && estimate}
    <div class="confirm">
      <p>
        {t("generate.estimate", {
          tokens: estimate.inputTokens,
          low: usd(estimate.lowUsd),
          high: usd(estimate.highUsd),
        })}
      </p>
      <p class="help">{t("generate.privacy")}</p>
      {#if again}<p class="help">{t("generate.replaces")}</p>{/if}
      <div class="actions">
        <button type="button" class="btn btn-primary" onclick={run}
          >{t("generate.confirm")}</button
        >
        <button type="button" class="btn" onclick={() => (step = "idle")}
          >{t("common.cancel")}</button
        >
      </div>
    </div>
  {:else if step === "done" && summary}
    <p>
      {t("generate.done", {
        rounds: summary.rounds,
        errors: summary.errors,
        warnings: summary.warnings,
        cost: usd(summary.costUsd),
      })}
    </p>
  {/if}
  <p class="status" aria-live="polite">
    {#if step === "running" || step === "estimating"}
      <span class="spinner" aria-hidden="true"></span>
    {/if}
    {status}
  </p>
</div>

<style>
  .generate {
    display: grid;
    gap: 0.6rem;
  }

  .confirm {
    display: grid;
    gap: 0.6rem;
    padding: 1rem;
    border-radius: var(--radius-sm);
    background: var(--bg);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }

  .status:empty {
    display: none;
  }

  /* A balance wheel swinging, not a generic spinner. */
  .spinner {
    inline-size: 1rem;
    block-size: 1rem;
    border-radius: 50%;
    border: 2px solid var(--accent);
    border-block-start-color: transparent;
    animation: swing 0.9s ease-in-out infinite alternate;
  }

  @keyframes swing {
    from {
      transform: rotate(-150deg);
    }
    to {
      transform: rotate(150deg);
    }
  }
</style>
