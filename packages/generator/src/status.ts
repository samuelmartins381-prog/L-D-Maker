// Where a project stands in the pipeline (ADR 0013) and what to do next.
import { access } from "node:fs/promises";
import { loadIngest, staleSources } from "./ingest.ts";
import { loadProject, paths } from "./project.ts";
import { loadStoryboard } from "./storyboard.ts";

export interface Step {
  name: string;
  state: "done" | "todo" | "blocked";
  detail: string;
}

const exists = (f: string) =>
  access(f).then(
    () => true,
    () => false,
  );

export async function projectStatus(dir: string): Promise<Step[]> {
  const p = paths(dir);
  const project = await loadProject(dir);
  const steps: Step[] = [
    {
      name: "Projet",
      state: "done",
      detail: `${project.title} — ${project.audience}, ${project.durationMinutes} min, ${project.locales.join(", ")}`,
    },
  ];
  const index = await loadIngest(dir);
  const stale = index ? await staleSources(dir, index) : [];
  steps.push(
    !index
      ? {
          name: "Lecture des sources",
          state: "todo",
          detail: "pnpm gen ingest",
        }
      : stale.length
        ? {
            name: "Lecture des sources",
            state: "todo",
            detail: `sources modifiées depuis la lecture : ${stale.join(", ")} (pnpm gen ingest)`,
          }
        : {
            name: "Lecture des sources",
            state: "done",
            detail: `${index.sources.length} source(s), ${index.words} mots, ${index.sources.reduce((n, s) => n + s.anchors.length, 0)} ancres`,
          },
  );
  const sb = await loadStoryboard(dir);
  const errors = sb.issues.filter((i) => i.severity === "error").length;
  steps.push(
    !sb.storyboard && sb.hash === ""
      ? {
          name: "Storyboard",
          state: index && !stale.length ? "todo" : "blocked",
          detail: "à écrire par Claude à partir de ingest/",
        }
      : errors
        ? {
            name: "Storyboard",
            state: "todo",
            detail: `${errors} erreur(s) (pnpm gen storyboard)`,
          }
        : {
            name: "Storyboard",
            state: "done",
            detail: `${sb.issues.length} point(s) à vérifier, page de revue : review/storyboard.html`,
          },
  );
  const approval = project.approvals.storyboard;
  steps.push(
    !approval
      ? {
          name: "Validation de Sam",
          state: sb.storyboard && !errors ? "todo" : "blocked",
          detail: "en attente de la validation du storyboard par Sam",
        }
      : approval.hash !== sb.hash
        ? {
            name: "Validation de Sam",
            state: "todo",
            detail: `le storyboard a changé depuis la validation du ${approval.at} : à revalider`,
          }
        : {
            name: "Validation de Sam",
            state: "done",
            detail: `le ${approval.at} par ${approval.by}`,
          },
  );
  steps.push(
    (await exists(p.module))
      ? { name: "Module", state: "done", detail: "module/ présent" }
      : {
          name: "Module",
          state: "blocked",
          detail: "après la validation du storyboard",
        },
  );
  return steps;
}
