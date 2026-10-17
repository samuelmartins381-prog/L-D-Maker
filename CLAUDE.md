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
- Dépôt GitHub privé. Budget outils : pas de limite fixée, à proposer au cas par cas. Sam fournira
  à terme les clés et abonnements payants nécessaires (2026-10-17) : demande argumentée dans
  `docs/requests-for-sam.md`, clés en secrets d'environnement uniquement.
- Hypothèses à confirmer : contenus clients traités par Claude mais par aucun autre service tiers
  sans accord ; pas de contrainte IT client connue (navigateurs récents).
- Rise n'est pas un LMS : livrer au LMS du client, ou HTML5 via Code Block (sans suivi).
- Domaine principal (Sam, 2026-10-16) : **l'horlogerie**. Conséquences à garder en tête :
  - **Visuels :** beaucoup d'images techniques (mouvements, vues éclatées, macros). Il faut donc
    des zones cliquables accessibles, du zoom et des légendes.
  - **Vocabulaire :** très technique (échappement, spiral, complications…). Il faut un glossaire
    par client, à respecter dans les traductions.
  - **Langues clés du secteur :** fr, de, it, en, zh, ja.
  - **Confidentialité :** forte sur les nouveautés produits (calibres non lancés). Le contenu
    client ne va jamais dans le dépôt.
  - **Public :** à confirmer (vente en boutique, service après-vente, grand public).

## Vision produit (Sam, 2026-10-17)
- Finalité : Sam s'associe avec Kylian (ancien de la FHH) pour vendre du training et des modules
  aux marques horlogères. Brief de marque reçu → module livrable très vite. À terme, outil payant.
- Interface **simple en apparence, complexe au fond** : Sam saisit ses choix (sources, format de
  sortie / LMS cible, design, animations, types de tests et de questions) et obtient le module.
- Toute source (PDF, PPTX…) doit marcher ; le générateur **demande le format de sortie** (SCORM,
  fichier HTML unique, site à héberger…). Livraison surtout sur le LMS des marques → profils
  pour les LMS principaux.
- **Sam doit pouvoir modifier** tout ce que Claude produit (exigence centrale).
- Plus tard : designs, skills, plugins, inspirations et règles communes (« ce que je ne veux pas
  voir ») fournis par Sam, une fois l'architecture prête.
- Le Studio orchestrera d'autres services d'IA (motion design, vidéo, images : Higgsfield…) en plus
  de Claude. Exigence (Sam, 2026-10-17) : **devis complet avant chaque lancement** (coût par
  service et par étape, total, plafond de budget par projet), puis coût réel affiché. Chaque
  service tiers recevant du contenu de marque = accord de Sam + licence commerciale vérifiée.

## Organisation (ADR 0017, Sam, 2026-10-17)
Mixte : **création dans Claude Code** (skills, plugins, MCP, abonnement) ; **le dépôt** est la
colonne vertébrale (sources, contrôles, lecteur, exports, QA) ; **le Studio** est l'écran de
finition (projet et choix, aperçu, retouches, validation, export). Génération par API : option.

## Rôles
- **Objectif unique (Sam, 2026-10-17) : la plus haute qualité possible des modules, livrés vite.**
  Le moyen (Studio, Claude Code, API, outils) est la responsabilité de Claude : il décide, agit et
  rend compte. Ne pas faire trancher Sam sur la technique.
- Sam décide seulement de ce qui lui appartient : goûts et retours, accès et budget, envoi de
  contenu de marque à un service tiers, validation de ce qui part chez un client (portes).
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
packages/l10n/             traduction : export/import XLIFF 1.2 et 2.0 (ADR 0006)
packages/qa/               banc QA (axe, clavier, Lighthouse, faux LMS) + tests e2e (src/e2e/)
packages/generator/       pipeline sources → storyboard → module (ADR 0013), lecteurs PDF/DOCX/PPTX en JS
packages/studio/          application de bureau Electron (ADR 0014) : main/ (fichiers, verrou, clé), preload/, renderer/ (Svelte, ui/fr|en.json)
projects/                 projets de démonstration du générateur (ex. mouvement-mecanique)
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
- `pnpm l10n export <module> --to <lang> [--xliff 1.2|2.0]` puis `pnpm l10n import <module> <xlf>` —
  aller-retour de traduction (URL des liens jamais exportées ; lien perdu ⇒ import refusé)
- `pnpm gen init|ingest|storyboard|approve|check|build|status <projet>` — générateur (ADR 0013) ;
  `gen approve` **uniquement sur accord explicite de Sam** (porte par empreinte du storyboard)
- `pnpm studio` — lance le Studio ; `pnpm test:studio` — test de bout en bout (Playwright pilote
  Electron, axe sur chaque écran, captures dans `out/studio-e2e/`) ; installateurs Mac/Windows :
  workflow GitHub « Studio installers » (guide : `docs/studio.md`)
- `[LOCALES=ja,ru] node scripts/screenshots.ts <web-dir> <sortie> [n° écran…]` — captures mobile/desktop
  (FR/EN/AR par défaut)

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
Langues (ADR 0007) : `index.html` n'embarque que la langue par défaut ; les autres sont des
`locales/<langue>.js` injectés à la demande (`locale-loader.ts`, marche en `file://`). Changer de
langue = `player.setLocale()` (asynchrone), jamais `player.locale = …`. Typographie par écriture
dans le thème via `:root:lang(…)` : polices système en CJK (pas de Noto CJK, ~14,5 Mo), Inter pour
les titres en cyrillique (Fraunces n'a pas de cyrillique), césure automatique. Catalogue
d'interface régional absent → celui de la langue (pt-BR → `pt.json`).
Pré-rendu (ADR 0012) : `pnpm build:player` produit aussi `dist-ssr/prerender.js` ; le premier écran
est inséré dans `index.html` (`inert data-prerender`), script en `defer`, puis remplacé par le lecteur.
Code rendu au build : pas d'API navigateur hors `$effect` (protéger `matchMedia`). Tests et outils
attendent `html[data-ldm-ready]`, jamais le seul `h1`.

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
réduit, erreurs. Plus le suivi SCORM générique (faux LMS), Lighthouse (ralentissement **appliqué**,
médiane de 3, depuis le 2026-10-17 : le mode simulé surestimait le LCP) et le poids. Tout nouveau
composant doit passer le banc ; un faux positif se corrige dans le banc **en le justifiant**
(ex. roving tabindex APG), jamais en baissant un seuil.
Piège d'outillage : Biome reformate les fichiers ; après un `pnpm format`, modifier avec Edit sur
le texte relu, pas par remplacement aveugle.

## Format de module (ADR 0002)
Dossier = `module.yaml` (structure, aucune chaîne affichée) + `strings/<lang>.json` (catalogues
plats clé → texte) + `media/`. Sections → écrans → blocs (`narrative`, `accordion`, `tabs`,
`hotspots`, `question` single/multiple, `summary`). `hotspots` (ADR 0008) : repères = boutons,
explication dans un panneau sous l'image, `x`/`y` en % non inversés en RTL ; texte dans les images
limité à l'invariable (adresses, références). Image du bloc narratif : `zoom: true` (+ `zoomSrc` HD
facultatif) ouvre une visionneuse `<dialog>` (ADR 0009) ; le banc audite alors un 3e état « zoom ». Question
`variant: hotspot` (ADR 0010) : radios natives en pastilles sur `image`, `x`/`y` par choix, notée comme
« single » ; nom « Repère n » avant réponse ; avertissement si un objectif n'est évalué que visuellement. Question
`variant: sequence` (ADR 0011) : ordre des `choices` = réponse (pas de `correct`), boutons Monter/Descendre,
interaction SCORM `sequencing`. Repères masqués tant que leur image n'est pas chargée. Chaque choix de question a son feedback. Chaque objectif
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

## Studio (ADR 0014)
Electron : `contextIsolation`, `sandbox`, pas de `nodeIntegration` ; l'interface ne parle au système
que par `window.ldm` (`src/shared/api.ts`, preload). Le code sans Electron (`main/projects.ts`)
est testé dans Node. Clé API via `safeStorage`, jamais dans le dossier partagé. Verrou
`.ldm-lock` par projet (12 h). Le main est empaqueté par Vite (paquets `@ldm/*` inclus, pdf.js
externe et décompressé de l'asar). Les textes de l'interface viennent de `renderer/ui/*.json`.
Les installateurs Windows exigent Wine sous Linux : on les construit sur GitHub Actions.

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
  - [x] 1. Export SCORM 2004 4e édition (ADR 0004, addendum) — validé sur faux LMS et sur SCORM
        Cloud le 2026-10-16 (completed/passed, score 100, reprise OK, 7 interactions)
  - [x] 2. Traduction : export/import XLIFF 1.2 et 2.0 (ADR 0006) — fichiers valides contre les
        schémas OASIS stricts, aller-retour EN/AR identique
  - [x] 3. 11 langues dont CJK (ADR 0007) — démo en fr, en, ar, de, es, it, pt-BR, ru, ja,
        zh-Hans, ko ; banc : 308 pages sans violation ni débordement, Lighthouse 95 ;
        traductions Claude à faire relire par des natifs avant toute livraison
  - [ ] 4. Nouveaux composants + banque de questions, dans l'ordre choisi pour l'horlogerie :
    - [x] a. Image à repères (ADR 0008) — démo « Anatomie d'un message », banc 352 pages OK
    - [x] b. Zoom sur image (ADR 0009) — visionneuse `<dialog>`, banc 374 pages OK ; lien
          d'évitement corrigé (masquait le sélecteur de langue en russe)
    - [x] c. Question « identifie la pièce » (ADR 0010) — variante `hotspot`, banc 374 pages OK
    - [x] d. Remise en ordre d'étapes (ADR 0011) — boutons Monter/Descendre, banc 418 pages OK ;
          a conduit au pré-rendu du premier écran (ADR 0012)
    - [ ] e. Glossaire (termes soulignés + glossaire client transmis aux traducteurs)
    - [ ] f. Banque de questions, vrai/faux, appariement ; scénario à embranchements selon le public
  - [ ] 5. Lecture des sources (PDF, PPTX, DOCX) — contenu de test de Sam requis
  - [ ] 6. Pipeline complet avec storyboard validé par Sam — **prioritaire** (Sam, 2026-10-17) :
    - [x] Générateur en CLI (ADR 0013) + storyboard de démo `projects/mouvement-mecanique`
          (en attente de validation de Sam : 5 questions ouvertes)
    - [x] Lecteurs de sources en JavaScript (pdf.js, OOXML maison) : plus de Python ni pandoc
    - [ ] Studio (plan du 2026-10-17, ADR 0014 à 0016) : 1. socle Electron + nouveau projet
          (fait le 2026-10-17, testé par Sam sur Mac) ;
          2. moteur API (fait : `engine/`, `pnpm gen generate`, bouton du Studio ; essai réel à
          faire avec la clé de Sam ; passe en option, ADR 0017) ; 3. écran storyboard ; 4. aperçu et
          retouches du module ; 5. profils LMS (Watch Live/Teach on Mars…) et fichier HTML unique ;
          6. installateurs signés
    - [ ] Atelier Claude Code (ADR 0017) : skill `generate-module`, accès aux dossiers de projet
