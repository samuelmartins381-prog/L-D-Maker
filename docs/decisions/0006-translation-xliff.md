# 0006 — Traduction par XLIFF 1.2 et 2.0

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
Brief §4 : 11 langues ou plus par module, export et import pour la traduction (« XLIFF et/ou
tableur »). Les traducteurs et les agences travaillent dans des outils de TAO (Trados, memoQ,
Phrase, Crowdin…) qui protègent les balises et réutilisent les mémoires de traduction. Les
textes d'un module sont déjà des catalogues plats clé → texte (ADR 0002).

## Options étudiées

| Option | Pour | Contre |
|---|---|---|
| XLIFF 1.2 seul | Le plus accepté (memoQ n'a longtemps géré que 1.2 ; Xcode uniquement 1.2) | Ancien standard |
| XLIFF 2.0 seul | Norme ISO actuelle (2.0 en 2014, 2.1 en 2018) ; Trados la gère depuis Studio 2015 | Prise en charge inégale selon les outils |
| **Les deux** | On choisit à l'export selon l'outil du traducteur ; l'import détecte la version | Un peu plus de code (même modèle interne) |
| Tableur seul | Simple pour un relecteur | Aucune protection des balises, erreurs de copier-coller |

## Décision
**XLIFF 1.2 par défaut, 2.0 sur option** (`--xliff 2.0`). L'import accepte les deux.
- **Une unité par clé** : `id` = clé du catalogue, dans l'ordre de lecture du module. Le contexte est donné en anglais lisible, par exemple *« Screen 4 "Entraînement" — question: explanation of option 1, shown after answering »*.
- **Mise en forme en codes protégés** : gras et italique en `<g ctype="bold|italic">` (1.2) ou `<pc type="fmt" subType="xlf:b|xlf:i">` (2.0) ; liens en `<g ctype="link">` ou `<pc type="link">`.
- **Les URL ne sortent jamais du module.** Un lien n'est repéré que par le numéro de son code, et son URL est reprise de la source à l'import. Un traducteur ne peut donc pas modifier une destination. Un lien supprimé ou ajouté **bloque l'import**. Un gras ou un italique modifié donne un avertissement.
- **Import sûr** : rien n'est écrit en cas d'erreur. Une unité non traduite garde la traduction existante, et les clés inconnues sont ignorées et signalées. Une nouvelle langue est ajoutée à `module.yaml` en conservant ses commentaires. Un avertissement apparaît si le lecteur n'a pas encore son interface dans cette langue.
- **Conformité vérifiée** : les fichiers produits (1.2 et 2.0, avec et sans traductions, arabe compris) **valident contre les schémas officiels OASIS** stricts (`xliff-core-1.2-strict.xsd`, `xliff_core_2.0.xsd`). C'est pour cela qu'aucun attribut d'extension n'est utilisé.
- Dépendance : `@xmldom/xmldom` (MIT, sans dépendance), côté outils uniquement.

## Conséquences
- Commande : `pnpm l10n export <module> --to <langue> [--xliff 2.0]`, puis `pnpm l10n import <module> <fichier>`.
- Après import, `pnpm validate` confirme que la langue est complète.
- Pas encore fait : export tableur (CSV ou XLSX) pour des relecteurs non équipés d'outil de TAO ; sous-titres SRT/WebVTT (avec la vidéo, J3).
- Limite : la vérification par les schémas OASIS a été faite manuellement le 2026-10-16. Les XSD ne sont pas versionnés dans le dépôt, mais le test d'aller-retour, lui, tourne à chaque `pnpm check`.

## Sources
- [XLIFF 1.2 (OASIS)](http://docs.oasis-open.org/xliff/v1.2/os/xliff-core.html), [XLIFF 2.0 (OASIS)](https://docs.oasis-open.org/xliff/xliff-core/v2.0/xliff-core-v2.0.html)
- [ProZ — Support for XLIFF 2.0 and later](https://proz.com/forum/cat_tools_technical_help/327422-support_for_xliff_20_and_later.html) (Trados : 2.0 depuis Studio 2015 ; memoQ 8.4 : 1.2 seulement)
- [RWS Community — XLIFF 1.2 vers 2.0](https://community.rws.com/product-groups/trados-portfolio/trados-studio/f/studio/49181/open-xliff-1-2-save-to-xliff-2-0)
- [Guide XLIFF (Xcode : 1.2 uniquement)](https://translate.gitlab.com/blog/xliff-translation)
