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
5. ~~Un contenu de test non confidentiel~~ — inventé par Claude à ta demande (2026-10-17) :
   `projects/mouvement-mecanique/`. Un vrai contenu (non confidentiel) reste utile pour éprouver la
   lecture de documents réels.
6. **Inspirations** dans `inspirations/` (captures, liens) : voir `inspirations/README.md`.

7. **Relecture native des traductions** du module de démo (`examples/phishing-basics/strings/`) :
   arabe, allemand, espagnol, italien, portugais (Brésil), russe, japonais, chinois simplifié,
   coréen, ainsi que les textes d'interface du lecteur (`packages/player/src/ui/`). Ce sont des
   traductions Claude, non relues. Pas bloquant pour le développement : elles servent à tester le
   rendu (RTL, CJK, cyrillique, longueur des textes). **Avant toute livraison client**, chaque
   langue doit être relue par un natif. Le banc QA le rappelle (contrôle manuel « Relecture native
   des traductions »). Si tu n'as qu'un relecteur sous la main, commence par la langue de ta
   première commande.

12. **Accès de test à Watch Live / Teach on Mars** (Mission Center), via Kylian ou la FHH :
    seul moyen de valider pour de vrai le profil Watch Live (ADR 0016). En attendant :
    documentation de Teach on Mars et SCORM Cloud.
13. **Nom du service du dossier partagé** (Google Drive, OneDrive, Dropbox…) : ton accord pour
    y stocker les sources des marques est noté (2026-10-17) ; il me faut le nom pour le
    documenter et tester le verrou entre Sam et Kylian.
14. **Clé API Anthropic** (pour l'étape 2 du Studio) : à créer sur console.anthropic.com, puis
    à mettre **en secret d'environnement** `ANTHROPIC_API_KEY` pour mes tests ; dans le Studio,
    tu la colleras dans les paramètres (stockée chiffrée sur ton ordinateur). Fixe une limite de
    dépense mensuelle dans la console.
15. **Signature des installateurs** (étape 6 du Studio) : compte Apple Developer (environ 99 $
    par an) et certificat de signature Windows (ou Azure Trusted Signing, environ 10 $ par mois).
    Sans signature, l'installation reste possible mais affiche un avertissement.

16. **Niveau « motion design » des agences** (2026-10-20, après la proposition d'agence reçue,
    `inspirations/notes.md`). Ce qui fait ce niveau, c'est surtout **notre lecteur** (thème,
    navigation, animations, je le code) et **les visuels de la marque**. Les outils aident en
    amont. Par ordre d'utilité :
    - a. **Connecteur Figma** (officiel, annuaire Anthropic). Sur claude.ai : Paramètres →
      Connecteurs → Figma → Connecter. Compte Figma gratuit pour commencer.
      - _Pourquoi_ : un écran maquetté (par toi, Kylian ou un graphiste) que je reproduis au pixel
        près, animations comprises (skill `figma-implement-motion`). Je peux aussi te poser des
        maquettes dans Figma à valider **avant** de coder.
      - _Données_ : seulement les fichiers Figma partagés.
      - _Alternative_ : des captures, moins précises.
    - b. **Plugin `frontend-design`** (Anthropic, gratuit) : une skill de conception
      d'interfaces de haut niveau, pour le thème « cinéma » et les nouveaux écrans. Rien ne sort
      du dépôt.
    - c. **Higgsfield** (déjà connecté), pour ce que le code ne fait pas : objets détourés, images
      agrandies proprement, courtes boucles vidéo, voix off, modèle 3D d'une montre.
      - _Accord par projet_ : uniquement sur des visuels que la marque autorise à envoyer.
      - _Licence commerciale_ : à vérifier sur le plan Higgsfield utilisé.
    - **Écartés** : Adobe, Canva, Moda, Webflow (font doublon ou sortent de notre lecteur) ;
      un service de voix séparé (Higgsfield fait déjà la voix off) ; le visualiseur 3D de démo
      (si on fait de la 3D, ce sera dans le lecteur, pour maîtriser le poids sur LMS et mobile).
    - **Plus important que tout outil** : pour chaque marque, son **kit visuel**. Il comprend
      des montres détourées en haute définition, des photos d'archives libres de droits pour le
      module, les polices et la charte. Le style de la proposition repose entièrement dessus.

## P2 — plus tard
8. **Figma** : remonté en P1 le 2026-10-20 (voir le n° 16).
9. **Playwright MCP** (Microsoft, Apache-2.0), optionnel : inspection interactive des modules pendant la conception. Les tests automatisés n'en ont pas besoin.
10. **Accès sandbox à un LMS client** (Cornerstone, SuccessFactors, Docebo, 360Learning…) dès qu'une commande le permet : ce sera notre troisième LMS de test.
11. **Higgsfield** (déjà connecté) : je ne l'utilise pas sans ton accord explicite, à cause du contenu client possible dans les prompts et des droits commerciaux des visuels à vérifier.

## Services payants (Sam, 2026-10-17 : « je te fournirai toutes les clés, abonnements… »)
Règles inchangées : chaque service est proposé ici **au moment où il devient utile** (quoi,
pourquoi, coût, alternative gratuite, données envoyées). Les clés passent par les secrets
d'environnement, **jamais dans le chat ni dans le dépôt**. Un service qui reçoit du contenu
client demande ton accord explicite (hypothèse n° 2 ci-dessus).

Pistes déjà identifiées, rien à faire pour l'instant :
- **Clé API Anthropic** : automatiser le pipeline hors session (génération en lot, nuit). Le
  contenu reste chez Claude, donc compatible avec la règle de confidentialité.
- **SCORM Cloud payant** : seulement si la limite de 10 inscriptions actives gêne le banc.
- **Synthèse vocale** (narration audio multilingue) : contenu client envoyé au fournisseur,
  accord requis ; licence commerciale des voix à vérifier.
- **Hébergement d'un LMS de test** (Moodle) : environ quelques euros par mois, sans contenu client.
