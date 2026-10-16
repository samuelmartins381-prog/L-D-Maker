# Demandes à Sam

Priorisées. Chaque demande d'installation précise : quoi, pourquoi, alternatives écartées,
risques (permissions, données).

## P0 — bloquant pour démarrer le J1
1. ~~Valider la phase 0~~ — validée le 2026-10-15.
2. **Confirmer deux hypothèses** (phase 0, §0) :
   - Les contenus clients peuvent être traités par Claude, mais par **aucun autre service tiers** sans ton accord au cas par cas. OK ?
   - Les clients n'ont pas de contrainte IT connue (navigateurs récents, pas d'IE, pas de LMS hors ligne). OK ?

## P1 — utile dès le J1
3. **Installer Context7 MCP** (Upstash)
   - _Pourquoi_ : documentation à jour des bibliothèques utilisées (Svelte, Vite, Playwright, axe…) pour éviter le code obsolète ou les API inventées.
   - _Alternative écartée_ : la recherche web au coup par coup, plus lente et moins fiable sur les versions.
   - _Risques_ : les requêtes (noms de bibliothèques, sujets techniques) partent chez Upstash. Aucun contenu client. Clé API optionnelle.
4. ~~Créer un compte SCORM Cloud~~ — fait, validation réussie le 2026-10-16. **Reste à faire** :
   - ~~Régénérer la clé secrète~~ — fait par Sam le 2026-10-16 (ancienne clé supprimée). Nouvelle
     clé enregistrée dans les secrets d'environnement et **vérifiée le 2026-10-16** (ping 200,
     validation SCORM 2004 réussie).
   - Optionnel : activer « Allow Delete API calls » dans les détails de l'application, pour que
     le banc efface ses inscriptions de test (l'essai en limite 10 actives).
5. **Un contenu de test non confidentiel** (PDF, PPTX ou texte, 15–30 min de formation) pour le module de démonstration.
6. **Inspirations** dans `inspirations/` (captures, liens) : voir `inspirations/README.md`.

7. **Relecture native des traductions** du module de démo (`examples/phishing-basics/strings/`) :
   arabe, allemand, espagnol, italien, portugais (Brésil), russe, japonais, chinois simplifié,
   coréen, ainsi que les textes d'interface du lecteur (`packages/player/src/ui/`). Ce sont des
   traductions Claude, non relues. Pas bloquant pour le développement : elles servent à tester le
   rendu (RTL, CJK, cyrillique, longueur des textes). **Avant toute livraison client**, chaque
   langue doit être relue par un natif. Le banc QA le rappelle (contrôle manuel « Relecture native
   des traductions »). Si tu n'as qu'un relecteur sous la main, commence par la langue de ta
   première commande.

## P2 — plus tard
8. **Figma MCP** (plugin officiel : `claude plugin install figma@claude-plugins-official`), **seulement si tu fais tes maquettes dans Figma**.
   - _Pourquoi_ : extraire les tokens exacts (couleurs, typographie, espacements) de tes maquettes.
   - _Alternative_ : des captures PNG dans `inspirations/`, moins précises.
   - _Risques_ : lecture des fichiers Figma auxquels tu donnes accès.
9. **Playwright MCP** (Microsoft, Apache-2.0), optionnel : inspection interactive des modules pendant la conception. Les tests automatisés n'en ont pas besoin.
10. **Accès sandbox à un LMS client** (Cornerstone, SuccessFactors, Docebo, 360Learning…) dès qu'une commande le permet : ce sera notre troisième LMS de test.
11. **Higgsfield** (déjà connecté) : je ne l'utilise pas sans ton accord explicite, à cause du contenu client possible dans les prompts et des droits commerciaux des visuels à vérifier.
