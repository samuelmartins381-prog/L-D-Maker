<script lang="ts">
import { onDestroy } from "svelte";
import type {
  GenerationProgress,
  ModuleEstimate,
  ModuleWriteSummary,
  ProjectDetail,
  TranslationSummary,
} from "../../shared/api.ts";
import { locale, t, tk } from "../i18n.svelte.ts";
import { app, unwrap } from "../store.svelte.ts";

const {
  project,
  mode,
  again = false,
}: {
  project: ProjectDetail;
  /** write: the module, then its translations; translate: only the texts due. */
  mode: "write" | "translate";
  again?: boolean;
} = $props();

let step = $state<"idle" | "estimating" | "confirm" | "running" | "done">(
  "idle",
);
let estimate = $state<ModuleEstimate | null>(null);
let progress = $state<GenerationProgress | null>(null);
let written = $state<ModuleWriteSummary | null>(null);
let translated = $state<TranslationSummary | null>(null);

const usd = (n: number) =>
  new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
const pending = $derived(
  project.state.module.translations.reduce((n, x) => n + x.pending, 0),
);
const languages = (ls: string[]) => ls.map((l) => tk(`locale.${l}`)).join(", ");

const unsubscribe = window.ldm.onGenerationProgress((p) => {
  progress = p;
});
onDestroy(unsubscribe);

async function prepare() {
  step = "estimating";
  estimate = unwrap(await window.ldm.estimateModule(project.dir));
  step = estimate ? "confirm" : "idle";
}

async function run() {
  step = "running";
  progress = null;
  if (mode === "write") {
    written = unwrap(await window.ldm.writeModule(project.dir));
    step = written ? "done" : "idle";
    // The page changes once the module exists: the result is kept on the project page.
    if (written)
      app.notice = {
        dir: project.dir,
        lines: [
          t("module.done", {
            rounds: written.rounds,
            errors: written.errors,
            warnings: written.warnings,
            cost: usd(written.costUsd),
          }),
          ...(written.translated.length
            ? [
                t("module.translatedInto", {
                  languages: languages(written.translated),
                }),
              ]
            : []),
        ],
        notes: written.notes,
      };
  } else {
    translated = unwrap(await window.ldm.translateModule(project.dir));
    step = translated ? "done" : "idle";
  }
  const updated = unwrap(await window.ldm.openProject(project.dir));
  if (updated) app.project = updated;
}

const status = $derived.by(() => {
  if (step === "estimating") return t("generate.estimating");
  if (step !== "running") return "";
  if (!progress || progress.stage === "done") return t("module.starting");
  const lang = progress.locale ? tk(`locale.${progress.locale}`) : null;
  if (progress.stage === "writing")
    return lang
      ? t("module.translating", { language: lang, chars: progress.chars })
      : t("module.writing", { round: progress.round, chars: progress.chars });
  return lang
    ? t("module.checkingTranslation", { language: lang })
    : t("generate.checking", { round: progress.round });
});
</script>

<div class="generate">
  {#if !app.settings?.canGenerate}
    <p class="muted">{t("generate.noKey")}</p>
    <p>
      <button type="button" class="btn" onclick={() => (app.screen = "settings")}
        >{t("nav.settings")}</button
      >
    </p>
  {:else if (step === "idle" || step === "estimating") && (mode === "write" || pending > 0)}
    <p>
      <button
        type="button"
        class="btn {again || mode === 'translate' ? '' : 'btn-primary'}"
        onclick={prepare}
        disabled={step === "estimating" || !project.editable}
        >{mode === "translate"
          ? t("module.translate")
          : again
            ? t("module.again")
            : t("module.write")}</button
      >
    </p>
  {:else if step === "confirm" && estimate}
    <div class="confirm">
      {#if mode === "write"}
        <p>
          {t("module.estimate", {
            tokens: estimate.inputTokens,
            low: usd(estimate.lowUsd),
            high: usd(estimate.highUsd),
          })}
        </p>
      {/if}
      {#if estimate.translationLocales.length}
        <p>
          {t("module.estimateTranslations", {
            languages: languages(estimate.translationLocales),
            low: usd(estimate.translationLowUsd),
            high: usd(estimate.translationHighUsd),
          })}
        </p>
      {/if}
      {#if mode === "write"}
        <p>
          <strong
            >{t("module.total", {
              low: usd(estimate.lowUsd + estimate.translationLowUsd),
              high: usd(estimate.highUsd + estimate.translationHighUsd),
            })}</strong
          >
        </p>
      {/if}
      <p class="help">{t("generate.privacy")}</p>
      {#if again && mode === "write"}<p class="help">{t("module.replaces")}</p>{/if}
      <div class="actions">
        <button type="button" class="btn btn-primary" onclick={run}
          >{t("generate.confirm")}</button
        >
        <button type="button" class="btn" onclick={() => (step = "idle")}
          >{t("common.cancel")}</button
        >
      </div>
    </div>
  {:else if step === "done" && translated}
    <p>
      {translated.translated.length
        ? t("module.translationsDone", {
            languages: languages(translated.translated.map((x) => x.locale)),
            cost: usd(translated.costUsd),
          })
        : t("module.nothingToTranslate")}
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

  /* The same swinging balance wheel as the storyboard generation. */
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
