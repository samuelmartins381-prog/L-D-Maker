# Demandes à Sam

Priorisées. Chaque demande d'installation précise : quoi, pourquoi, alternatives écartées,
risques (permissions, données).

## P0 — bloquant pour démarrer le J1
1. **Valider ou amender la phase 0** : `docs/phase0-research.md` et l'ADR
   `docs/decisions/0001-own-engine-vs-adapt.md` (moteur propre plutôt qu'Adapt).
2. **Confirmer deux hypothèses** (phase 0, §0) :
   - Les contenus clients peuvent être traités par Claude, mais par **aucun autre service tiers** sans ton accord au cas par cas. OK ?
   - Les clients n'ont pas de contrainte IT connue (navigateurs récents, pas d'IE, pas de LMS hors ligne). OK ?

## P1 — utile dès le J1
3. **Installer Context7 MCP** (Upstash)
   - _Pourquoi_ : documentation à jour des bibliothèques utilisées (Svelte, Vite, Playwright, axe…) pour éviter le code obsolète ou les API inventées.
   - _Alternative écartée_ : la recherche web au coup par coup, plus lente et moins fiable sur les versions.
   - _Risques_ : les requêtes (noms de bibliothèques, sujets techniques) partent chez Upstash. Aucun contenu client. Clé API optionnelle.
4. **Créer un compte SCORM Cloud** (essai gratuit, sans limite de durée : 3 cours, 10 inscriptions actives).
   - Fournir l'App ID et la clé secrète comme **secrets de l'environnement cloud**, jamais dans le dépôt.
   - Plus tard, le plan Tester (environ 40 $/mois, à confirmer) quand le banc de test l'appellera à chaque build.
5. **Un contenu de test non confidentiel** (PDF, PPTX ou texte, 15–30 min de formation) pour le module de démonstration.
6. **Inspirations** dans `inspirations/` (captures, liens) : voir `inspirations/README.md`.

## P2 — plus tard
7. **Figma MCP** (plugin officiel : `claude plugin install figma@claude-plugins-official`), **seulement si tu fais tes maquettes dans Figma**.
   - _Pourquoi_ : extraire les tokens exacts (couleurs, typographie, espacements) de tes maquettes.
   - _Alternative_ : des captures PNG dans `inspirations/`, moins précises.
   - _Risques_ : lecture des fichiers Figma auxquels tu donnes accès.
8. **Playwright MCP** (Microsoft, Apache-2.0), optionnel : inspection interactive des modules pendant la conception. Les tests automatisés n'en ont pas besoin.
9. **Accès sandbox à un LMS client** (Cornerstone, SuccessFactors, Docebo, 360Learning…) dès qu'une commande le permet : ce sera notre troisième LMS de test.
10. **Higgsfield** (déjà connecté) : je ne l'utilise pas sans ton accord explicite, à cause du contenu client possible dans les prompts et des droits commerciaux des visuels à vérifier.
