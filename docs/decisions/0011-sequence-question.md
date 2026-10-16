# 0011 — Question de remise en ordre (variante sequence)

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
En horlogerie, beaucoup de savoirs sont des procédures : démontage, réglage, contrôle, service. Il
faut pouvoir évaluer l'ordre des étapes, le noter et le remonter au LMS.

Le format habituel, le glisser-déposer, est mal accessible :
- inutilisable au clavier sans mode dédié ;
- difficile au doigt sur une longue liste ;
- WCAG 2.2, 2.5.7 (« Dragging Movements ») exige une alternative à un seul pointeur sans
  glissement.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Glisser-déposer (SortableJS, dnd-kit…) | Geste familier | Clavier et lecteurs d'écran à refaire ; alternative 2.5.7 nécessaire de toute façon ; dépendance | MIT |
| Listes déroulantes « position n » par étape | Natif | Doublons de positions à gérer ; lourd à 6 étapes ou plus | — |
| **Boutons Monter / Descendre par étape** | Même geste au clavier, au doigt, à la souris ; conforme 2.5.7 sans mode spécial ; aucune dépendance | Plusieurs appuis pour déplacer loin (listes de 3 à 8 étapes : acceptable) | — |

## Décision
**Variante `variant: sequence` de la question.**
- **Format :**
  - l'ordre des `choices` dans le YAML **est** la réponse : pas de `correct` ;
  - un `feedback` par étape, qui explique sa place.
- **Validateur :**
  - refuse `correct` sur une étape, `shuffle: false` (la question s'afficherait résolue) et moins
    de 3 étapes ;
  - `correct` reste obligatoire pour les autres variantes (vérifié par le validateur, plus par le
    schéma).
- **Notation (`grading.ts`) :**
  - la sélection est l'ordre de l'apprenant ;
  - un mélange qui tomberait sur la bonne réponse est décalé d'un cran ;
  - tout ou rien (ADR 0002) ;
  - `move()` ; tout déplacement après une erreur ouvre un nouvel essai.
- **Affichage (`SequenceSteps.svelte`) :**
  - liste ordonnée ; deux boutons de 44 px par étape, nommés « Monter : <étape> » et
    « Descendre : <étape> » ;
  - chaque déplacement est annoncé (« … est maintenant en position 2 sur 4 ») ;
  - le focus suit l'étape déplacée (l'autre bouton prend le relais en bout de liste) ;
  - animation `flip`, désactivée si le mouvement est réduit.
- **Feedback :**
  - après une erreur : « n étapes sur N à la bonne place », sans dire lesquelles ;
  - en fin de question : le bon ordre, la position choisie par l'apprenant pour chaque étape (✓ ou
    ✕, pas seulement la couleur) et l'explication de chacune.
- **Suivi :** interaction SCORM de type `sequencing`, réponse dans l'ordre de l'apprenant, en 1.2
  et en 2004 (`Interaction.type`). Le banc la fait jouer et le faux LMS l'accepte.

**Défauts trouvés en chemin et corrigés :**
- **Repères (ADR 0008 et 0010) :** tant que l'image n'est pas chargée, sa hauteur est nulle et les
  repères s'empilaient en haut. Ils restent maintenant masqués jusqu'au chargement. Trouvé par la
  règle axe `target-size`, de façon intermittente.
- **Banc :** coche par clic sur l'élément après une erreur, car le décalage de mise en page
  faisait tomber un clic par coordonnées sur la case voisine.
- **Performance :** le LCP du banc a dépassé le seuil, ce qui a conduit à l'ADR 0012
  (pré-rendu du premier écran).

## Conséquences
- **Module de démo :** écran « Vérifier un lien », question d'entraînement en 4 étapes à l'ordre
  logiquement contraint (on ne lit l'adresse qu'après le survol), donc pas d'ordre discutable.
- **Mesures :**
  - banc : 418 pages, 0 violation axe, 3 014 arrêts de tabulation ;
  - JS 32,1 Ko gzip (+1,8 Ko, dont l'animation `flip`) ;
  - tests unitaires (notation, validateur, SCORM 1.2 et 2004) et e2e (noms, annonce, focus,
    notation).
- **Limites :**
  - pas de glisser-déposer en complément ;
  - pas de crédit partiel ;
  - pas d'étapes illustrées (image par étape), à ajouter pour des procédures d'atelier.

## Sources
- WCAG 2.2, 2.5.7 Dragging Movements : https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- WCAG 2.2, 4.1.3 Status Messages : https://www.w3.org/WAI/WCAG22/Understanding/status-messages
- ADL, SCORM 2004 4th Ed. RTE, `cmi.interactions.n.type` (sequencing) et format des réponses : https://adlnet.gov/projects/scorm/
- Salesforce UX, « 4 Major Patterns for Accessible Drag and Drop » : https://medium.com/salesforce-ux/4-major-patterns-for-accessible-drag-and-drop-1d43f64ebf09
