# 0003 — Framework du lecteur : Svelte 5

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
Le lecteur est le code embarqué dans **chaque** module livré. Budget fixé en phase 0 :
JS ≤ 60 Ko et CSS ≤ 20 Ko en gzip. Exigences : accessibilité WCAG 2.2 AA, micro-animations
sobres respectant `prefers-reduced-motion`, styles isolés par composant (thèmes multiples),
licence permissive (ADR 0001).

## Prototype
La même mini-application a été écrite dans les deux frameworks : navigation entre écrans, liste
avec clé, accordéon avec état, rendu conditionnel, `aria-expanded`. Build Vite 8, IIFE minifié.

| | Svelte 5.57.2 | Preact 11.0.1 |
|---|---|---|
| JS gzip | **13,3 Ko** | **5,7 Ko** |
| Styles isolés par composant | Natifs (`<style>` compilé) | À ajouter (CSS Modules ou conventions) |
| Transitions et animations | Natives (`svelte/transition`), simples à couper sous `prefers-reduced-motion` | À écrire à la main ou via une bibliothèque |
| Contrôles d'accessibilité à la compilation | **Oui** : rôles ARIA invalides, gestionnaires clavier manquants, `alt` absents… | Non (seulement via un lint séparé) |
| Licence | MIT | MIT |

## Décision
**Svelte 5.** L'écart de 7,6 Ko gzip est réel, mais il laisse une marge de plus de 45 Ko sous le
budget de 60 Ko. En échange, on obtient trois choses qui servent directement la barre de
qualité :
1. Les **avertissements d'accessibilité du compilateur**, configurés pour **faire échouer le build**.
2. Des **styles isolés** sans outillage supplémentaire.
3. Des **transitions natives**, faciles à neutraliser sous `prefers-reduced-motion`.

Le poids réel du lecteur sera mesuré à chaque build (étape 6, budget de taille). Si on approche
du budget, Preact reste l'alternative documentée ici.

## Conséquences
- Composants en `.svelte` (runes Svelte 5), logique pure en TypeScript testée par Vitest.
- Build du lecteur avec Vite en **IIFE** (script classique, pas de module ES). Raison : un module ES ne se charge pas depuis `file://`, ce qui casserait l'HTML5 hors ligne et certains lecteurs LMS.
- Le contenu du module est **inséré dans `index.html`** (balise `<script type="application/json">`), pour la même raison : pas de `fetch` nécessaire.
- Thème v1 : variables CSS (`themes/*.css`). La conversion depuis des tokens au format W3C DTCG arrivera avec l'extraction du design system (J4).
- Polices auto-hébergées via Fontsource (paquets MIT, polices OFL-1.1) : Fraunces (titres), Inter (texte), Noto Sans Arabic (arabe). Le découpage par `unicode-range` ne télécharge que les sous-ensembles utilisés.

## Sources
- Mesures : prototypes dans le répertoire de travail de la session, avec Vite 8.3.4 et minification par défaut.
- [Svelte — accessibility warnings](https://svelte.dev/docs/svelte/compiler-warnings)
- [Preact](https://preactjs.com/)
- [Fontsource](https://fontsource.org/) : licences des polices indiquées par paquet
