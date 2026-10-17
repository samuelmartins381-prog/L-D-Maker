# 0017 — Organisation mixte : création dans Claude Code, finition dans le Studio

- **Statut** : accepté (choix de Sam le 2026-10-17)
- **Date** : 2026-10-17
- **Décideur** : Sam, sur recommandation de Claude

## Contexte
Le plan du Studio (ADR 0014, 0015) faisait tout passer par une application de bureau qui appelle
Claude par l'API. Sam a précisé ensuite que la qualité viendra d'un écosystème : skills, plugins,
MCP, services d'IA (Higgsfield pour le motion design, d'autres à venir). Dans Claude Code, cet
écosystème est disponible sans développement et couvert par l'abonnement ; dans le Studio, chaque
outil doit être intégré par du code, et chaque appel se paie en plus.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Tout dans Claude Code | Qualité maximale, coût inclus, rien à intégrer | Pas d'écran pour voir, retoucher, exporter | — |
| Tout dans le Studio (API) | Autonome, simple, vendable | Chaque outil à intégrer ; coût API ; qualité limitée à ce qui est branché | — |
| **Mixte** | Création avec tout l'écosystème ; écran de finition simple | Deux lieux de travail ; un accès Claude pour Kylian | — |

## Décision
- **Claude Code = atelier de création** : storyboard, rédaction, design, motion, traductions, avec
  les skills, plugins et MCP installés. Procédure écrite dans un skill de projet
  (`.claude/skills/generate-module/`), qui s'appuie sur les outils du dépôt.
- **Le dépôt = colonne vertébrale commune** : lecture des sources, schémas, contrôles
  pédagogiques, lecteur, exports par LMS, banc QA. Les deux lieux lisent et écrivent le même
  dossier de projet.
- **Studio = écran de finition** : créer le projet et ses choix, aperçu du module, retouches de
  Sam, validation (porte), export par LMS. La génération par API (ADR 0015) reste en option, pour
  l'autonomie de Kylian ; on n'y investit plus en priorité.

## Conséquences
- Plan du Studio révisé : étape 3 (relecture et validation du storyboard) et étape 4 (aperçu et
  retouches) restent ; la génération du module par API passe en option.
- Usage commercial régulier : abonnement Claude adapté (limites d'usage) et réglage de
  confidentialité vérifié (contenus des marques non utilisés pour l'entraînement).
- Les devis avant lancement (services tiers) s'appliquent aux deux lieux.
