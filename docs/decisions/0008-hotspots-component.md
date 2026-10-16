# 0008 — Image à repères (hotspots)

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
Le domaine principal de Sam est l'horlogerie (CLAUDE.md) : mouvements, vues éclatées, détails de
finition. Le composant le plus demandé est donc une image sur laquelle on explore des zones (« ceci
est le spiral »). Il sert aussi à toute formation produit ou technique : poste de travail, tableau
de bord, écran logiciel, e-mail.

Exigences : WCAG 2.2 AA, clavier, lecteurs d'écran, mobile, RTL, 11 langues, aucun texte figé dans
le composant.

Points faibles constatés chez les concurrents :
- **Storyline :** repères sans nom accessible par défaut, et contenu en calque superposé.
- **Rise (« labeled graphic ») :** bulles au-dessus de l'image, qui la masquent sur mobile.
- **Adapt (« hotgraphic ») :** bascule vers une liste sur mobile ; la carte n'est plus visible
  sur petit écran.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Bulle (popover) près du repère | Familier | Masque l'image ; illisible sur mobile ; positionnement près des bords fragile ; focus à gérer | — |
| Fenêtre modale par repère | Place pour du texte long | Coupe la vue de l'image ; une fenêtre par repère alourdit le parcours | — |
| Liste sur mobile, carte sur grand écran | Lisible | Deux interfaces à maintenir ; perd l'image, qui est le but | — |
| **Repères = boutons ; un panneau d'explication sous l'image** | Image toujours visible ; même interface partout ; motif APG « disclosure » | L'explication est sous l'image, pas à côté du repère | — |

## Décision
**Repères = vrais `<button>` ; une explication à la fois, dans un panneau sous l'image.**
- **Repères :** numérotés, dans l'ordre du YAML, qui est aussi l'ordre de tabulation.
  - Nom accessible : le titre du repère (texte masqué), le numéro étant `aria-hidden`.
  - `aria-expanded` et `aria-controls` vers le panneau (motif APG « disclosure »). Un second appui
    referme le panneau.
- **Panneau :** région `aria-live="polite"`, donc l'explication est annoncée à l'ouverture
  (WCAG 4.1.3). Sans repère ouvert, il affiche la consigne.
  - Les titres prennent le niveau h2 ou h3 selon la présence d'un titre de bloc, comme pour
    l'accordéon.
- **Compteur :** « n sur N exploré(s) » sous l'image. Les repères déjà vus changent de teinte.
  Cet état est conservé dans le `Player` pendant la session (créé dans le constructeur), mais
  n'est pas envoyé au LMS.
- **Lisibilité sur toute image :**
  - disque encre, anneau clair et ombre : contraste ≥ 3:1 sur n'importe quel fond (WCAG 1.4.11) ;
  - 36 px, ou 30 px sous 480 px de large : au-dessus du minimum de 24 px (WCAG 2.5.8).
- **Coordonnées :** `x`, `y` en % de l'image, depuis le coin haut gauche. L'image n'est pas
  inversée en RTL, donc le repère non plus : le lecteur place `inset-inline-start` à `100 - x` en
  RTL, ce qui garde les propriétés logiques du thème.
- **Format :**
  - bloc `hotspots` avec `image.src`, `image.alt` (obligatoire), `intro` facultatif et 2 à 12
    `items` (`id`, `x`, `y`, `title`, `body`) ;
  - le validateur vérifie le fichier, les identifiants et les textes ;
  - il avertit (`hotspot-overlap`) si deux repères sont à moins de 7 % l'un de l'autre, car ils se
    chevaucheraient sur un téléphone.
- **Traduction :** dans le XLIFF, les textes ont le contexte « image with numbered markers:
  marker N title/content ». Une image ne devrait contenir que du texte invariable (adresses, codes,
  références) : le reste se dessine en formes neutres, ou l'image est déclinée par langue (plus
  tard).
- **Banc QA :** l'état « après interaction » ouvre tous les repères ; l'e2e vérifie les noms, le
  panneau, le compteur et la conservation de l'état « exploré ». Les fichiers de `media/` sont
  exclus de Biome : ce sont des contenus, pas du code.

## Conséquences
- **Module de démo :** nouvel écran « Anatomie d'un message » (4 repères sur une maquette SVG
  dessinée pour le projet, sans ressource tierce).
- **Mesures :** banc 352 pages, 0 violation axe, aucun débordement ; JS 28,0 Ko gzip (+0,7 Ko).
- **Limites de cette première version :**
  - pas de zoom (étape suivante) ;
  - pas de zones en forme libre, seulement des points ;
  - pas de variante notée « identifie la pièce » (prévue : même placement, logique de question
    à choix unique de `grading.ts`).
- **Vérification manuelle :** à faire avec NVDA et VoiceOver (contrôle manuel du banc, check-list
  mise à jour).

## Sources
- WAI-ARIA APG, Disclosure pattern : https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
- WCAG 2.2, 1.4.11 Non-text Contrast : https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast
- WCAG 2.2, 2.5.8 Target Size (Minimum) : https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- WCAG 2.2, 4.1.3 Status Messages : https://www.w3.org/WAI/WCAG22/Understanding/status-messages
- Adapt, composant hotgraphic (comportement mobile) : https://github.com/adaptlearning/adapt-contrib-hotgraphic
- Articulate, accessibilité de Rise (labeled graphic) : https://articulate.com/support/article/Rise-360-Accessibility-Conformance-Report
