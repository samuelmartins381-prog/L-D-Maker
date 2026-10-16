// Turns raw walk findings into report checks.
import type { CheckResult } from "../types.ts";
import type { WalkResult, Where } from "../walk.ts";

const where = (w: Where) =>
  `${w.locale}/${w.viewport}, écran ${w.screen + 1}${w.state === "interacted" ? " (après interaction)" : ""}`;
const MAX_DETAILS = 25;
const cap = (lines: string[]) =>
  lines.length > MAX_DETAILS
    ? [
        ...lines.slice(0, MAX_DETAILS),
        `… et ${lines.length - MAX_DETAILS} autre(s)`,
      ]
    : lines;

export function walkChecks(
  w: WalkResult,
  locales: readonly string[],
): CheckResult[] {
  const scope = `${w.screens} écrans × ${locales.length} langues × 2 formats × 2 états${w.zoomViews ? ` + ${w.zoomViews} vues zoom` : ""} = ${w.pagesAudited} pages`;
  const blocking = w.keyboard.filter((k) => k.kind !== "partly-obscured");
  const partly = w.keyboard.filter((k) => k.kind === "partly-obscured");
  const labels: Record<string, string> = {
    "no-visible-focus": "focus invisible",
    obscured: "focus entièrement masqué (2.4.11)",
    "partly-obscured": "focus partiellement masqué (2.4.12, AAA)",
    unreachable: "contrôle inaccessible au clavier",
    trap: "piège clavier",
  };
  return [
    {
      id: "axe",
      title: "Accessibilité automatique (axe-core)",
      criterion:
        "0 violation WCAG 2.2 niveaux A et AA, sur chaque écran, chaque langue, mobile et desktop",
      status: w.axe.length ? "fail" : "pass",
      summary: w.axe.length
        ? `${w.axe.length} violation(s)`
        : `0 violation sur ${scope}`,
      details: cap(
        w.axe.map(
          (v) =>
            `${where(v)} — ${v.rule} (${v.impact}) : ${v.help} → ${v.targets.slice(0, 2).join(", ")}`,
        ),
      ),
    },
    {
      id: "keyboard",
      title: "Navigation au clavier",
      criterion:
        "Tout contrôle atteignable à la tabulation, focus toujours visible et jamais masqué (WCAG 2.1.1, 2.1.2, 2.4.7, 2.4.11)",
      status: blocking.length ? "fail" : partly.length ? "warn" : "pass",
      summary: blocking.length
        ? `${blocking.length} problème(s)`
        : `${w.focusStops} arrêts de tabulation vérifiés${partly.length ? `, ${partly.length} focus partiellement masqué(s) (AAA)` : ""}`,
      details: cap(
        [...blocking, ...partly].map(
          (k) => `${where(k)} — ${labels[k.kind]} : ${k.element}`,
        ),
      ),
    },
    {
      id: "layout-overflow",
      title: "Mise en page multilingue",
      criterion:
        "Aucun débordement horizontal, dans aucune langue (LTR et RTL), mobile et desktop",
      status: w.overflow.length ? "fail" : "pass",
      summary: w.overflow.length
        ? `${w.overflow.length} page(s) débordent`
        : `Aucun débordement sur ${w.pagesAudited} pages`,
      details: cap(
        w.overflow.map(
          (o) =>
            `${where(o)} — largeur de contenu ${o.scrollWidth}px pour ${o.width}px`,
        ),
      ),
    },
    {
      id: "reduced-motion",
      title: "Mouvement réduit",
      criterion:
        "Aucune animation ni transition quand l'apprenant demande moins de mouvement (prefers-reduced-motion)",
      status: w.motion.length ? "fail" : "pass",
      summary: w.motion.length
        ? `${w.motion.length} élément(s) animé(s)`
        : "Aucune animation active",
      details: cap(
        w.motion.map((m) => `${where(m)} — ${m.element} : ${m.duration}`),
      ),
    },
    {
      id: "runtime-errors",
      title: "Erreurs d'exécution",
      criterion: "Aucune erreur JavaScript ni ressource manquante",
      status: w.errors.length ? "fail" : "pass",
      summary: w.errors.length
        ? `${w.errors.length} erreur(s)`
        : "Aucune erreur",
      details: cap(w.errors),
    },
  ];
}
