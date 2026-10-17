// The module must implement the approved storyboard (ADR 0013): same objectives, the same screens and
// blocks in the same order, with the same types and question variants; nothing unplanned.
import type { Module } from "@ldm/schema";
import type { Storyboard } from "./storyboard.ts";

export interface ConformIssue {
  where: string;
  message: string;
}

export function conformToStoryboard(m: Module, sb: Storyboard): ConformIssue[] {
  const issues: ConformIssue[] = [];
  const add = (where: string, message: string) =>
    issues.push({ where, message });
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id).join(", ");

  if (m.id !== sb.module.id)
    add("module.id", `"${m.id}" instead of "${sb.module.id}"`);
  if (ids(m.objectives) !== ids(sb.objectives))
    add(
      "objectives",
      `[${ids(m.objectives)}] instead of [${ids(sb.objectives)}]`,
    );
  for (const o of sb.objectives) {
    const mo = m.objectives.find((x) => x.id === o.id);
    if (mo && mo.bloom !== o.bloom)
      add(
        `objectives (${o.id})`,
        `bloom "${mo.bloom}" instead of "${o.bloom}"`,
      );
  }
  if (m.assessment.passingScore !== sb.assessment.passingScore)
    add(
      "assessment.passingScore",
      `${m.assessment.passingScore} instead of ${sb.assessment.passingScore}`,
    );
  if (ids(m.sections) !== ids(sb.sections))
    add("sections", `[${ids(m.sections)}] instead of [${ids(sb.sections)}]`);

  for (const ps of sb.sections) {
    const ms = m.sections.find((s) => s.id === ps.id);
    if (!ms) continue;
    if (ids(ms.screens) !== ids(ps.screens))
      add(
        `sections (${ps.id})`,
        `screens [${ids(ms.screens)}] instead of [${ids(ps.screens)}]`,
      );
    for (const psc of ps.screens) {
      const msc = ms.screens.find((s) => s.id === psc.id);
      if (!msc) continue;
      if (ids(msc.blocks) !== ids(psc.blocks))
        add(
          `screens (${psc.id})`,
          `blocks [${ids(msc.blocks)}] instead of [${ids(psc.blocks)}]`,
        );
      for (const pb of psc.blocks) {
        const mb = msc.blocks.find((b) => b.id === pb.id);
        if (!mb) continue;
        if (mb.type !== pb.type)
          add(`blocks (${pb.id})`, `type "${mb.type}" instead of "${pb.type}"`);
        else if (mb.type === "question") {
          if (mb.variant !== pb.variant)
            add(
              `blocks (${pb.id})`,
              `variant "${mb.variant}" instead of "${pb.variant}"`,
            );
          if (mb.scored !== (pb.scored ?? true))
            add(
              `blocks (${pb.id})`,
              mb.scored
                ? "scored, planned as practice"
                : "practice, planned as scored",
            );
          if (mb.choices.length !== (pb.choices?.length ?? 0))
            add(
              `blocks (${pb.id})`,
              `${mb.choices.length} choices, ${pb.choices?.length ?? 0} planned`,
            );
          const missing = pb.objectives.filter(
            (o) => !mb.objectives.includes(o),
          );
          if (missing.length)
            add(
              `blocks (${pb.id})`,
              `objectives missing: ${missing.join(", ")}`,
            );
        }
      }
    }
  }
  return issues;
}
