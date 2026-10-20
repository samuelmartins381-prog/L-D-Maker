# Le Studio — guide pour Sam et Kylian

Le Studio est l'application de bureau du générateur (ADR 0014). Il tourne sur Mac et Windows.

## Installer
1. Sur GitHub, onglet **Actions** du dépôt, ouvre la dernière exécution réussie de « Studio
   installers » (ou lance-la avec **Run workflow**).
2. En bas de la page, dans **Artifacts**, télécharge :
   - `studio-macOS` : le `.dmg`. Il y en a deux : `arm64` pour les Mac récents (puce Apple M1 à
     M4…), `x64` pour les anciens Mac Intel. Dans le menu Apple → « À propos de ce Mac », la
     ligne « Puce » indique Apple si c'est `arm64`.
   - `studio-Windows` : l'installateur `.exe`.
3. **L'application n'est pas encore signée** (signature payante, voir
   `docs/requests-for-sam.md`), donc le système prévient à la première ouverture :
   - **Mac** : ouvre le `.dmg` et glisse « L-D-Maker Studio » dans Applications. À la première
     ouverture, macOS refuse : va dans **Réglages Système → Confidentialité et sécurité**, puis
     en bas, **Ouvrir quand même**. Une seule fois.
   - **Windows** : SmartScreen affiche « Windows a protégé votre ordinateur » : clique **Informations
     complémentaires**, puis **Exécuter quand même**. Une seule fois.

## Premier lancement
- **Ton prénom** : il apparaît dans les validations et dans le verrou des projets.
- **Dossier des projets** : choisis un dossier **dans votre espace cloud partagé** (le même pour
  Kylian et toi). Chaque projet y est un sous-dossier autonome.
- **Clé API Anthropic** (Paramètres) : à ajouter quand le moteur de génération arrivera (étape 2).
  Elle est chiffrée par le trousseau de ton ordinateur et ne va jamais dans le dossier partagé.

## Générer le storyboard (étape 2)
1. **Paramètres → Clé API Anthropic** : colle ta clé (elle commence par `sk-ant-`). Elle est
   chiffrée par le trousseau de ton ordinateur.
2. Dans un projet dont les sources sont lues, **Générer le storyboard** : le Studio affiche d'abord
   le coût estimé (calculé sur la taille exacte de ce qui sera envoyé), puis attend ton accord.
3. Claude rédige, puis chaque réponse passe les contrôles automatiques (traçabilité, alignement
   objectifs ↔ questions, règles pédagogiques). Les problèmes trouvés lui sont renvoyés, trois
   réponses au plus. Le coût réel s'affiche à la fin et est noté dans `generation-log.jsonl`.
4. Régénérer remplace le storyboard ; l'ancien est gardé dans `storyboard.previous.yaml`.

## Relire, modifier et valider le storyboard (étape 3)
1. Dans le projet, **Relire et valider le storyboard**.
2. En haut : l'état (à valider, validé, modifié depuis la validation) et les contrôles. En
   dessous : les **questions de Claude pour toi**, puis tout le storyboard, modifiable sur place :
   titres, objectifs, raison d'être et contenu de chaque bloc, réponses des questions (et
   laquelle est correcte).
3. **Enregistrer les modifications** : le storyboard est réécrit et recontrôlé, l'ancien gardé
   dans `storyboard.previous.yaml`.
4. **Valider le storyboard**, puis **Je valide** : c'est ton feu vert pour la rédaction du module.
   La validation est enregistrée à ton nom avec l'empreinte exacte du storyboard ; toute
   modification ultérieure demande une nouvelle validation. Impossible de valider tant qu'il reste
   une erreur ou des modifications non enregistrées.

La **page de revue** (bouton à côté) montre en plus l'extrait de source derrière chaque bloc.

**Règles communes** : un fichier `regles-maison.md` placé à la racine du dossier des projets est
transmis à Claude pour chaque génération (par exemple « jamais de quiz vrai/faux », « toujours un
cas client par section »). Écris-les librement, en français.

## Rédiger, relire, traduire et exporter le module (étape 4)
1. Une fois le storyboard validé, **Rédiger le module** : le Studio affiche le devis complet
   (rédaction, puis traductions dans chaque langue du projet, et le total), puis attend ton accord.
2. Claude rédige tous les textes à partir du storyboard validé, des sources et de la base de
   savoir horloger ; le module est contrôlé comme un module fait à la main (format, règles
   pédagogiques, conformité au storyboard) et renvoyé à Claude en cas de problème, trois
   réponses au plus. Ses **notes pour toi** (une image manquante, un choix fait) s'affichent à la
   fin et restent dans `module-notes.md`. Les traductions suivent automatiquement.
3. **Aperçu** : le module s'ouvre dans ton navigateur, tel que l'apprenant le verra.
4. **Retoucher les textes** : tous les textes de la langue principale, écran par écran. Après
   l'enregistrement, **Mettre à jour les traductions** ne retraduit que les textes modifiés.
5. **Exporter** : un paquet par sortie choisie, dans le dossier `out/` du projet, qui s'ouvre.
   Watch Live et les LMS dont le profil n'est pas encore réglé reçoivent un SCORM 1.2 standard ;
   le fichier HTML unique est remplacé, en attendant, par le site HTML zippé.

Réécrire le module remplace l'actuel, conservé dans `module.previous/`.

## Travailler à deux
Quand l'un de vous ouvre un projet, le Studio pose un verrou (`.ldm-lock`) : l'autre le voit
« Ouvert par … » et ne peut que le consulter, pour éviter que vos modifications se croisent. Le
verrou part à la fermeture du projet ou du Studio ; s'il reste (panne, coupure), il expire après
12 heures, et « Ouvrir quand même » permet de le reprendre.

Attention au service de synchronisation : laisse-le finir de synchroniser avant d'ouvrir un
projet que l'autre vient de modifier.

## Ce que fait cette première version
- Créer un projet : l'essentiel (titre, marque, public, durée, brief), les sources (PDF,
  PowerPoint, Word, texte), les langues, les formats de sortie (Watch Live, LMS courants,
  fichier HTML unique, site), le design, les animations, l'évaluation et le ton.
- Lire les sources : nombre de mots et passages repérés (la base de la traçabilité).
- Suivre l'avancement de chaque projet.
- Générer le storyboard avec Claude (coût affiché avant et après).
- Relire, modifier et valider le storyboard.
- Rédiger, traduire, prévisualiser, retoucher et exporter le module.

À venir, dans l'ordre : réglages propres à chaque LMS, dont Watch Live, et fichier HTML unique (5),
installateurs signés et mises à jour automatiques (6).
