// Where a project stands in the pipeline (ADR 0013) and what to do next.
import { access } from "node:fs/promises";
import { loadIngest, staleSources } from "./ingest.ts";
import { loadProject, paths } from "./project.ts";

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
  steps.push(
    (await exists(p.storyboard))
      ? { name: "Storyboard", state: "done", detail: "storyboard.yaml présent" }
      : {
          name: "Storyboard",
          state: index && !stale.length ? "todo" : "blocked",
          detail: "à écrire par Claude à partir de ingest/",
        },
  );
  steps.push(
    project.approvals.storyboard
      ? {
          name: "Validation de Sam",
          state: "done",
          detail: `le ${project.approvals.storyboard.at} par ${project.approvals.storyboard.by}`,
        }
      : {
          name: "Validation de Sam",
          state: "blocked",
          detail: "en attente du storyboard validé",
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
