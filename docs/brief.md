# Brief — Studio de création de formations e-learning

_Transcription du brief PDF fourni par Sam le 2026-10-15._

## 1. Mission
Tu vas concevoir et construire un **générateur de modules e-learning tout-en-un** : à partir d'un contenu source (texte, PDF, PPTX, DOCX, vidéo, brief), il produit un module complet — pédagogie, design, interactions, évaluation, multilingue — exportable vers **n'importe quel LMS**.

Ambition : une qualité **supérieure aux meilleurs outils du marché** (Articulate Rise et Storyline, Elucidat, Evolve, Adapt Learning, iSpring, Genially, 7taps…). « Supérieur » n'est pas un slogan : tu le traduis en critères mesurables (section 5) et tu le prouves à chaque build.

## 2. Comment on travaille ensemble
- **Tu pilotes. Je suis à ton service** : je fournis designs, inspirations, contenus de test, accès, retours, et j'installe ce que tu demandes.
- **Tu décides sur la base de recherches, pas d'intuitions** : GitHub, documentation officielle (ADL, 1EdTech/IMS), forums (E-Learning Heroes, r/instructionaldesign, communauté Adapt, forums Moodle), issues GitHub des projets concernés.
- **Avant chaque phase** : recherche → recommandation argumentée (options, compromis, ton choix) → tu m'attends si la décision m'appartient.
- **MCP, skills, plugins** : tu ne les installes jamais toi-même. Tu me fais une demande d'installation : quoi, pourquoi, alternatives écartées, risques (permissions, données). J'installe, puis tu vérifies que ça fonctionne.
- **Mémoire du projet**, tenue à jour en continu :
  - `CLAUDE.md` — contexte, conventions, état d'avancement
  - `docs/decisions/` — un ADR par décision structurante
  - `docs/requests-for-sam.md` — ce que tu attends de moi, priorisé
- **Inspirations** : je dépose captures, maquettes et liens dans `inspirations/`. Analyse-les et extrais ce qui fait leur qualité (structure, rythme, typographie, interactions) avant de concevoir le design system.
- Mode plan pour toute tâche structurante. Commits petits et fréquents.

## 3. Phase 0 — Recherche (livrable avant toute ligne de code)
1. **Benchmark** des outils leaders : ce qu'ils font de mieux, et surtout leurs limites récurrentes (lis les plaintes sur les forums — c'est là que se trouve l'opportunité).
2. **État de l'art technique** : SCORM 1.2, SCORM 2004 4e édition, xAPI, cmi5, LTI 1.3, AICC (legacy) ; runtimes et wrappers JS open source (ex. scorm-again), framework Adapt Learning, outils de validation de packages.
3. **Décision clé** : construire sur une base existante (ex. étendre Adapt) ou partir de zéro ? Argumente avec un ADR.
4. **MCP / skills / plugins recommandés**, classés par priorité et justifiés (ex. pistes à évaluer : automatisation navigateur pour les tests, accès à la doc à jour des bibliothèques, Figma pour mes maquettes, GitHub).
5. **Architecture et roadmap** par jalons, avec un MVP clair.

→ Livrable : `docs/phase0-research.md`. **Ensuite tu t'arrêtes et tu m'attends.**

## 4. Exigences fonctionnelles

### Entrées
- Brief texte, PDF, PPTX, DOCX, transcriptions vidéo, URL.
- Mes designs et inspirations → extraction d'un **design system réutilisable** (tokens couleurs, typographie, espacements, composants), plusieurs thèmes possibles.

### Pipeline de génération
Source → objectifs pédagogiques → **storyboard (que je valide)** → contenu structuré (JSON/YAML conforme à un schéma versionné) → rendu → QA automatique → packaging.

Le **contenu est séparé du rendu** : un même module doit pouvoir changer de thème, de langue ou de format d'export sans réécriture.

### Bibliothèque d'interactions (minimum)
Écrans narratifs, cartes à retourner, onglets et accordéons, timelines, hotspots sur image, glisser-déposer, tri et classement, scénarios à embranchements, simulations de conversation (vente, relation client), vidéo interactive, flashcards, quiz (QCU, QCM, vrai/faux, appariement, texte à trous, quiz sur image), récapitulatif et certificat de fin.

### Pédagogie
Fondée sur la recherche : objectifs mesurables, alignement objectifs ↔ activités ↔ évaluation, pratique de récupération, feedback explicatif par réponse, scénarios ancrés dans des situations réelles, charge cognitive maîtrisée, format micro-learning possible, banques de questions avec tirage aléatoire.

### Multilingue (critique)
- 11 langues ou plus par module, y compris écritures non latines (japonais, chinois, coréen…) et RTL (arabe).
- Export/import pour la traduction (XLIFF et/ou tableur), sous-titres SRT et WebVTT.
- Gestion de l'expansion de texte, polices adaptées à chaque écriture, aucune chaîne codée en dur.

### Exports
- SCORM 1.2, SCORM 2004 4e éd., xAPI, cmi5, HTML5 autonome (web et hors ligne) ; LTI 1.3 et PDF récapitulatif si pertinent.
- Suivi : complétion, score, temps passé, statut de réussite, reprise de session (bookmarking).

### Compatibilité LMS
Testé au minimum sur SCORM Cloud (référence), Moodle (instance Docker locale) et un autre LMS courant. Documente les particularités connues des grands LMS d'entreprise (Cornerstone, SAP SuccessFactors, Docebo, 360Learning, etc. — vérifie lesquels comptent).

## 5. Barre de qualité — la définition de « supérieur »
- **Accessibilité** : WCAG 2.2 AA minimum, navigation clavier complète, compatibilité lecteurs d'écran, contrastes, sous-titres systématiques.
- **Performance** : mobile-first, poids maîtrisé, chargement rapide en 4G ; seuils chiffrés (ex. Lighthouse) fixés en phase 0.
- **Design** : niveau premium / luxe — typographie soignée, micro-animations sobres, respect de `prefers-reduced-motion`, cohérence totale avec le design system. Aucun rendu « template générique ».
- **Robustesse** : tout package exporté passe SCORM Cloud sans erreur ; reprise de session fiable.
- **Pédagogie** : chaque module passe une check-list d'audit avant export.
- **Preuve** : un banc de test automatisé vérifie ces critères à chaque build et génère un rapport QA par module.

## 6. Règles
- Jamais d'installation de MCP, skill ou dépendance lourde sans mon accord.
- Aucun contenu confidentiel (employeur, clients) dans un dépôt public ni envoyé à un service tiers sans mon accord explicite.
- Licences compatibles avec un usage commercial uniquement ; licence notée dans l'ADR concerné.
- Si une exigence est irréaliste ou si tu bloques, dis-le franchement et propose une alternative.

## 7. Pour démarrer
1. Lis ce brief, crée `CLAUDE.md` et la structure du dépôt.
2. Pose-moi **au maximum 5 questions de cadrage** essentielles (LMS de destination, contraintes IT, budget pour des outils payants, etc.).
3. Lance la phase 0.
