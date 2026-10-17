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
4. **Ouvrir la page de revue du storyboard** pour le lire. Régénérer remplace le storyboard ;
   l'ancien est gardé dans `storyboard.previous.yaml`.

**Règles communes** : un fichier `regles-maison.md` placé à la racine du dossier des projets est
transmis à Claude pour chaque génération (par exemple « jamais de quiz vrai/faux », « toujours un
cas client par section »). Écris-les librement, en français.

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

À venir, dans l'ordre : relecture et validation
du storyboard dans le Studio (3), rédaction, éditeur et aperçu (4), exports par LMS (5),
installateurs signés et mises à jour automatiques (6).
