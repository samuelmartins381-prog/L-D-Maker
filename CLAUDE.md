# L-D-Maker — Studio de création de formations e-learning

## Contexte
Générateur de modules e-learning tout-en-un : à partir d'un contenu source (texte, PDF, PPTX,
DOCX, transcription vidéo, URL), produire un module complet (pédagogie, design, interactions,
évaluation, multilingue) exportable vers n'importe quel LMS (SCORM 1.2, SCORM 2004 4e éd.,
xAPI, cmi5, HTML5 autonome, LTI 1.3).
Ambition : qualité supérieure à Rise, Storyline, Elucidat, Evolve, Adapt, iSpring, Genially,
7taps — prouvée par des critères mesurables vérifiés à chaque build (brief §5).

Brief complet : `docs/brief.md`.

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
docs/phase0-research.md   livrable phase 0 (à venir)
inspirations/             captures, maquettes, liens déposés par Sam
```
La structure du code sera définie par l'ADR d'architecture issu de la phase 0.

## État d'avancement
- [x] Lecture du brief, création de CLAUDE.md et de la structure
- [ ] Questions de cadrage (≤ 5) — en attente des réponses de Sam
- [ ] Phase 0 — recherche → `docs/phase0-research.md`, puis arrêt et attente de Sam
