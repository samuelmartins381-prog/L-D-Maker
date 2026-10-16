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
docs/audits/              audits pédagogiques (skills éducation)
inspirations/             captures, maquettes, liens déposés par Sam
packages/                 code (pnpm workspaces), un paquet par brique de l'architecture
packages/schema/          format de module v0.1 (Zod), chargement, validation, CLI
packages/player/          lecteur Svelte 5 (IIFE), thèmes CSS, textes d'interface (src/ui/*.json)
packages/builder/         module validé + lecteur → out/<id>/{web,scorm12,scorm2004}/ + ZIP par format
packages/qa/               banc QA (axe, clavier, Lighthouse, faux LMS) + tests e2e (src/e2e/)
examples/                 modules de démo non confidentiels (validés à chaque `pnpm check`)
scripts/                  outillage (ex. contrôle des licences)
clients/, out/            sources clients et modules générés — ignorés par git
```

## Commandes
- `pnpm install` — dépendances (Node ≥ 22, pnpm 10)
- `pnpm check` — lint + typecheck + tests + licences : **doit passer avant chaque commit**
- `pnpm format` — formatage (Biome)
- `pnpm validate <dossier-module>` — valide un module (structure, pédagogie, traductions)
- `pnpm build:player` puis `pnpm build <dossier-module> [--format web|scorm12|scorm2004|all]` —
  construit `out/<id>/web/` (aperçu, marche en `file://`, `?lang=ar`), `scorm12/`, `scorm2004/` et les ZIP
- `pnpm test:e2e` — scénarios navigateur (suivi SCORM 1.2 sur 2 sessions, reprise HTML5)
- `pnpm qa <dossier-module> [--skip-lighthouse]` — banc QA sur le module construit → rapport
  `out/<id>/qa/report.html` (autonome, à envoyer tel quel). Échec = code de sortie 1.
- `pnpm qa:scorm-cloud <dossier-module> [--version 1.2|2004]` — validation réelle sur SCORM Cloud. Exige
  `SCORM_CLOUD_APP_ID` / `SCORM_CLOUD_SECRET_KEY` en secrets d'environnement, **jamais dans le
  dépôt**. Hors de `pnpm check` (réseau, limites de l'essai : 10 inscriptions actives).
- `node scripts/screenshots.ts <web-dir> <sortie> [n° écran…]` — captures FR/EN/AR mobile/desktop

## Lecteur (ADR 0003)
Svelte 5, build IIFE + contenu inséré dans index.html (pas de module ES ni de fetch : `file://`
doit marcher). Les avertissements du compilateur (accessibilité incluse) **cassent le build**.
CSS en propriétés logiques uniquement (RTL sans feuille dédiée). Les composants ne lisent que
les variables du thème (`themes/*.css`, contrastes testés). Tout texte d'interface vient de
`src/ui/<langue>.json` (mêmes clés partout, testé) ; une langue de module sans catalogue
d'interface fait échouer le build. svelte-check exige TS 6 + TS 7 (`--tsgo`) : voir
`packages/player/package.json`.
Composants (J1 étape 4) : accordéon et onglets selon les patterns WAI-ARIA APG (flèches inversées
en RTL), question = fieldset + radios/cases natives. La logique de question est pure et testée
(`src/grading.ts` : tout ou rien, essais, ordre mélangé figé, score). Les réponses sont créées
dans le constructeur du `Player` : **ne jamais écrire d'état dans un `$derived`** (erreur Svelte
`state_unsafe_mutation`). `scroll-padding` sur `html` garde le focus visible sous les barres
collantes (WCAG 2.4.11).

## Suivi (ADR 0004)
Interface `Tracker` (`player/src/tracking/`) : adaptateurs `scorm12`, `scorm2004` et `standalone`,
cible fixée au build. 2004 : complétion et réussite séparées, horodatages `…:ss.ssZ` (le « Z » exige
une fraction de seconde). Le banc échoue sur toute valeur refusée par le LMS. Statut 1.2 : completed sans évaluation, passed/failed avec. État de reprise compact
`suspend.ts`, lié à `id@version` du module (changer la version invalide les reprises). Ajouter
SCORM 2004 / cmi5 / xAPI = un nouvel adaptateur, rien d'autre. Langue : `?lang=` > préférence
LMS (`cmi.student_preference.language`) > navigateur. SCORM Cloud : SCO en popup par défaut,
données du SCO dans `activityDetails.children[]` de l'API ; la suppression par API dépend du
réglage « Allow Delete API calls » de l'application.

## Banc QA (ADR 0005)
Chaque écran × langue × mobile/desktop × état (affiché, après interaction) : axe 0 violation,
parcours Tab (focus visible, jamais masqué : test `elementFromPoint`), débordement, mouvement
réduit, erreurs. Plus le suivi SCORM générique (faux LMS), Lighthouse et le poids. Tout nouveau
composant doit passer le banc ; un faux positif se corrige dans le banc **en le justifiant**
(ex. roving tabindex APG), jamais en baissant un seuil.
Piège d'outillage : Biome reformate les fichiers ; après un `pnpm format`, modifier avec Edit sur
le texte relu, pas par remplacement aveugle.

## Format de module (ADR 0002)
Dossier = `module.yaml` (structure, aucune chaîne affichée) + `strings/<lang>.json` (catalogues
plats clé → texte) + `media/`. Sections → écrans → blocs (`narrative`, `accordion`, `tabs`,
`question` single/multiple, `summary`). Chaque choix de question a son feedback. Chaque objectif
doit être évalué par une question notée ; chaque question notée est rattachée à un objectif.
Après une modification du schéma : `pnpm --filter @ldm/schema json-schema`.

## Skills éducation (audit du 2026-10-16, `docs/audits/`)
Utiliser une sélection, pas tous : beaucoup visent le scolaire (histoire, Reggio, extérieur…).
- Objectifs : `backwards-design-unit-planner`, `competency-unpacker`, `kud-knowledge-type-mapper`
- Storyboard : `cognitive-load-analyser`, `dual-coding-designer`, `experiential-learning-cycle-designer`
- Évaluation : `assessment-validity-checker`, `hinge-question-designer`, `retrieval-practice-generator`,
  `erroneous-example-designer`
- Feedback : `feedback-quality-analyser`
- Inclusion et langues : `udl-barrier-anticipator`, `cross-cultural-task-validity-checker`,
  `language-demand-analyser`
Règles tirées de l'audit : feedback de choix **neutre** (le lecteur donne le verdict), au moins
une erreur tolérée par le seuil, distracteurs fondés sur des idées reçues réelles, un exemple
travaillé avant l'entraînement, une routine d'autorégulation dans le récapitulatif.
Au J2 : en faire des étapes formelles du pipeline (ADR à écrire).

## Outillage (J1)
TypeScript 7 (strict), Vitest, Biome (lint + format), contrôle des licences
`scripts/check-licenses.mjs` : liste stricte pour les dépendances de production
(embarquées dans les modules), liste élargie pour l'outillage de développement.

## État d'avancement
- [x] Lecture du brief, création de CLAUDE.md et de la structure
- [x] Questions de cadrage — réponses reçues le 2026-10-15
- [x] Phase 0 — `docs/phase0-research.md` + ADR 0001 (moteur propre, proposé)
- [x] Phase 0 validée par Sam (« go », 2026-10-15) — ADR 0001 acceptée
- [x] J1 — Fondations, **étape par étape** (Sam valide après chaque étape) — terminé le 2026-10-16 :
  - [x] 1. Socle du dépôt (workspaces, TypeScript, tests, lint, licences)
  - [x] 2. Schéma de module v0.1 + validation + module de démo (ADR 0002)
  - [x] 3. Lecteur + thème + i18n FR/EN/AR (Svelte 5, ADR 0003) — JS 21 Ko gz, CSS 4 Ko gz
  - [x] 4. Composants : narratif (+ image), accordéon, onglets, QCU/QCM, récapitulatif — JS 25 Ko gz
  - [x] 5. Suivi (Tracker) + export SCORM 1.2 et HTML5 (ADR 0004) — validé sur faux LMS, pas
        encore sur SCORM Cloud (compte à fournir)
  - [x] 6. Banc QA v1 (ADR 0005) — module de démo : 11 conformes, 0 non conforme, 4 manuels
- [x] Critère de sortie J1 : validé sur SCORM Cloud le 2026-10-16 (passed, score 100, reprise OK)
- [ ] J2 — MVP, étape par étape :
  - [x] 1. Export SCORM 2004 4e édition (ADR 0004, addendum) — validé sur faux LMS ; SCORM Cloud à
        lancer quand la nouvelle clé sera visible (`--version 2004`)
  - [ ] 2. Traduction : export/import XLIFF
  - [ ] 3. 11 langues dont CJK (polices, expansion du texte)
  - [ ] 4. Nouveaux composants + banque de questions
  - [ ] 5. Lecture des sources (PDF, PPTX, DOCX) — contenu de test de Sam requis
  - [ ] 6. Pipeline complet avec storyboard validé par Sam
