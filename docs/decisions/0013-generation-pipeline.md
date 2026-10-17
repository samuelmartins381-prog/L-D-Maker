# 0013 — Pipeline de génération : sources → storyboard validé → module

- **Statut** : accepté (plan validé par Sam le 2026-10-17)
- **Date** : 2026-10-17
- **Décideur** : Claude

## Contexte
Le brief demande de produire un module complet à partir de sources (PDF, PPTX, DOCX, texte), avec
un **storyboard validé par Sam** avant la rédaction. Il faut que chaque étape soit reproductible,
vérifiable et traçable, et qu'aucun contenu ne sorte de nulle part.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Rédiger le module directement | Rapide | Pas de porte de validation, pas de traçabilité, contenu inventé possible | — |
| Outils externes (markitdown, pandoc, pdfplumber) | Déjà éprouvés | Python et pandoc à installer chez Sam et Kylian ; pandoc est sous GPL | MIT, GPL-2.0, MIT |
| **Lecteurs JavaScript + storyboard structuré + porte par empreinte** | Tourne partout où tourne Node (dont l'application Electron, ADR 0014) ; ancres de traçabilité ; contrôles automatiques | Lecteurs à maintenir nous-mêmes (DOCX, PPTX) | Apache-2.0 (pdf.js), code maison |

## Décision
**Un projet = un dossier** (`project.yaml`, `sources/`, `ingest/`, `storyboard.yaml`,
`review/`, `module/`), outillé par `packages/generator` (`pnpm gen …`).

1. **Lecture des sources** (`ingest.ts`, `readers/`) :
   - PDF avec **pdf.js** (`pdfjs-dist`, Apache-2.0) : titres repérés par la taille de police,
     images extraites en PNG (encodeur maison sur `fflate`) ;
   - DOCX et PPTX : lecteurs maison sur l'archive OOXML (titres d'après le *nom* du style, donc
     quelle que soit la langue de Word ; listes, gras, tableaux, images, notes des diapositives) ;
   - pages sans texte (PDF scanné, schéma pleine page) marquées `no-text`, pour une lecture par
     Claude en vision (ADR 0015).
   Les essais avec markitdown, pandoc et pdfplumber ont servi de référence : mêmes ancres sur les
   sources de démonstration. `mammoth` (DOCX) est écarté : ses dépendances ont des licences
   ambiguës (`duck` : « BSD » sans version).
2. **Ancres de traçabilité** : `<!-- src:<fichier>#p3 | #slide-5 | #h-<titre> -->`. Chaque bloc du
   storyboard cite au moins une ancre existante ; sinon le contrôle échoue.
3. **Storyboard** (`storyboard.ts`, schéma Zod) : objectifs (Bloom), sections, écrans, blocs
   prévus (intention, contenu, médias, objectifs, sources, réponses et idées reçues visées).
   Contrôles : alignement objectifs ↔ questions notées (au moins 3 par objectif), au moins une
   erreur tolérée par le seuil, question textuelle à côté de toute question sur image, exemple
   travaillé avant l'entraînement, routine d'autorégulation, durée (±25 %).
4. **Page de revue** (`review.ts`) : autonome, lisible sur téléphone, extraits des sources.
5. **Porte de Sam** : `gen approve` enregistre l'empreinte sha256 du storyboard ; `gen check` et
   `gen build` refusent un storyboard modifié depuis.
6. **Conformité** (`conform.ts`) : le module reprend exactement objectifs, écrans et blocs du
   storyboard approuvé.

## Conséquences
- Plus aucun programme externe pour lire les sources : le Studio s'installe seul.
- Les règles de l'audit pédagogique sont des contrôles, pas des recommandations.
- Une source sans couche texte n'est pas « lue » en silence : elle est signalée.

## Sources
- pdf.js : https://github.com/mozilla/pdf.js (Apache-2.0)
- ECMA-376 (Office Open XML) : https://ecma-international.org/publications-and-standards/standards/ecma-376/
- Audit pédagogique : `docs/audits/`
