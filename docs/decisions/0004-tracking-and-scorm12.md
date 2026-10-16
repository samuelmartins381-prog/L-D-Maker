# 0004 — Suivi des apprenants et export SCORM 1.2

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
Le brief exige le suivi de la complétion, du score, du temps passé, du statut de réussite et la
reprise de session, sur tous les LMS. La phase 0 a retenu SCORM 1.2 comme format par défaut (le
plus universel), avec ses contraintes : un seul champ de statut et `suspend_data` limité à
4 096 caractères. Elle a aussi relevé un piège documenté de SAP SuccessFactors : un cadre d'un
autre domaine interrompt la recherche de l'API.

## Décisions
1. **Une interface `Tracker` unique** (`packages/player/src/tracking/`) avec des adaptateurs :
   `scorm12` (LMS) et `standalone` (stockage du navigateur pour l'HTML5 autonome). SCORM 2004,
   cmi5 et xAPI s'ajouteront comme adaptateurs, sans toucher au lecteur. La cible est choisie au
   build (`target`). Une cible `scorm12` ouverte hors LMS bascule en `standalone`, avec un
   avertissement dans la console.
2. **Adaptateur SCORM 1.2 écrit par nous**, sans dépendance embarquée. Le wrapper pipwerks (MIT)
   sert de référence. La recherche de l'API remonte les parents puis l'opener, et **ignore les
   cadres inaccessibles** au lieu de s'arrêter (KBA SAP 2808684).
3. **Statut SCORM 1.2** :
   - sans évaluation : `completed` quand tous les écrans sont vus ;
   - avec évaluation : `passed` / `failed` quand tous les écrans sont vus et toutes les questions notées sont terminées ;
   - sinon `incomplete`.
   Le score est envoyé en pourcentage (`score.raw` 0–100). Le seuil vient du `masteryscore` du
   manifeste, ou de `cmi.student_data.mastery_score` si le LMS en impose un.
4. **État de reprise compact et versionné** (`suspend.ts`) : les positions remplacent les
   identifiants, ce qui donne environ 2 000 caractères pour 120 questions (test : < 3 500).
   L'état porte `id@version` du module : **un état d'une autre version est ignoré** plutôt
   qu'appliqué de travers. L'apprenant recommence alors, ce qui vaut mieux qu'une reprise corrompue.
5. **Interactions** : chaque réponse définitive est envoyée (`choice`, réponse, réponse attendue,
   résultat, objectif). Elles sont facultatives en SCORM 1.2 : un refus du LMS est journalisé sans
   bloquer le suivi.
6. **Fin de session** : bouton « Terminer » sur le dernier écran, ou `pagehide` si l'apprenant
   ferme la fenêtre. `cmi.core.exit = "suspend"` tant que le module n'est pas terminé, pour que le
   LMS propose la reprise.
7. **Paquet** : un seul SCO, `imsmanifest.xml` généré, ZIP produit avec `fflate` (MIT, côté build
   uniquement).

## Conséquences
- Faux LMS de test : `scorm-again` (MIT, dev uniquement) dans `qa/e2e/`. Le scénario sur deux
  sessions (suspension, reprise, réussite) tourne à chaque `pnpm check`.
- **Validé sur SCORM Cloud le 2026-10-16** (`pnpm qa:scorm-cloud`) : import sans avertissement
  d'analyse, malgré l'absence des XSD de l'ADL ; interruption gardée « incomplete » ; reprise au bon
  écran ; « completed / passed », score 100, temps suivi, 7 interactions avec réponse attendue.
  SCORM Cloud ouvre le SCO dans une **fenêtre popup** par défaut : la recherche de l'API par
  l'`opener` fonctionne.
- Langue : le lecteur lit `cmi.student_preference.language` (préférence LMS), après `?lang=` et
  avant la langue du navigateur.
- Le crédit partiel et les nouvelles tentatives après échec ne sont pas gérés (v0.1).

## Sources
- ADL, *SCORM 1.2 Run-Time Environment* (cmi.core.*, cmi.interactions.*, CMITimespan)
- [SAP KBA 2808684](https://userapps.support.sap.com/sap/support/knowledge/en/2808684), [2531411](https://userapps.support.sap.com/sap/support/knowledge/en/2531411)
- [scorm-again](https://github.com/jcputney/scorm-again), [pipwerks SCORM wrapper](https://pipwerks.com/scorm-javascript-wrapper-updates/)

## Addendum — 2026-10-16 : SCORM 2004 4e édition (J2, étape 1)
- Adaptateur `scorm2004` : **complétion et réussite séparées**. `completion_status` vaut
  completed quand tous les écrans sont vus, ou seulement une fois réussi si le module l'exige ;
  `success_status` vaut passed/failed une fois l'évaluation terminée, sinon unknown. Envoie aussi
  `score.scaled` (0–1), `progress_measure` (part des écrans vus), `session_time` en durée ISO 8601,
  `exit` « suspend » ou « normal », et les interactions avec les identifiants de choix séparés par `[,]`.
- Seuil : `imsss:minNormalizedMeasure` de l'objectif principal (`satisfiedByMeasure="true"`),
  lu par le lecteur via `cmi.scaled_passing_score`. Pas d'autre règle de séquençage : un seul SCO,
  navigation gérée par le lecteur.
- Piège évité grâce au banc : le format `time` n'accepte le fuseau (« Z ») qu'**après une fraction
  de seconde** (`…T09:05:07.45Z` et non `…T09:05:07Z`). Le banc signale désormais toute valeur
  refusée par le LMS.
- Docebo ne gère que la 3e édition et pas le séquençage (phase 0 §2.2) : pour Docebo, livrer en
  SCORM 1.2 en attendant un profil LMS dédié.
- Validation SCORM Cloud en 2004 : `pnpm qa:scorm-cloud <module> --version 2004`, à lancer dès que
  la nouvelle clé est disponible dans une session.
