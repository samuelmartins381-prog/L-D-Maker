# 0001 — Moteur propre plutôt qu'une extension d'Adapt Learning

- **Statut** : accepté (validé par Sam le 2026-10-15)
- **Date** : 2026-10-15
- **Décideur** : Claude (recommandation), Sam (validation)

## Contexte
Le brief demande de trancher : étendre une base existante (Adapt Learning en premier lieu) ou
partir de zéro. Les contraintes qui pèsent :
- **Usage commercial** : Sam livre les modules à des clients. Chaque package livré embarque le code du lecteur.
- Barre de qualité : design premium sans rendu « template », WCAG 2.2 AA, performance mobile chiffrée, 11 langues dont RTL et CJK.
- Un seul utilisateur (Sam) et un pipeline piloté par Claude : pas besoin de l'outil auteur graphique d'Adapt.

## Options étudiées

| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| **A. Étendre Adapt** (framework v5.56.3) | Environ 23 plugins mûrs ; accessibilité AA et RTL revendiqués ; multilingue ; SCORM et xAPI via plugins ; communauté active depuis 2014 | **GPL-3.0** : les modules livrés (code dérivé) sont sous GPL et le client peut exiger les sources de nos composants. Outillage Grunt hérité. Thèmes difficiles à personnaliser en profondeur, rendu reconnaissable. Il faudrait réécrire le thème, une partie des composants et le suivi pour atteindre nos seuils. | GPL-3.0 |
| **B. Moteur propre** sur briques permissives | Licence propriétaire possible sur le lecteur ; architecture taillée pour le pipeline Claude (schéma, i18n, profils LMS) ; budget de poids maîtrisé ; aucune signature visuelle imposée | Il faut construire environ 20 composants et leur accessibilité ; pas de communauté ; risque de régressions sur des cas déjà résolus par Adapt | MIT/Apache pour les dépendances |
| **C. Hybride** : générer des cours Adapt depuis notre schéma | Réutilise le runtime Adapt | Cumule les inconvénients : GPL dans chaque livrable et deux modèles de contenu à synchroniser | GPL-3.0 |

## Décision
**Option B : moteur propre**, en TypeScript, sur des briques permissives : `@xapi/cmi5` (MIT),
pipwerks comme référence pour l'adaptateur SCORM (MIT), scorm-again (MIT) dans le banc de test,
Svelte ou Preact (MIT) pour le lecteur.
Adapt sert de **référence d'implémentation** : on lit ses choix d'accessibilité et de RTL, on ne
copie pas son code (GPL).

## Conséquences
- Toute dépendance embarquée dans un module livré doit être sous licence **MIT, BSD, Apache-2.0, ISC ou OFL** (polices). Un contrôle de licences est ajouté au build.
- Les outils de développement sous licence plus restrictive (axe-core, MPL-2.0) restent autorisés, car ils ne sont jamais embarqués.
- Le risque de volume est maîtrisé par les jalons : 4 composants au J1, environ 10 au MVP (J2), la bibliothèque complète au J3.
- Le banc de test doit être plus strict qu'Adapt dès le J1 (axe, clavier, faux LMS), pour compenser l'absence d'historique.

## Sources
- [adapt_framework — README, GPL-3.0, v5.56.3](https://github.com/adaptlearning/adapt_framework)
- [Adapt v1.0 — choix de la GPL](https://community.adaptlearning.org/mod/forum/discuss.php?d=115)
- [Adapt — courbe d'apprentissage des thèmes](https://community.adaptlearning.org/mod/forum/discuss.php?d=889)
- [scorm-again (MIT)](https://github.com/jcputney/scorm-again)
- [@xapi/cmi5 (MIT)](https://www.npmjs.com/package/%40xapi%2Fcmi5)
- [pipwerks SCORM wrapper (MIT)](https://pipwerks.com/scorm-javascript-wrapper-updates/)
