# 0010 — Question « identifie la pièce » (variante hotspot)

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
L'image à repères (ADR 0008) fait explorer ; il faut aussi pouvoir **évaluer** la reconnaissance
visuelle : « Cliquez sur l'échappement », « Où lisez-vous le vrai domaine ? ». En horlogerie, c'est
l'évaluation naturelle des objectifs de type « identifier les organes d'un mouvement ». La réponse
doit être notée et remontée au LMS comme les autres questions.

Difficulté propre à ce type de question : avant la réponse, un repère ne peut pas porter le nom de
la pièce, sinon la question se répond toute seule pour un lecteur d'écran.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Clic libre sur l'image + zones de tolérance (Storyline) | Le plus proche du geste réel | Impossible au clavier ; aucun nom accessible ; tolérance arbitraire selon l'écran | — |
| Nouveau type de bloc indépendant | Liberté totale | Duplique notation, essais, mélange, feedback et suivi SCORM | — |
| **Variante `hotspot` de la question existante : repères = boutons radio natifs placés sur l'image** | Toute la logique est réutilisée (`grading.ts`, essais, ordre figé, interactions SCORM) ; clavier natif (flèches, « 2 sur 4 ») | Repères prédéfinis (pas de clic libre) | — |

## Décision
**Variante `variant: hotspot` de la question à choix unique.**
- **Format :**
  - `image: { src, alt }` (l'alt décrit l'image sans donner la réponse) ;
  - `x`, `y` en % sur chaque choix (mêmes conventions que l'ADR 0008, non inversées en RTL) ;
  - exactement une bonne réponse.
- **Validateur :**
  - refuse une image absente, des positions manquantes, des positions sur une autre variante ;
  - signale les repères trop proches (`hotspot-overlap`).
- **Affichage :** chaque repère est un `<input type="radio">` natif mis en forme en pastille
  numérotée (`appearance: none`) ; le chiffre est dessiné par-dessus, transparent au pointeur.
- **Accessibilité :**
  - **nom accessible « Repère n »** jusqu'à la réponse ;
  - après validation, la liste sous l'image associe chaque numéro à son nom et à son explication,
    reliée au repère par `aria-describedby` ;
  - ✓ / ✕ dans la pastille : l'information ne passe pas que par la couleur.
- **Feedback :** règles de l'ADR 0002.
  - Erreur avec essais restants : seul le repère choisi est expliqué.
  - Réponse finale : tout est expliqué, et le corrigé est affiché.
- **Exception WCAG 1.1.1 (« test qui serait invalide en texte ») :** une identification visuelle
  ne peut pas avoir d'équivalent textuel sans donner la réponse. Pour qu'aucun apprenant ne soit
  bloqué, le validateur avertit (`visual-only-assessment`) quand un objectif n'est évalué **que**
  par des questions hotspot notées : il faut au moins une question textuelle notée sur le même
  objectif.

## Conséquences
- **Module de démo :** question d'entraînement « Sur cette page, quel élément vous indique
  réellement sur quel site vous êtes ? ». Les 4 repères sont le cadenas, le domaine, le logo et le
  bouton ; les distracteurs reposent sur des idées reçues réelles (le cadenas prouverait
  l'authenticité).
- **Mesures :**
  - banc : 374 pages, 0 violation axe, 2 640 arrêts de tabulation ;
  - e2e : noms neutres, feedback partiel puis complet ;
  - JS 30,2 Ko gzip (+0,5 Ko).
- **Limites :**
  - pas de clic libre ni de zone de tolérance ;
  - pas de choix multiple sur image (« toutes les pièces en acier ») ;
  - pas de zoom pendant la question.
  - À ajouter si un contenu réel le demande.

## Sources
- WCAG 2.2, 1.1.1 Non-text Content (exception « test or exercise ») : https://www.w3.org/WAI/WCAG22/Understanding/non-text-content
- WAI-ARIA APG, Radio Group pattern : https://www.w3.org/WAI/ARIA/apg/patterns/radio/
- WCAG 2.2, 1.4.1 Use of Color : https://www.w3.org/WAI/WCAG22/Understanding/use-of-color
- ADL, SCORM 2004 RTE, `cmi.interactions.n.type` (choice) : https://adlnet.gov/projects/scorm/
