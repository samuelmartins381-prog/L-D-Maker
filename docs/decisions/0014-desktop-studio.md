# 0014 — Studio : application de bureau Electron

- **Statut** : accepté (choix de Sam le 2026-10-17, plan validé)
- **Date** : 2026-10-17
- **Décideur** : Sam (application de bureau, Mac et Windows) ; Claude (technologie)

## Contexte
Sam veut une interface « simple en apparence, très compliquée au fond » : saisir le brief, les
sources et ses choix (format de sortie, LMS, design, animations, évaluation), puis relire,
modifier et exporter. Utilisateurs : Sam et Kylian, sur **Mac et Windows**. Projets dans un
**dossier cloud partagé** (accord de Sam pour y stocker les sources des marques ; service à
préciser). Le Studio doit faire tourner le générateur, le builder, la traduction et le banc QA,
tous écrits en TypeScript pour Node.

## Options étudiées
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Site web hébergé | Accès partout | Hébergement et sécurité des contenus de marques ; écarté par Sam | — |
| Tauri | Binaire léger | Webview différente par système (Safari sur Mac) ; Node à embarquer à part pour nos paquets | MIT / Apache-2.0 |
| Serveur local + navigateur | Simple | Node à installer chez Sam et Kylian ; pas une « application » | — |
| **Electron** | Node et Chromium embarqués : nos paquets tournent tels quels ; aperçu dans le même moteur que les navigateurs des apprenants ; Playwright sait le piloter pour les tests | Installateur lourd (~100 Mo) | MIT |

## Décision
**Electron** (`packages/studio`), interface en **Svelte 5** (comme le lecteur), installateurs par
**electron-builder** (MIT).
- Processus principal : accès aux fichiers et appels aux paquets `@ldm/*` ; l'interface ne parle
  au système que par une API `preload` étroite (`contextIsolation`, pas de `nodeIntegration`).
- Clé API Anthropic chiffrée par le trousseau du système (`safeStorage`), stockée dans le profil
  utilisateur, **jamais** dans le dossier partagé.
- Dossier des projets choisi par l'utilisateur ; un verrou `.ldm-lock` (nom, heure) évite que Sam
  et Kylian modifient le même projet en même temps.
- Textes d'interface en catalogues (fr, puis en), comme le lecteur.

## Licences
Electron (MIT), electron-builder (MIT), Svelte (MIT), pdf.js (Apache-2.0), polices Fraunces et Inter
(OFL-1.1). Outillage seulement : trois dépendances d'electron-builder sous WTFPL (licence
permissive), ajoutées à la liste élargie de `scripts/check-licenses.mjs` ; rien de cela n'entre
dans un module livré.

## Conséquences
- Je teste ici sous Linux (Playwright pilote Electron) ; Sam et Kylian vérifient sur Mac et
  Windows.
- Sans signature, macOS et Windows avertissent à l'installation : signature payante (compte Apple
  Developer, certificat Windows) à demander à Sam (`docs/requests-for-sam.md`).
- Le banc QA (Playwright + Chromium) télécharge son navigateur au premier contrôle (~150 Mo).

## Sources
- Electron, sécurité : https://www.electronjs.org/docs/latest/tutorial/security
- `safeStorage` : https://www.electronjs.org/docs/latest/api/safe-storage
- Playwright et Electron : https://playwright.dev/docs/api/class-electron
- electron-builder : https://www.electron.build/
