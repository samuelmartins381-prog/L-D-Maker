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

## Addendum du 2026-10-20 : rédaction et traduction du module
- **Brouillon à textes en ligne** (`generator/src/draft.ts`) : Claude ne manipule pas de clés.
  Il renvoie la structure du module avec ses textes ; `draftToModule` dérive des clés stables des
  identifiants (uniques), ajoute ce que fixent le projet et le storyboard (langues, durée, seuil,
  niveaux de Bloom) et liste les images des sources à copier. Les sorties structurées n'acceptent
  pas de dictionnaire libre (`z.record`), et un modèle qui n'invente pas de clés n'en oublie pas.
- **Rédaction en une réponse** pour tout le module (jusqu'à 128 000 jetons, réflexion comprise)
  plutôt que section par section : un module de 20 minutes y tient, et la cohérence du ton y gagne.
  À revoir si des modules plus longs l'exigent.
- **Contrôles** : `validateModule`, `conformToStoryboard`, et la porte `assertApproved` avant
  tout envoi.
- **Traduction** : un appel par langue, liste `{key, text}` ; seuls les textes nouveaux ou modifiés
  partent (empreintes dans `module/.translations.json`) ; une réponse qui perd une clé, une
  emphase, un lien ou un paragraphe est refusée.
- **Typographie française** posée par le code (`typography.ts`), pas par le modèle.
- **Savoir métier** : `docs/knowledge/*.md` accompagne chaque génération, en bloc mis en cache ;
  le Studio l'embarque au build. Les sources de la marque priment.
- Les règles communes sont lues dans `regles-maison.md` (et non `house-rules.yaml`), les prompts
  versionnés dans `engine/prompts.ts` (et non `prompts/`).

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
