# 0016 — Profils LMS et formats de sortie

- **Statut** : accepté (plan validé par Sam le 2026-10-17)
- **Date** : 2026-10-17
- **Décideur** : Claude

## Contexte
Les modules partent surtout vers le LMS des marques, dont souvent **Watch Live**, l'application de
la FHH hébergée par **Teach on Mars**, utilisée pour former les boutiques externes et le réseau
wholesale. Sam doit choisir « pour quel LMS » sans connaître SCORM. Il faut aussi un fichier HTML
unique et un site à héberger.

Teach on Mars ([support](https://support.teachonmars.com/hc/en-us/articles/23529392403612-How-to-integrate-a-SCORM-content)) :
SCORM 1.2 et 2004 (1re à 4e éd.) ; `imsmanifest.xml` à la racine du ZIP ; parcours de 200 Mo au
plus ; contenu affiché plein écran **sans aucun contrôle**, donc **bouton de sortie obligatoire
dans le contenu** ; **`Commit` non implémenté** : une session n'est envoyée qu'à `LMSFinish` /
`Terminate`.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Laisser Sam choisir la norme | Rien à coder | Sam doit connaître SCORM et les particularités de chaque LMS | — |
| **Profils nommés par LMS** (format + options + contrôles) | Sam choisit « Watch Live » ou « Cornerstone » ; les particularités sont codées et testées une fois | Profils à documenter et tenir à jour | — |

## Décision
`packages/builder/src/profiles/` : un profil = format (`scorm12`, `scorm2004`, `html-file`,
`html-site`), options du lecteur et contrôles d'export.
- **`teach-on-mars` (Watch Live)** : bouton **Quitter** toujours visible qui appelle `finish()` ;
  aucune donnée attendue d'un `Commit` (état complet envoyé à la sortie et sur `pagehide`, déjà
  géré par `session.svelte.ts`) ; ZIP de moins de 200 Mo ; manifeste à la racine.
- **Autres** : Cornerstone, SuccessFactors, Docebo, Moodle, 360Learning, Workday, et **LMS
  inconnu** (SCORM 1.2, le plus compatible). Chaque particularité est sourcée dans ce document
  au moment où le profil est écrit.
- **`html-file`** : un seul `.html` (JS, CSS, langues, médias en `data:`), reprise locale, sans
  suivi ; **`html-site`** : le dossier `web/` actuel.
- cmi5 et xAPI : nouveaux adaptateurs `Tracker` plus tard (ADR 0004).

## Conséquences
- Un vrai test Watch Live exige un accès au Mission Center de Teach on Mars (via Kylian ou la
  FHH) ; en attendant : documentation + SCORM Cloud.
- Un profil ajouté = une entrée testée, sans toucher au lecteur.

## Sources
- Teach on Mars, intégration SCORM : https://support.teachonmars.com/hc/en-us/articles/23529392403612-How-to-integrate-a-SCORM-content
- Watch Live (FHH) : https://apps.apple.com/my/app/watch-live-fhh-academy/id1265921664
- Sortie d'un SCO : https://support.scorm.com/hc/en-us/articles/206167176-Troubleshooting-Exit-Issues-in-My-Content
