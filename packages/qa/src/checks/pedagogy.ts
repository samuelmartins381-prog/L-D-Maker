import type { Module, ValidationResult } from "@ldm/schema";
import type { CheckResult } from "../types.ts";

export function pedagogyCheck(
  result: ValidationResult,
  module: Module,
): CheckResult {
  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");
  const questions = module.sections
    .flatMap((s) => s.screens.flatMap((sc) => sc.blocks))
    .filter((b) => b.type === "question");
  const scored = questions.filter((q) => q.scored);
  const perObjective = module.objectives.map(
    (o) =>
      `Objectif « ${o.id} » (${o.bloom}) : ${scored.filter((q) => q.objectives.includes(o.id)).length} question(s) notée(s)`,
  );
  const tolerated =
    scored.length -
    Math.ceil((scored.length * module.assessment.passingScore) / 100);
  return {
    id: "pedagogy",
    title: "Check-list pédagogique",
    criterion:
      "Objectifs mesurables et évalués, feedback par réponse, alignement, au moins une erreur tolérée, traductions complètes",
    status: errors.length ? "fail" : warnings.length ? "warn" : "pass",
    summary: `${module.objectives.length} objectifs, ${scored.length} questions notées (seuil ${module.assessment.passingScore} %, ${tolerated} erreur(s) tolérée(s)), ${questions.length - scored.length} d'entraînement`,
    details: [
      ...result.issues.map(
        (i) =>
          `${i.severity === "error" ? "Erreur" : "Avertissement"} [${i.code}] ${i.path} — ${i.message}`,
      ),
      ...perObjective,
    ],
  };
}

/** What automated checks cannot prove (phase 0 §5.4): listed so that nothing is silently assumed. */
export function manualChecks(locales: readonly string[]): CheckResult[] {
  return [
    {
      id: "manual-screen-readers",
      title: "Lecteurs d'écran",
      criterion:
        "Chaque composant testé avec NVDA (Windows) et VoiceOver (iOS/macOS)",
      status: "manual",
      summary: "Check-list par composant, à rejouer quand un composant change",
      details: [
        "Composants : narratif, accordéon, onglets, question (choix unique et multiple), récapitulatif, sommaire, fin de session",
      ],
    },
    {
      id: "manual-alt-and-reading",
      title: "Sens et lisibilité",
      criterion:
        "Textes alternatifs pertinents, ordre de lecture logique, consignes compréhensibles",
      status: "manual",
      summary: "Relecture humaine du module",
      details: [],
    },
    {
      id: "manual-translations",
      title: "Relecture native des traductions",
      criterion: "Chaque langue relue par un locuteur natif avant livraison",
      status: "manual",
      summary: `Langues : ${locales.join(", ")}`,
      details: [],
    },
    {
      id: "manual-scorm-cloud",
      title: "Validation SCORM Cloud",
      criterion: "Le paquet passe SCORM Cloud sans erreur (référence du brief)",
      status: "manual",
      summary:
        "À lancer avant livraison : pnpm qa:scorm-cloud <module> (identifiants en secrets d'environnement)",
      details: [],
    },
  ];
}
