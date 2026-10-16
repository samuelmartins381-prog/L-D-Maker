# 0012 — Pré-rendu du premier écran

- **Statut** : accepté (plan validé par Sam le 2026-10-16)
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
Le lecteur (ADR 0003) construisait tout l'écran en JavaScript : rien ne s'affichait avant le
téléchargement et l'exécution du script (95 Ko non compressés). En ajoutant la question de remise
en ordre (étape 4d), le banc QA a dépassé le seuil de LCP (2,5 s) : 2,45 à 2,65 s en Lighthouse
simulé. Le script y était classé « bloquant le rendu », pour 1,65 s. Chaque nouveau composant
alourdit ce script, et un vrai module, plus long, aurait le même problème.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Baisser le seuil ou mesurer avec compression | Rien à coder | Interdit par nos règles : on corrige, on ne baisse pas le seuil | — |
| `defer` seul | Une ligne | Mesuré : aucun gain, puisqu'il n'y a rien à afficher avant le script | — |
| Pré-rendu + hydratation Svelte | Pas de remplacement du DOM | Décalages assurés : ordre des choix tiré au hasard, langue et reprise connues seulement dans le navigateur | MIT (Svelte) |
| **Pré-rendu + remplacement, script en `defer`** | Premier écran affiché dès l'arrivée du HTML et du CSS ; aucun décalage possible | HTML un peu plus lourd (+4 Ko) ; le premier écran est rendu deux fois | MIT (Svelte) |

## Décision
**Au build, le premier écran est rendu en HTML (`svelte/server`) et inséré dans `index.html` ; au
chargement, le lecteur le remplace par l'écran interactif.**
- **Rendu au build :** deuxième build du lecteur, `vite build --ssr src/prerender.ts`, vers
  `dist-ssr/prerender.js` (module ES autonome).
  - Le builder l'appelle avec le contenu compilé, dans la langue par défaut, à l'écran 1.
  - Les hachages de classes CSS de Svelte sont déterministes : le HTML pré-rendu utilise la
    feuille de style du client.
- **Dans la page :**
  - le pré-rendu est placé dans `<div id="ldm-app" inert data-prerender>` : pas de clic « mort »
    avant que le script soit prêt ;
  - le script du lecteur est en `<head>` avec `defer` : il n'empêche plus le premier affichage.
- **Remplacement :** dans la même tâche, `main.ts` vide le pré-rendu puis monte l'application
  (aucune image intermédiaire). Le nouveau DOM a la même taille, donc pas de nouvelle entrée LCP.
  Le lecteur pose ensuite `html[data-ldm-ready]`, que tous les tests et outils attendent.
- **Garde anti-flash :** un petit script en ligne dans `<head>`, exécuté avant le premier
  affichage, masque le pré-rendu quand l'écran réel sera différent :
  - langue issue de `?lang` ou des langues du navigateur, même négociation que `negotiateLocale` ;
  - parité vérifiée par `prerender-guard.test.ts` ;
  - cible HTML5 : sauvegarde de reprise présente (`ldm:<id>@<version>`).
- **Code exécuté au rendu serveur :** les appels `matchMedia` sont protégés ; le reste ne
  s'exécute qu'au client (`$effect`, `main.ts`, `Session`).

## Conséquences
- **Mesures, version web du module de démo :**
  - LCP mesuré dans Chromium, mêmes conditions que Lighthouse (4G lente : 150 ms, 1,6 Mbit/s ;
    processeur ralenti ×4) : **1,17 à 1,21 s avant, 0,72 à 0,77 s après (−40 %)**.
  - Lighthouse simulé : score 97 (93 à 96 avant), LCP 2,31 à 2,45 s (2,45 à 2,65 avant).
- **Constat sur la méthode :** le mode simulé de Lighthouse surestime fortement le LCP de ces
  pages. Il compte le script du lecteur parmi les dépendances du premier affichage, alors que le
  pré-rendu n'en dépend pas. Le banc garde la méthode de l'ADR 0005 ; l'ajout d'une mesure réelle
  au rapport est proposé à Sam à part.
- **Limite assumée :** dans un LMS, la langue de préférence et la reprise ne sont connues qu'après
  l'appel à l'API SCORM. Lors d'une **reprise SCORM**, l'apprenant peut voir l'écran 1 pendant le
  chargement (moins d'une seconde sur un réseau correct), avant d'arriver à son signet.
- **Robustesse :** sans JavaScript, ou si le script ne charge pas, le premier écran reste lisible
  (vérifié par l'e2e).
- **Pour les tests :** attendre `html[data-ldm-ready]`, jamais le seul `h1`, qui existe dès le
  pré-rendu.

## Sources
- Svelte, `render` (svelte/server) : https://svelte.dev/docs/svelte/svelte-server
- web.dev, Largest Contentful Paint (éléments retirés, taille) : https://web.dev/articles/lcp
- Lighthouse, throttling simulé (Lantern) et ses limites : https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md
- HTML, attribut `inert` : https://html.spec.whatwg.org/multipage/interaction.html#the-inert-attribute
- MDN, `defer` : https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#defer
