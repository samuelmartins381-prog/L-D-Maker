# Audit pédagogique — module de démo `phishing-basics`

- **Date** : 2026-10-16
- **Skills utilisés** : `assessment-validity-checker` (Messick, Kane, Stobart),
  `feedback-quality-analyser` (Hattie & Timperley, Shute), `cognitive-load-analyser` (Sweller, Kalyuga)
- **Public** : salariés adultes non techniciens, autoformation, mobile d'abord

## Constats

| # | Gravité | Constat | Skill |
|---|---|---|---|
| 1 | Majeur | **3 items notés pour un seuil de 80 %** : il fallait 3/3, donc une seule erreur faisait échouer. Fiabilité faible, effet démotivant. | Validité |
| 2 | Majeur | **Sous-représentation de l'objectif « bien réagir »** : un seul item, et seulement sur le cas « j'ai déjà cliqué ». Le réflexe principal enseigné (signaler) n'était pas évalué. | Validité |
| 3 | Modéré | **Distracteurs trop évidents** dans `q-signals` (« message attendu d'un collègue connu », « newsletter ») : on pouvait réussir par simple bon sens, sans maîtriser les signaux. Et l'item laissait croire qu'un expéditeur connu est forcément sûr, alors que la compromission de comptes légitimes est un vecteur majeur. | Validité |
| 4 | Modéré | **Feedback rédigé comme un verdict** (« Exact : », « Non : »). En choix multiple, l'apprenant voit l'explication de toutes les options : « Exact » sur une option non cochée devient faux. Les explications ne donnaient pas toujours de réflexe transférable. | Feedback |
| 5 | Modéré | **Pas d'exemple travaillé** entre la présentation des 5 signaux et l'entraînement. L'apprenant devait combiner les signaux sans jamais l'avoir vu faire. | Charge cognitive |
| 6 | Mineur | **Aucune incitation à l'autorégulation** à la fin : le récapitulatif listait des faits, sans routine à réutiliser. | Feedback |
| 7 | À venir | **E-mails décrits en texte** : l'apprenant doit se représenter mentalement le message. Un rendu visuel d'e-mail avec zones cliquables serait plus authentique et moins coûteux en charge cognitive. Il faut le composant « quiz sur image / hotspots » (J3). | Charge cognitive, authenticité |

## Corrections appliquées

1. **6 items notés, 3 par objectif.** Le seuil de 80 % tolère maintenant une erreur (5/6).
   - `obj-signs` : `q-sender`, `q-signals`, et le nouveau `q-link` (domaine réel d'un lien, mythe du cadenas).
   - `obj-react` : le nouveau `q-report` (signaler plutôt que transférer ou répondre), le nouveau `q-verify` (fraude au changement de RIB : vérifier par un autre canal) et `q-react`.
2. **Distracteurs fondés sur des idées reçues réelles** : le logo officiel, la personnalisation par le prénom, le cadenas HTTPS, l'adresse habituelle d'un fournisseur.
3. **Feedback neutre et orienté processus** : chaque option est expliquée (« C'est un signal : … »), souvent avec un réflexe (« regardez ce qui suit le @ », « survolez le lien »). Le verdict sera affiché par le lecteur (règle ajoutée à l'ADR 0002).
4. **Exemple travaillé** (nouvel écran `s2-example`) : un e-mail décortiqué en 3 signaux, avant l'entraînement.
5. **Routine d'autorégulation** dans le récapitulatif : trois questions à se poser avant de cliquer.
6. **Durée annoncée** portée de 12 à 15 minutes.
7. **Garde-fou automatique** : le validateur avertit désormais quand une seule erreur ferait échouer le module (`assessment-tolerance`).

## Reste à faire
- Constat 7 : refondre `s2-example` et `q-link` en rendu visuel d'e-mail quand le composant hotspot existera (J3).
- Relecture native de l'arabe (voir `docs/requests-for-sam.md`).
