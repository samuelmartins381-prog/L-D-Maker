# Phase 0 — Recherche

_Livrable de la phase 0. Rédigé le 2026-10-15. Statut : **en attente de validation par Sam**._

Ce document répond aux cinq points de la phase 0 du brief (§3) : benchmark, état de l'art
technique, décision clé, MCP/skills/plugins, architecture et roadmap. Les sources sont citées
à chaque section. Ce qui n'a pas pu être vérifié est marqué **[non vérifié]**.

---

## 0. Cadrage retenu (réponses de Sam du 2026-10-15)

| Sujet | Réponse | Conséquence |
|---|---|---|
| LMS de destination | Inconnus, potentiellement tous (Moodle, Cornerstone, 360Learning, Rise…) | Tous les formats d'export ; des **profils LMS** qui ajustent le package aux particularités de chaque plateforme. |
| Utilisateur | Sam seul, pour des commandes clients | Pas d'éditeur WYSIWYG ni de comptes multi-utilisateurs. Le studio est piloté par Claude, avec des points de validation humains (storyboard, revue finale). L'effort va dans la qualité du rendu, pas dans une interface d'édition. |
| Dépôt | Privé | Les contenus de test peuvent y être versionnés. Les contenus clients restent hors du dépôt par défaut (dossier ignoré par git). |
| Budget | Pas de limite pour l'instant, à ajuster selon le volume | Les outils payants sont proposés au cas par cas, avec leur coût. |
| Usage | Commercial (modules livrés à des clients) | Licences permissives obligatoires pour tout code embarqué dans les modules livrés (voir ADR 0001). |

**Hypothèses par défaut, à confirmer** (questions restées sans réponse) :
- **Confidentialité** : les contenus clients sont traités par Claude dans les sessions de travail. Ils ne sont envoyés à **aucun autre service tiers** (traduction automatique, génération d'images, LRS hébergé…) sans accord explicite, au cas par cas.
- **Contraintes IT clients** : aucune connue. Les packages visent des navigateurs « evergreen » (Chrome, Edge, Firefox, Safari, 2 dernières versions), sans Internet Explorer.

### Point de franchise : Rise n'est pas un LMS
Articulate Rise 360 est un **outil auteur**, pas une plateforme de diffusion. Il **n'importe pas
de package SCORM** : le personnel d'Articulate le confirme sur le forum. Si un client « veut le
module dans Rise », il y a trois cas :
1. Le cours Rise est publié dans un LMS → on livre **notre package SCORM directement à ce LMS**. C'est la bonne réponse dans 90 % des cas.
2. Le client veut intégrer une activité dans un cours Rise existant → on livre un **HTML5 hébergé**, intégré via le **Code Block** (HTML/CSS/JS personnalisé, sorti au T3 2025) ou un bloc d'intégration iframe. **Aucun suivi SCORM** n'est alors possible depuis notre activité : c'est le cours Rise qui porte le suivi.
3. Le client exige un fichier source Rise éditable → c'est impossible (format propriétaire, sans import).

Sources : [Articulate — Upload a SCORM file into Rise?](https://community.articulate.com/discussions/rise-360/upload-a-scorm-file-into-rise), [Embedding SCORM packages](https://community.articulate.com/discussions/rise-360/embedding-scorm-packages), [Q3 Feature Release (Code Block)](https://www.articulate.com/blog/q3-feature-release-announcement/), [Rise — How to use Code Block](https://www.articulatesupport.com/article/Rise-360-How-to-Use-Code-Block).

---

## 1. Benchmark des outils leaders

| Outil | Ce qu'il fait de mieux | Limites récurrentes (forums, avis) |
|---|---|---|
| **Articulate Rise 360** | Rapidité de production, responsive natif, rendu propre, XLIFF, Code Block depuis 2025 | Mise en page figée en blocs : **les cours se ressemblent tous**. Personnalisation de marque limitée. Embranchements complexes impossibles. **RTL (arabe, hébreu) non supporté** pendant des années : texte aligné à gauche, puces du mauvais côté, contournements CSS jugés « pas terribles ». Abonnement coûteux. |
| **Articulate Storyline 360** | Liberté totale par diapositive, déclencheurs et variables, simulations | Logique diapositive en 16:9, donc **peu adaptée au mobile**. Windows uniquement (« en 2026 toujours pas de Mac »). Production lente. Accessibilité qui dépend entièrement du soin de l'auteur. |
| **Elucidat** | Collaboration, gestion de variantes et de langues à grande échelle | Personnalisation limitée, lenteurs sur les gros projets, interface peu intuitive. Environ 480–570 $/utilisateur/an. |
| **Evolve** | Composants riches, plus personnalisable qu'Elucidat | Courbe d'apprentissage raide. Rendu « composants » reconnaissable. |
| **Adapt Learning** (open source) | Responsive, accessibilité AA revendiquée, RTL revendiqué, multilingue, xAPI via plugin | Conçu pour développeurs : thème = « sérieuses compétences CSS ». Outil auteur fragile (installations qui échouent). Rendu par défaut générique. **GPL-3.0** (voir ADR 0001). |
| **iSpring Suite** | Conversion PowerPoint → e-learning, simulations de dialogue | Esthétique PowerPoint. Windows uniquement. |
| **Genially** | Visuels interactifs riches, animations | Pensé pour la présentation plutôt que pour le suivi LMS. Accessibilité et performance faibles sur le contenu chargé. |
| **7taps** | Micro-learning mobile, très rapide | Format très contraint (cartes), pédagogie limitée, peu d'évaluation. |

### Où est l'opportunité
Les plaintes convergent sur cinq points. Ce sont nos axes de supériorité, chacun mesurable (§5) :
1. **Rendu générique** : chaque outil a une « signature visuelle » reconnaissable. Nous partons d'un design system propre à chaque client, dérivé de ses maquettes et inspirations.
2. **Multilingue et RTL** : c'est le point faible historique de Rise, et un travail manuel ailleurs. Nous le traitons dès l'architecture (propriétés CSS logiques, polices par écriture, XLIFF, tests visuels dans les 11 langues).
3. **Accessibilité réelle** : les outils la « permettent » mais ne la garantissent pas. Nous l'imposons par le composant et la vérifions à chaque build.
4. **Compatibilité LMS** : les forums regorgent de problèmes de reprise (suspend_data saturé) et de lancement (SuccessFactors). Nous intégrons ces particularités dans des profils LMS testés.
5. **Vitesse de production avec qualité** : la génération par Claude remplace l'assemblage manuel de blocs, avec des portes qualité automatiques.

Sources : [Rise limitations (Articulate)](https://community.articulate.com/discussions/rise-360/rise-limitations), [G2 — Articulate 360](https://www.g2.com/products/articulate-360/reviews), [Gartner — Articulate](https://external.pi.gpi.aws.gartner.com/reviews/market/elearning-authoring-tools/vendor/articulate), [easygenerator — analyse de 126 avis G2](https://www.easygenerator.com/en/blog/e-learning/articulate-360-review/) (concurrent, à lire avec recul), [Rise RTL (Articulate)](https://community.articulate.com/discussions/rise-360/right-to-left-language-in-rise?page=4), [Globalization Partners — Rise RTL](https://www.globalizationpartners.com/2020/07/15/articulate-rise-rtl-language-support/), [G2 — Elucidat](https://g2.com/products/elucidat/reviews?page=5), [Gartner — Elucidat](https://www.gartner.com/reviews/product/elucidat-341780407), [Elucidat vs Evolve](https://elearningindustry.com/directory/compare/elearning-authoring-tools/elucidat-vs-evolve), [Capterra — Evolve](https://www.capterra.ie/reviews/173996/evolve-authoring), [Adapt — forum communauté](https://community.adaptlearning.org/mod/forum/discuss.php?d=889), [zipBoard — revue Adapt](https://zipboard.co/blog/elearning/adapt-authoring-tool-review-f1edc1644a77/).

> Limite de ce benchmark : les fiches iSpring, Genially et 7taps reposent sur une connaissance
> générale du marché, pas sur une lecture de forums approfondie **[non vérifié en détail]**. Je
> les approfondirai si l'un d'eux devient une référence pour un client.

---

## 2. État de l'art technique

### 2.1 Normes

| Norme | Statut | Points clés pour nous |
|---|---|---|
| **SCORM 1.2** (2001) | **Le plus universel.** Le plus sûr pour les LMS d'entreprise. | `suspend_data` limité à **4 096 caractères**. Pas de distinction complétion/réussite séparée (un seul `lesson_status`). |
| **SCORM 2004 4e éd.** (2009) | Bien supporté, mais support partiel selon les LMS | `suspend_data` à **64 000 caractères** (3e/4e éd.). Docebo : 2004 **3e** éd. et **pas de séquençage**. SuccessFactors : problèmes de méthode de lancement documentés. Nous **n'utilisons pas le séquençage** (Simple Sequencing) : la navigation est gérée dans le module. |
| **xAPI** | Mature, nécessite un **LRS** | Données riches (chaque interaction). Le LMS doit savoir lancer le contenu et fournir un LRS : souvent via cmi5. |
| **cmi5** (xAPI + règles de lancement) | Adoption en croissance, mais **bien plus étroite que SCORM** | Docebo et Moodle (via plugin) le plus souvent cités. **Aucune preuve** pour SuccessFactors, peu de détails pour Cornerstone. Outil de conformité officiel : **CATAPULT** (ADL, open source). |
| **LTI 1.3** | Standard 1EdTech pour **outils hébergés** | Ce n'est pas un format de package : il faut **héberger un service** (serveur, OIDC, clés). Hors MVP (voir §5). |
| **AICC** | Legacy (HACP, sans API JavaScript) | scorm-again l'a même retiré. **Hors périmètre** sauf demande client explicite. |

**Conséquence : stratégie d'export par défaut.** On livre **SCORM 1.2** quand le client ne sait
pas, **SCORM 2004 4e** quand le LMS le gère bien (reprise plus riche), et **cmi5** quand le
client a un LRS et veut des données fines. Le format d'état de reprise est **compressé et
versionné** pour tenir dans 4 096 caractères, même en SCORM 1.2.

### 2.2 Particularités des LMS d'entreprise (premier relevé)

| LMS | Particularités connues | Source |
|---|---|---|
| **SAP SuccessFactors** | La recherche de l'API SCORM peut tomber sur un cadre d'un autre domaine (en-tête BizX) → erreur cross-origin → aucun suivi. Méthode de lancement à régler selon le schéma du manifeste. Écran « Loading Course Data » en 2004 4e éd. Retours terrain recommandant SCORM 1.2. | SAP KBA [2808684](https://userapps.support.sap.com/sap/support/knowledge/en/2808684), [2531411](https://userapps.support.sap.com/sap/support/knowledge/en/2531411), [2559154](https://userapps.support.sap.com/sap/support/knowledge/en/2559154), [2506449 (limites suspend_data)](https://userapps.support.sap.com/sap/support/knowledge/en/2506449) |
| **Docebo** | SCORM 1.2 et 2004 3e éd., **sans séquençage**. suspend_data 4 096 / 64 000. xAPI/cmi5 **[non vérifié]**. | [Docebo Help](https://help.docebo.com/hc/en-us/articles/360020128479) |
| **Cornerstone** | Pas de documentation publique trouvée sur les limites. Un retour terrain : un cours qui échouait sur SuccessFactors fonctionnait sur Cornerstone. **[À vérifier avec un accès client]** | [Articulate — bookmarking](https://community.articulate.com/discussions/discuss/storyline-360storyline-3---bookmarking-on-lms/667360/replies/667398) |
| **360Learning** | SCORM 1.2 et 2004 testés par iSpring. xAPI/cmi5 **[non vérifié]**. | [iSpring — 360Learning](https://www.ispringsolutions.com/supported-lms/360learning) |
| **Moodle** | SCORM natif. xAPI : pas natif (plugin logstore). cmi5 : plugin ADL `mod_cmi5launch` (un retour d'erreur 403 signalé). | [ADL TLA](https://adlnet.gov/guides/tla/service-definitions/xAPI-Adoption-TLA-CMM-Level-1.html), [Rustici — xAPI/cmi5 dans Moodle](https://rusticisoftware.com/resources/play-xapi-and-cmi5-in-moodle/) |

**Lesquels comptent ?** Je n'ai pas trouvé de part de marché fiable pour la France. Les plus
cités en entreprise sont Cornerstone, SuccessFactors, Workday Learning, Docebo et Moodle ;
360Learning est français et pertinent pour ta clientèle. **Workday Learning** est à ajouter à la
liste à documenter. Ce tableau s'enrichira à chaque livraison client : chaque retour terrain
devient un **profil LMS** testé.

### 2.3 Bibliothèques open source

| Brique | Rôle | Licence | Verdict |
|---|---|---|---|
| **scorm-again** v3.4.6 (oct. 2026, très actif) | **Côté LMS** : implémente `window.API` / `API_1484_11`. SCORM 1.2 et 2004 uniquement (AICC retiré). Mode cross-frame. Pas de dépendance. | MIT | **Pour notre banc de test** (un faux LMS local qui enregistre tous les appels) et l'aperçu hors LMS. **Pas dans les packages** : ce n'est pas un wrapper côté contenu. |
| **pipwerks SCORM wrapper** | Côté contenu : recherche de l'API et appels SCORM 1.2/2004 | MIT | Référence. Nous écrirons notre propre adaptateur (environ 200 lignes) pour corriger l'ordre de recherche de l'API (cas SuccessFactors) et typer le tout. |
| **@xapi/cmi5** | Côté contenu cmi5 (AU), TypeScript, « entièrement conforme » | MIT | **Retenu** pour l'export cmi5. |
| **SQL LRS** (Yet Analytics) | LRS xAPI (SQLite/Postgres) | Apache-2.0 | **Retenu** pour tester xAPI/cmi5 en local (Docker). |
| **CATAPULT CTS** (ADL) | Banc de conformité du contenu cmi5 | Open source **[licence exacte à vérifier]** | **Retenu** pour valider l'export cmi5. |
| **Adapt framework** v5.56.3 (sept. 2026) | Framework complet de cours | **GPL-3.0** | Écarté comme base, gardé comme **référence d'implémentation** (accessibilité, RTL). Voir ADR 0001. |
| **ltijs** | LTI 1.3 (Node), certifié IMS, deep linking | **[licence à vérifier]** | À réévaluer au jalon LTI. |
| **Docling** / **MarkItDown** | Extraction PDF/DOCX/PPTX → Markdown | MIT / MIT | Docling meilleur sur les PDF complexes (tableaux, titres) mais lourd (PyTorch, environ 1 Go). MarkItDown léger. Les skills `pdf`/`docx`/`pptx` déjà disponibles dans cette session couvrent le MVP. **Docling seulement si besoin** (dépendance lourde, donc ton accord). |

Sources : [scorm-again (GitHub)](https://github.com/jcputney/scorm-again), [adapt_framework (GitHub)](https://github.com/adaptlearning/adapt_framework), [Adapt v1.0 — choix GPL](https://community.adaptlearning.org/mod/forum/discuss.php?d=115), [pipwerks](https://pipwerks.com/scorm-javascript-wrapper-updates/), [@xapi/cmi5](https://www.npmjs.com/package/%40xapi%2Fcmi5), [CATAPULT (ADL)](https://adlnet.gov/projects/cmi5-CATAPULT), [SQL LRS](https://github-redirect.dependabot.com/yetanalytics/lrsql), [ltijs](https://www.npmjs.com/package/ltijs), [Docling vs MarkItDown](https://yage.ai/share/markitdown-survey-en-20260412.html).

### 2.4 Validation des packages
1. **SCORM Cloud** (Rustici), la référence. Essai gratuit **sans limite de durée** : 3 cours, 5 Go, 10 inscriptions actives. Plan « Tester » environ **40 $/mois** **[prix tiers non vérifié sur le site]**. Utilisable via API pour automatiser l'import et le lancement. ([tarifs](https://rusticisoftware.com/products/scorm-cloud/pricing/))
2. **Faux LMS local** (scorm-again + Playwright) : il rejoue chaque module, vérifie la séquence des appels, la reprise de session, les limites de suspend_data. Il tourne à **chaque build**, sans réseau.
3. **Moodle en Docker** (`moodlehq/moodle-docker`) : Docker est disponible dans cet environnement **[démon à tester]**.
4. **CATAPULT** pour cmi5, **SQL LRS** pour xAPI.

---

## 3. Décision clé : base existante ou partir de zéro ?

**Recommandation : moteur propre, léger, en TypeScript, construit sur des briques permissives
(MIT/Apache).** Adapt sert de référence, pas de fondation. Détail et options dans
[`docs/decisions/0001-own-engine-vs-adapt.md`](decisions/0001-own-engine-vs-adapt.md).

En bref :
- **Licence** : chaque module livré embarque le code du lecteur. Avec Adapt (GPL-3.0), chaque client reçoit du code GPL et le droit d'en obtenir les sources, y compris nos composants premium qui en dérivent. Pour une activité commerciale dont le différenciateur est la qualité du rendu, c'est un mauvais pari.
- **Esthétique** : le rendu Adapt est reconnaissable, et sa personnalisation profonde demande de lutter contre le framework, ce qui va à l'encontre de « aucun rendu template générique ».
- **Poids et performance** : on vise environ 60 Ko de JS compressé pour le lecteur (voir §5), plus facile à tenir sans l'héritage d'un framework de 2014 (outillage Grunt).
- **Ce qu'on perd** : 10 ans de composants testés et d'accessibilité éprouvée. On compense en s'inspirant de leurs choix d'accessibilité et de RTL, et par un banc de test plus strict que le leur.
- **Risque principal** : le volume de travail sur la bibliothèque d'interactions (environ 20 composants). Il est réparti sur les jalons, avec le MVP limité aux composants les plus utilisés.

---

## 4. MCP, skills et plugins recommandés

**Déjà disponibles dans cette session, rien à installer :**
- **GitHub (MCP)** : dépôt, issues, PR.
- **Skills `pdf`, `docx`, `pptx`, `xlsx`** : lecture des sources clients, export PDF récapitulatif, échange tableur pour la traduction.
- **Chromium + Playwright** préinstallés dans l'environnement cloud : suffisant pour le banc de test automatisé.
- **Higgsfield** (génération d'images et de vidéos) est connecté. **Je ne l'utiliserai pas sans ton accord** : c'est un service tiers (les prompts peuvent contenir du contenu client), et les droits commerciaux des visuels générés sont à vérifier.

**Demandes d'installation, par priorité** (détail dans [`requests-for-sam.md`](requests-for-sam.md)) :

| Priorité | Outil | Pourquoi | Alternative écartée | Risques |
|---|---|---|---|---|
| P1 | **Context7 MCP** (Upstash) | Documentation à jour des bibliothèques (Svelte, Playwright, axe…) : moins d'API inventées ou obsolètes | Recherche web au coup par coup : plus lente, moins fiable | Les requêtes (noms de bibliothèques, sujets) partent chez Upstash. **Aucun contenu client.** |
| P2 | **Figma MCP** (officiel, serveur distant) | Lire tes maquettes (tokens, composants) pour en extraire le design system | Export PNG manuel dans `inspirations/` : perd les tokens exacts | Lecture de tes fichiers Figma auxquels tu donnes accès. Plugin officiel : `claude plugin install figma@claude-plugins-official`. **Utile seulement si tu travailles dans Figma.** |
| P3 | **Playwright MCP** (Microsoft, Apache-2.0) | Me laisser « regarder » un module interactivement pendant la conception (inspection visuelle, clavier) | La bibliothèque Playwright en script, qui suffit pour les tests automatisés | Pilotage d'un navigateur local. Faible. Optionnel. |

Sources : [Context7](https://www.mintlify.com/upstash/context7/mcp/overview), [Figma — serveur MCP distant](https://help.figma.com/hc/en-us/articles/35281350665623-Figma-MCP-collection-How-to-set-up-the-Figma-remote-MCP-server), [Playwright MCP](https://hub.docker.com/r/microsoft/playwright-mcp).

**Comptes et services (hors MCP) :**
- **SCORM Cloud** : le compte d'essai gratuit suffit pour démarrer. Le plan Tester (environ 40 $/mois) deviendra utile quand le banc de test l'appellera à chaque build.
- **Troisième LMS de test** : je propose un **LMS d'entreprise via un accès sandbox client** dès qu'une commande le permet (le plus représentatif). En attendant, Moodle et SCORM Cloud couvrent la conformité.

---

## 5. Architecture et roadmap

### 5.1 Principes
- **Contenu ≠ rendu** : un module est un fichier `module.yaml` (pédagogie et structure, sans texte affiché) accompagné d'un **catalogue de chaînes par langue**. Tous deux sont validés par un **schéma versionné** (JSON Schema). Changer de thème, de langue ou de format d'export ne touche pas au contenu.
- **Claude pilote le pipeline, Sam valide aux portes** : source → objectifs → **storyboard (porte Sam)** → contenu structuré → rendu → QA automatique → **revue Sam** → packaging.
- **Un lecteur, plusieurs adaptateurs de suivi** : le lecteur parle à une interface `Tracker` unique (complétion, score, réussite, temps, reprise, interactions). Les adaptateurs : `scorm12`, `scorm2004`, `cmi5`, `xapi`, `standalone` (stockage local, HTML5 hors ligne).
- **Profils LMS** : un fichier par LMS (Cornerstone, SuccessFactors, Docebo, 360Learning, Moodle…) qui ajuste le package (format préféré, fenêtre de lancement, ordre de recherche de l'API, taille de l'état de reprise).

### 5.2 Vue d'ensemble

```
sources (PDF, DOCX, PPTX, URL, transcriptions)
   │  ingest  → Markdown normalisé + médias
   ▼
objectifs (Bloom, mesurables) → storyboard.md  ◄── validation Sam
   ▼
module.yaml + strings/<lang>.json  ◄── schéma versionné, check-list pédagogique
   │                     ▲
   │                     └── XLIFF 2.0 / tableur ⇄ traduction
   ▼
build : lecteur (TypeScript) + thème (design tokens) + composants
   ▼
QA : schéma · axe-core · clavier · Lighthouse · captures 11 langues (RTL/CJK)
     · faux LMS (reprise, suspend_data) · SCORM Cloud · Moodle · CATAPULT
   ▼
packaging : SCORM 1.2 | SCORM 2004 4e | cmi5 | xAPI | HTML5 web/hors ligne | PDF récap
   └── + rapport QA HTML par module
```

### 5.3 Choix techniques proposés (chacun fera l'objet d'un ADR au jalon concerné)

| Domaine | Proposition | Licence | Pourquoi |
|---|---|---|---|
| Langage, monorepo | TypeScript, pnpm workspaces, Node 22 | — | Typage du schéma, un seul langage du pipeline au lecteur |
| Lecteur (UI) | **Svelte 5** compilé, **à confirmer contre Preact** par un prototype au jalon 1 | MIT | Pas de framework lourd à l'exécution : bundle minimal, transitions natives |
| Build | Vite | MIT | Standard, rapide, build multi-cibles |
| Schéma | JSON Schema + validation Ajv | MIT | Versionnable, lisible par Claude, outillage mûr |
| Design tokens | Format W3C DTCG + Style Dictionary | Apache-2.0 | Plusieurs thèmes à partir d'un même jeu de composants |
| i18n | Catalogues ICU MessageFormat, XLIFF 2.0, propriétés CSS logiques, `dir` automatique | — | RTL sans feuille de style dupliquée ; pluriels corrects |
| Polices | Polices par écriture (famille Noto en secours : latin, arabe, CJK, coréen), sous-ensembles WOFF2 | OFL | Le poids des polices CJK impose le découpage en sous-ensembles |
| Tests | Playwright, axe-core, Lighthouse CI, Vitest | Apache-2.0 / MPL-2.0 / Apache-2.0 / MIT | Outils de développement uniquement : rien n'est embarqué dans les modules |

### 5.4 Barre de qualité chiffrée (fixée en phase 0, vérifiée à chaque build)

| Critère | Seuil | Vérification |
|---|---|---|
| Accessibilité automatique | **0 violation** axe-core (WCAG 2.2 A/AA) sur chaque écran, dans chaque langue | Playwright + axe |
| Lighthouse Accessibilité | **100** | Lighthouse CI |
| Clavier | Chaque interaction réalisable au clavier seul ; focus visible ; pas de piège | Scénarios Playwright par composant |
| Lecteurs d'écran | Check-list manuelle NVDA + VoiceOver par **composant** (pas par module) | Manuel, consigné dans le rapport |
| Sous-titres | 100 % des vidéos et audios ont des sous-titres WebVTT dans chaque langue | Vérification du schéma |
| Mouvement | Animations neutralisées sous `prefers-reduced-motion` | Test Playwright avec émulation |
| Performance mobile | Lighthouse Performance **≥ 90** (mobile, réseau 4G simulé) | Lighthouse CI |
| Core Web Vitals (labo) | LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 200 ms | Lighthouse CI |
| Poids du lecteur | JS ≤ **60 Ko** gzip · CSS ≤ 20 Ko gzip (hors médias et polices) | Budget de taille dans le build |
| Premier écran | ≤ **500 Ko** transférés avant interaction (médias inclus) | Lighthouse |
| Robustesse SCORM | 0 erreur SCORM Cloud ; reprise testée (quitter, revenir au même écran, mêmes réponses) | Faux LMS + API SCORM Cloud |
| État de reprise | ≤ **3 500 caractères** en SCORM 1.2 (marge sous 4 096) | Test du faux LMS sur le pire cas |
| Multilingue | Aucune chaîne en dur (lint) ; captures des 11 langues sans débordement ni troncature | Lint + comparaison de captures |
| Pédagogie | Check-list d'audit 100 % OK (objectifs mesurables, alignement, feedback par réponse…) | Contrôle du schéma + revue |

**Ce qui ne peut pas être automatisé, franchement :** les tests automatiques ne détectent qu'une
partie des problèmes WCAG (d'un tiers à un peu plus de la moitié selon les études et la façon de
compter). Le reste (pertinence des alternatives textuelles, ordre de lecture
logique, compréhensibilité) demande une revue humaine. Je propose donc une check-list par
composant, faite une fois et rejouée seulement quand le composant change, plutôt qu'une revue
complète par module.

### 5.5 Roadmap par jalons

| Jalon | Contenu | Critère de sortie |
|---|---|---|
| **J0 — Phase 0** | Ce document, ADR 0001 | Validation par Sam |
| **J1 — Fondations** | Monorepo ; schéma v0.1 ; lecteur ; thème par tokens ; i18n FR/EN/AR ; 4 composants (écran narratif, accordéon/onglets, QCU/QCM, récapitulatif) ; export **SCORM 1.2 + HTML5** ; banc QA v1 (axe, Lighthouse, faux LMS) | Un module de démo passe tout le banc et SCORM Cloud |
| **J2 — MVP** | Pipeline complet source → objectifs → **storyboard validé** → module ; composants : cartes à retourner, vrai/faux, appariement, texte à trous, timeline, flashcards ; banque de questions avec tirage aléatoire ; **SCORM 2004 4e** ; **11 langues** dont arabe, japonais, chinois, coréen ; XLIFF aller-retour ; rapport QA HTML ; test Moodle Docker | **Un vrai module client** (ou un contenu de test fourni par Sam) produit de bout en bout, livré et validé sur SCORM Cloud et Moodle |
| **J3 — Interactions avancées** | Glisser-déposer accessible, tri, hotspots, quiz sur image, scénarios à embranchements, simulation de conversation, vidéo interactive, certificat de fin, sous-titres SRT/WebVTT | Chaque composant passe sa check-list clavier et lecteur d'écran |
| **J4 — Design system** | Extraction du design system depuis tes inspirations (et Figma si installé) ; plusieurs thèmes ; galerie de composants | Même module rendu dans 3 thèmes sans toucher au contenu |
| **J5 — Formats et LMS** | cmi5 (CATAPULT), xAPI (SQL LRS), HTML5 hors ligne (PWA), PDF récapitulatif, profils LMS documentés | CATAPULT sans erreur ; profils validés au fil des clients |
| **J6 — À la demande** | LTI 1.3 (service hébergé), AICC | Seulement si un client le demande |

**MVP = fin du J2** : un module réel, multilingue (11 langues dont RTL et CJK), en SCORM 1.2 et
2004, conforme à la barre de qualité, produit à partir d'une source brute avec ta validation du
storyboard.

### 5.6 Exigences irréalistes ou à reformuler (franchement)
- **« Supérieur sur tout »** : nous serons supérieurs sur la qualité du rendu, le multilingue, l'accessibilité, la performance et la robustesse LMS. Nous ne le serons **pas** sur l'édition visuelle par des non-développeurs, qui n'est pas ton besoin.
- **LTI 1.3** n'est pas un format d'export : c'est un service à héberger et maintenir (serveur, clés, disponibilité). Je le repousse au J6, sauf besoin client.
- **Traduction en 11 langues** : la traduction par Claude est de bonne qualité, mais pour un livrable client je recommande une **relecture native**, au moins pour les langues que tu ne lis pas. Le flux XLIFF est fait pour ça.
- **« Testé sur 3 LMS »** : sans accès aux LMS d'entreprise, les profils Cornerstone, SuccessFactors et Docebo reposent sur la documentation et les retours terrain. Ils se fiabiliseront avec les sandboxes clients.

---

## 6. Ce que j'attends de toi pour passer au J1
Voir [`requests-for-sam.md`](requests-for-sam.md). En résumé :
1. **Valider ou amender** ce document et l'ADR 0001 (moteur propre).
2. Confirmer les **deux hypothèses** du §0 (confidentialité, contraintes IT).
3. Installer **Context7** (P1). Figma seulement si tu travailles dans Figma.
4. Créer un **compte SCORM Cloud** (essai gratuit) et me fournir la clé API, comme **secret de l'environnement**, jamais dans le dépôt.
5. Déposer des **inspirations** et, si possible, **un contenu de test non confidentiel** pour le module de démo.
