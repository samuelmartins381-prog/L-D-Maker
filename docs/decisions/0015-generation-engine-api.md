# 0015 — Moteur de génération par l'API Claude

- **Statut** : accepté (choix de Sam le 2026-10-17, plan validé)
- **Date** : 2026-10-17
- **Décideur** : Sam (génération automatique par clé API) ; Claude (conception)

## Contexte
Jusqu'ici, objectifs, storyboard et rédaction étaient faits par Claude dans une session Claude
Code. Sam veut cliquer et obtenir le module, sans passer par une conversation. Il fournira la clé
API Anthropic.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Session Claude Code à chaque projet | Pas de coût d'API | Sam dépend d'une conversation ; pas reproductible | — |
| Texte libre puis analyse | Simple | Sorties fragiles, à re-parser | — |
| **SDK Anthropic, sorties structurées validées par nos schémas, boucle d'auto-correction** | Reproductible ; chaque sortie passe par les mêmes contrôles que le travail manuel | Coût à l'usage, à afficher | MIT (`@anthropic-ai/sdk`) |

## Décision
`packages/generator/src/engine/` appelle l'API avec `@anthropic-ai/sdk`.
- **Étapes** : objectifs et storyboard ; révision selon les consignes de Sam ; rédaction du
  module, section par section ; traduction par langue (glossaire) ; régénération d'un bloc.
- **Sorties structurées** : le schéma JSON dérive des schémas Zod existants (`Storyboard`,
  `Module`) ; une sortie invalide n'est jamais écrite.
- **Auto-correction** : les problèmes trouvés par `checkStoryboard`, `validateModule` et
  `conformToStoryboard` sont renvoyés au modèle, 3 tours au plus ; ensuite l'échec est montré à
  Sam tel quel.
- **Entrées de chaque prompt** : sources ingérées (texte et, pour les pages `no-text`, images),
  brief et choix du projet, **règles communes de Sam** (`house-rules.yaml`), règles pédagogiques.
- **Prompts versionnés** dans `packages/generator/prompts/`.
- **Coût** estimé avant, mesuré après, journalisé par projet ; modèle réglable.
- **Tests** : réponses enregistrées (aucun réseau dans `pnpm check`) ; un test réel facultatif,
  avec la clé en secret d'environnement.

## Licences
`@anthropic-ai/sdk` (MIT), avec `fast-sha256` (Unlicense, domaine public) ajouté à la liste
stricte de `scripts/check-licenses.mjs`. Rien de cela n'entre dans un module livré.

## Conséquences
- Confidentialité : les contenus des marques ne vont que chez Anthropic, comme aujourd'hui. Les
  conditions commerciales de l'API excluent l'entraînement sur les données des clients ; la durée
  de conservation des journaux (30 jours en standard, rétention zéro possible sur demande) est à
  revérifier sur les pages officielles avant la première commande.
- La qualité dépend des prompts : le storyboard fait à la main pour `mouvement-mecanique` sert de
  référence de comparaison.

## Sources
- SDK TypeScript : https://github.com/anthropics/anthropic-sdk-typescript (MIT)
- Politique de données (Claude Code, conditions commerciales) : https://docs.claude.com/en/docs/claude-code/data-usage
