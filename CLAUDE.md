# L-D-Maker — Studio de création de formations e-learning

## Contexte
Générateur de modules e-learning tout-en-un : à partir d'un contenu source (texte, PDF, PPTX,
DOCX, transcription vidéo, URL), produire un module complet (pédagogie, design, interactions,
évaluation, multilingue) exportable vers n'importe quel LMS (SCORM 1.2, SCORM 2004 4e éd.,
xAPI, cmi5, HTML5 autonome, LTI 1.3).
Ambition : qualité supérieure à Rise, Storyline, Elucidat, Evolve, Adapt, iSpring, Genially,
7taps — prouvée par des critères mesurables vérifiés à chaque build (brief §5).

Brief complet : `docs/brief.md`.

## Cadrage (réponses de Sam, 2026-10-15)
- LMS de destination inconnus, potentiellement tous → tous les formats d'export + profils LMS.
- Utilisateur unique : Sam, pour des commandes clients (usage commercial → licences permissives
  pour tout code embarqué dans les modules, voir ADR 0001).
- Dépôt GitHub privé. Budget outils : pas de limite fixée, à proposer au cas par cas.
- Hypothèses à confirmer : contenus clients traités par Claude mais par aucun autre service tiers
  sans accord ; pas de contrainte IT client connue (navigateurs récents).
- Rise n'est pas un LMS : livrer au LMS du client, ou HTML5 via Code Block (sans suivi).

## Rôles
- Claude pilote : recherche → recommandation argumentée → décision (ou attente de Sam si la
  décision lui appartient).
- Sam fournit designs, inspirations, contenus de test, accès, retours ; installe MCP/skills/plugins.

## Règles non négociables
- Jamais d'installation de MCP, skill, plugin ou dépendance lourde sans accord de Sam :
  demande écrite dans `docs/requests-for-sam.md` (quoi, pourquoi, alternatives, risques).
- Aucun contenu confidentiel (employeur, clients) dans le dépôt ni envoyé à un service tiers
  sans accord explicite.
- Licences compatibles usage commercial uniquement ; licence notée dans l'ADR concerné.
- Exigence irréaliste ou blocage → le dire franchement et proposer une alternative.
- Décisions fondées sur des sources (docs ADL / 1EdTech, GitHub, forums), citées.
- Mode plan pour toute tâche structurante. Commits petits et fréquents.

## Conventions
- Langue des docs : français. Code, identifiants et messages de commit : anglais.
- Une décision structurante = un ADR dans `docs/decisions/NNNN-titre-court.md`
  (gabarit : `docs/decisions/0000-template.md`).
- Contenu séparé du rendu : le contenu d'un module est un JSON/YAML conforme à un schéma versionné.
- Aucune chaîne d'interface codée en dur (i18n dès le départ).

## Structure du dépôt
```
CLAUDE.md                 mémoire du projet (ce fichier)
docs/brief.md             brief de Sam
docs/decisions/           ADR
docs/requests-for-sam.md  demandes à Sam, priorisées
docs/phase0-research.md   livrable phase 0
inspirations/             captures, maquettes, liens déposés par Sam
packages/                 code (pnpm workspaces), un paquet par brique de l'architecture
packages/schema/          format de module v0.1 (Zod), chargement, validation, CLI
examples/                 modules de démo non confidentiels (validés à chaque `pnpm check`)
scripts/                  outillage (ex. contrôle des licences)
clients/, out/            sources clients et modules générés — ignorés par git
```

## Commandes
- `pnpm install` — dépendances (Node ≥ 22, pnpm 10)
- `pnpm check` — lint + typecheck + tests + licences : **doit passer avant chaque commit**
- `pnpm format` — formatage (Biome)
- `pnpm validate <dossier-module>` — valide un module (structure, pédagogie, traductions)

## Format de module (ADR 0002)
Dossier = `module.yaml` (structure, aucune chaîne affichée) + `strings/<lang>.json` (catalogues
plats clé → texte) + `media/`. Sections → écrans → blocs (`narrative`, `accordion`, `tabs`,
`question` single/multiple, `summary`). Chaque choix de question a son feedback. Chaque objectif
doit être évalué par une question notée ; chaque question notée est rattachée à un objectif.
Après une modification du schéma : `pnpm --filter @ldm/schema json-schema`.

## Outillage (J1)
TypeScript 7 (strict), Vitest, Biome (lint + format), contrôle des licences
`scripts/check-licenses.mjs` : liste stricte pour les dépendances de production
(embarquées dans les modules), liste élargie pour l'outillage de développement.

## État d'avancement
- [x] Lecture du brief, création de CLAUDE.md et de la structure
- [x] Questions de cadrage — réponses reçues le 2026-10-15
- [x] Phase 0 — `docs/phase0-research.md` + ADR 0001 (moteur propre, proposé)
- [x] Phase 0 validée par Sam (« go », 2026-10-15) — ADR 0001 acceptée
- [ ] J1 — Fondations, **étape par étape** (Sam valide après chaque étape) :
  - [x] 1. Socle du dépôt (workspaces, TypeScript, tests, lint, licences)
  - [x] 2. Schéma de module v0.1 + validation + module de démo (ADR 0002)
  - [ ] 3. Lecteur + thème (design tokens) + i18n FR/EN/AR (choix Svelte vs Preact, ADR 0003)
  - [ ] 4. Composants : écran narratif, accordéon/onglets, QCU/QCM, récapitulatif
  - [ ] 5. Suivi (interface Tracker) + export SCORM 1.2 et HTML5
  - [ ] 6. Banc QA v1 (axe, clavier, Lighthouse, faux LMS scorm-again)
