# 0009 — Zoom sur image (visionneuse plein écran)

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
En horlogerie, une partie de l'apprentissage est visuelle et se joue dans les détails : finitions
(côtes de Genève, perlage, anglage), état d'une pièce, marquages. Une photo affichée dans la largeur
d'un texte ne suffit pas, surtout sur mobile. C'est vrai aussi pour un schéma technique ou une
capture d'écran logicielle.

Exigences :
- WCAG 2.2 AA :
  - clavier (2.1.1) ;
  - focus jamais masqué (2.4.11) ;
  - cibles d'au moins 24 px (2.5.8) ;
  - gestes à plusieurs doigts doublés d'une alternative à un seul pointeur (2.5.1) ;
  - glissement doublé d'une alternative sans glisser (2.5.7).
- Mobile, RTL, `file://`, aucune dépendance lourde.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| PhotoSwipe 5 | Très abouti (gestes, animations) | ~15 Ko gzip pour un seul composant ; conçu pour des galeries ; personnalisation de l'accessibilité et de l'i18n à refaire | MIT |
| Loupe au survol | Simple | Inutilisable au doigt et au clavier | — |
| Laisser le zoom du navigateur | Rien à coder | Zoome toute la page et casse la mise en page ; geste peu connu ; rien au clavier | — |
| **Visionneuse maison sur `<dialog>` natif** | ~1,7 Ko gzip ; accessibilité et i18n du lecteur ; défilement natif pour se déplacer | Gestes à écrire et tester nous-mêmes | — |

## Décision
**Visionneuse maison, basée sur `<dialog>` + `showModal()`.**
- **Ouverture :** bouton rond « Agrandir l'image » sur l'image (44 px, disque encre et anneau clair
  comme les repères de l'ADR 0008), avec `aria-haspopup="dialog"`.
- **Ce que fournit le navigateur :** dialogue nommé, fond rendu inerte, piège du focus, Échap.
  Le focus revient au bouton à la fermeture, ce qui est aussi codé explicitement par sécurité.
- **Se déplacer = défilement natif** d'une zone `overflow: auto` :
  - doigt, molette, barres de défilement ;
  - flèches du clavier une fois la zone focalisée (`tabindex="0"`, nommée ; seul
    `svelte-ignore` du projet, justifié dans le code) ;
  - en plus, glisser à la souris.
- **Zoomer :**
  - boutons − / + / Ajuster (alternative à un seul pointeur, 2.5.1 et 2.5.7) ;
  - touches + − 0 ;
  - pincement à deux doigts (`touch-action: pan-x pan-y` : le navigateur garde le défilement à un
    doigt, nous gérons le pincement) ;
  - Ctrl + molette, et pincement du pavé tactile ;
  - double-clic (bascule 100 % ↔ 250 %).
  - Le point visé reste immobile. Paliers ×1,5, de 100 % (image ajustée à l'écran) à 400 %.
- **Niveau de zoom :** annoncé par un `<output aria-live="polite">`.
- **Sens de l'image :** la zone de l'image est en `dir="ltr"`, car ses coordonnées sont
  physiques ; les commandes suivent le sens de la langue.
- **Format :**
  - `media: { kind: image, …, zoom: true }` sur le bloc narratif ;
  - `zoomSrc` facultatif : fichier haute définition chargé seulement à l'ouverture, ce qui allège
    la page ;
  - le validateur refuse `zoomSrc` sans `zoom`, une image décorative zoomable et un fichier
    absent.
- **Interface :** 9 textes, dans les 11 langues.

**Banc QA (complément à l'ADR 0005)**
- Troisième état « zoom ouvert » sur chaque écran qui a une image zoomable : visionneuse ouverte
  et zoomée, puis axe, débordement, parcours au clavier et mouvement.
- Avec une fenêtre modale ouverte, le parcours clavier part de la fenêtre et ne compte que ses
  contrôles. C'est justifié : le navigateur refuse le focus au reste de la page, rendu inerte
  volontairement.

## Conséquences
- **Mesures :**
  - banc : 374 pages (dont 22 vues de zoom), 0 violation, 2 618 arrêts de tabulation vérifiés ;
  - JS 29,7 Ko gzip (+1,7 Ko).
- **Défaut existant trouvé par le nouveau banc et corrigé :** au focus, le lien d'évitement
  recouvrait le sélecteur de langue en russe (libellé long). Il s'affiche désormais dans le flux,
  au-dessus de l'en-tête (modèle GOV.UK).
- **Limites :**
  - pas encore de zoom sur l'image à repères (les repères devraient suivre le zoom) ;
  - pas de galerie (image suivante et précédente) ;
  - pas d'animation d'ouverture.
- **Vérification manuelle :** à faire avec NVDA et VoiceOver (check-list du banc).

## Sources
- HTML, élément `dialog` et `showModal()` : https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element
- WAI-ARIA APG, Dialog (Modal) pattern : https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WCAG 2.2, 2.5.1 Pointer Gestures : https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures
- WCAG 2.2, 2.5.7 Dragging Movements : https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- axe-core, règle `scrollable-region-focusable` : https://dequeuniversity.com/rules/axe/4.10/scrollable-region-focusable
- MDN, `touch-action` : https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- GOV.UK Design System, Skip link : https://design-system.service.gov.uk/components/skip-link/
- PhotoSwipe (option écartée) : https://photoswipe.com/
