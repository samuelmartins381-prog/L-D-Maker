# 0002 — Format de contenu d'un module (schéma v0.1)

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
Le brief impose : contenu séparé du rendu, schéma versionné, aucune chaîne en dur, 11 langues ou
plus, export XLIFF, alignement objectifs ↔ activités ↔ évaluation, feedback explicatif par
réponse. Ce format est le contrat entre le pipeline de génération (Claude), la traduction, le
lecteur et les exports. Il sera écrit surtout par Claude et relu par Sam.

## Options étudiées

| Question | Options | Choix |
|---|---|---|
| Sérialisation | JSON · YAML · Markdown + front-matter | **YAML** pour la structure : lisible et commentable, il se relit bien dans une PR. **JSON** pour les catalogues de chaînes : format plat, outillage de traduction standard. |
| Définition du schéma | JSON Schema écrit à la main + Ajv · TypeBox · **Zod 4** | **Zod 4** : types TypeScript et validation viennent d'une seule source, et `z.toJSONSchema()` exporte un JSON Schema pour l'autocomplétion dans l'éditeur. Pas de dérive entre types et schéma. |
| Textes | Inline par langue (`title: {fr: …, en: …}`) · **clés vers des catalogues par langue** | **Clés.** La structure ne change pas quand on ajoute une langue, chaque chaîne a un identifiant stable (indispensable pour XLIFF et la mémoire de traduction), et un catalogue manquant se détecte mécaniquement. |
| Découpage | Diapositives fixes · défilement libre · **écrans composés de blocs** | **Sections → écrans → blocs.** L'écran est l'unité de navigation, de reprise et de suivi. Le bloc est l'unité de composant, réutilisable dans n'importe quel écran. |

## Décision
Un module est un dossier :
```
module.yaml          structure, pédagogie, références aux chaînes (aucun texte affiché)
strings/<lang>.json  un catalogue plat { "clé": "texte" } par langue
media/               images, vidéos, sous-titres
```
- `schemaVersion: "0.1"` est obligatoire. Toute évolution incompatible change de version et fournit une migration.
- Les textes sont du texte brut, avec une **mise en forme inline limitée** (`**gras**`, `*italique*`, `[lien](url)`) dans les champs de corps. Pas de HTML : c'est plus sûr, et plus simple à traduire.
- Composants v0.1 : `narrative`, `accordion`, `tabs`, `question` (variantes `single` / `multiple`), `summary`.
- Le validateur fait deux passes :
  1. **Structure** (Zod) : types, champs obligatoires, formats.
  2. **Sémantique** : identifiants uniques, références d'objectifs existantes, cohérence des bonnes réponses, chaque objectif évalué par au moins une question notée, chaque question notée rattachée à un objectif, chaque clé présente et non vide dans **toutes** les langues, clés orphelines signalées, alternative textuelle des images.

## Conséquences
- Ajouter une langue revient à ajouter un fichier : la structure ne bouge pas.
- L'export et l'import XLIFF (J2) se feront directement depuis les catalogues.
- L'auteur (Claude) doit nommer des clés, ce qui est plus verbeux. C'est accepté, au profit de la traçabilité.
- Dépendances ajoutées : `zod` (MIT) et `yaml` (ISC). Elles restent côté outils : le lecteur reçoit un JSON déjà validé.

## Sources
- [Zod 4 — JSON Schema](https://zod.dev/json-schema)
- [XLIFF 2.0 (OASIS)](https://docs.oasis-open.org/xliff/xliff-core/v2.0/xliff-core-v2.0.html) : unités de traduction identifiées par clé
- Brief §4 (pipeline, pédagogie, multilingue)
