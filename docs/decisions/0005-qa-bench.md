# 0005 — Banc QA automatique et rapport par module

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
Brief §5 : « un banc de test automatisé vérifie ces critères à chaque build et génère un rapport
QA par module ». La phase 0 (§5.4) a chiffré les seuils. Le banc doit fonctionner pour n'importe
quel module, sans script propre à chaque module.

## Décision
Paquet `@ldm/qa` (`pnpm qa <module>`), exécuté dans `pnpm check`. Il prend le module construit et
produit `out/<id>/qa/report.html` (autonome, captures incluses) et `report.json`.

| Contrôle | Outil | Seuil |
|---|---|---|
| Check-list pédagogique | validateur `@ldm/schema` | 0 erreur |
| Poids du lecteur | gzip | JS ≤ 60 Ko, CSS ≤ 20 Ko |
| Accessibilité automatique | axe-core 4.14 (WCAG 2.0/2.1/2.2 A+AA) | 0 violation |
| Clavier | parcours Tab avec Playwright | tout contrôle atteint, focus visible (2.4.7), jamais entièrement masqué (2.4.11, test réel par `elementFromPoint`) |
| Mise en page multilingue | Playwright | aucun débordement horizontal |
| Mouvement réduit | styles calculés | aucune transition ni animation |
| Erreurs d'exécution | Playwright | aucune erreur JS ni ressource 404 |
| Suivi SCORM 1.2 | faux LMS scorm-again, piloté par les données du module | 2 sessions : interruption, reprise au bon écran, réussite, LMSFinish |
| Performance et accessibilité | Lighthouse 13 (mobile, 4G simulée) | perf ≥ 90, a11y = 100, LCP ≤ 2,5 s, CLS ≤ 0,1, TBT ≤ 200 ms, ≤ 500 Ko |
| Contrôles manuels | listés dans le rapport | lecteurs d'écran, sens, traductions, SCORM Cloud |

Le parcours couvre **chaque écran × chaque langue × mobile et desktop × deux états** : tel
qu'affiché, puis après interaction (accordéons ouverts, questions répondues jusqu'à l'état
final).

## Preuve que le banc détecte
Trois défauts ont été injectés volontairement dans le lecteur : contraste insuffisant, focus
invisible, `scroll-padding` retiré. Les trois ont été détectés (52 violations axe, 557 problèmes
clavier dont un focus masqué), puis le lecteur a été restauré.

## Conséquences
- `pnpm check` dure environ 45 s (Lighthouse compris). `--skip-lighthouse` est disponible en itération.
- Outils de développement uniquement : axe-core (MPL-2.0), Lighthouse et chrome-launcher (Apache-2.0). Rien n'est embarqué dans les modules.
- Limite assumée : l'automatique ne prouve pas tout (environ un tiers à la moitié des critères WCAG). Les contrôles manuels sont listés dans chaque rapport, jamais présumés.

## Sources
- [axe-core](https://github.com/dequelabs/axe-core), [Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [WCAG 2.2 — 2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)
- [WAI-ARIA APG — Tabs (roving tabindex)](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
