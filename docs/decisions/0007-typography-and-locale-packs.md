# 0007 — Typographie multilingue et langues chargées à la demande

- **Statut** : accepté
- **Date** : 2026-10-16
- **Décideur** : Claude

## Contexte
Brief §4 : 11 langues ou plus, dont le chinois, le japonais et le coréen (CJK), l'arabe (RTL) et
le russe. Il faut une typographie correcte pour chaque écriture et un module qui reste léger et
rapide (brief §5 : Lighthouse mobile ≥ 90, LCP ≤ 2,5 s), y compris hors ligne (`file://`).
Le module de démo est désormais livré en 11 langues : fr, en, ar, de, es, it, pt-BR, ru, ja,
zh-Hans, ko.

Deux problèmes mesurés :
1. **Polices CJK** : une police CJK couvre des milliers de glyphes. Les paquets Noto Sans
   JP/SC/KR de Fontsource pèsent au total environ 14,5 Mo (woff2 découpés), à copier dans chaque
   paquet SCORM.
2. **Poids du premier écran** : avec les textes des 11 langues insérés dans `index.html`, celui-ci
   passe de 42 Ko à 140 Ko. Le LCP mobile monte alors à 3,07 s et le score Lighthouse tombe à 88
   (banc servi sans compression, comme certains LMS).

## Options étudiées

### Polices CJK
| Option | Avantages | Inconvénients | Licence |
|---|---|---|---|
| Embarquer Noto Sans CJK (Fontsource) | Rendu identique partout | ~14,5 Mo par paquet, chargement lent, limites de taille de certains LMS | OFL-1.1 |
| Sous-ensemble calculé par module (glyphes utilisés) | Léger, rendu identique | Outillage de découpe (fonttools/subfont) à ajouter, à refaire à chaque traduction | OFL-1.1 |
| **Polices système, piles par écriture** | 0 octet ; Hiragino, Yu Gothic, PingFang, Microsoft YaHei, Apple SD Gothic Neo, Malgun Gothic, Noto CJK (Android, Linux) sont d'excellente qualité | Rendu légèrement différent selon l'appareil | — |

### Textes des langues
| Option | Avantages | Inconvénients |
|---|---|---|
| Tout insérer dans `index.html` (J1) | Simple | Poids proportionnel au nombre de langues × taille du module |
| `fetch` de fichiers JSON | Standard | **Bloqué en `file://`** (exigence ADR 0003) |
| **Un script par langue (`locales/<langue>.js`), injecté à la demande** | Marche en `file://` et sur tout serveur ; premier écran constant | Une requête de plus quand la langue n'est pas celle par défaut |

## Décision
**Typographie (thème `lumiere.css`, `base.css`)**
- Piles de polices système par écriture : `--font-ja`, `--font-zh-hans`, `--font-zh-hant`,
  `--font-ko`, avec Inter en tête pour que les chiffres et le latin restent cohérents avec le
  reste du thème. Elles sont appliquées via `:root:lang(…)` ; les composants ne lisent que
  `--font-body` et `--font-display`.
- Fraunces (titres) n'a pas de cyrillique : pour le russe, l'ukrainien, le bulgare et le serbe,
  les titres utilisent Inter, qui couvre le cyrillique. L'arabe utilise Noto Sans Arabic
  (déjà embarquée).
- Pas d'espacement des lettres en arabe ni en CJK (`--tracking-*: 0`) ; interligne de 1,8 en CJK.
- Japonais : `word-break: auto-phrase` (coupe entre groupes de mots, Chrome 119+, ignoré
  ailleurs) et `line-break: strict`. Coréen : `word-break: keep-all` (pas de coupe au milieu
  d'un mot). Italique remplacé par une graisse de 650 en CJK : ces écritures n'ont pas d'italique
  et l'italique synthétique les déforme.
- Césure automatique (`hyphens: auto`, langue donnée par `lang`) et `overflow-wrap: break-word`,
  pour les mots longs de l'allemand et du russe.

**Langues chargées à la demande**
- `index.html` n'embarque que la langue par défaut (textes du module, interface, plus l'interface
  anglaise de secours).
- Chaque autre langue devient `locales/<langue>.js`, qui s'enregistre sur
  `self.ldmLocales[<langue>]`. Le lecteur l'injecte avec un `<script>` (`locale-loader.ts`).
- Au démarrage, le lecteur attend la langue négociée (URL > LMS > navigateur) avant le premier
  affichage. Le texte n'apparaît donc jamais d'abord dans la mauvaise langue.
- Changement en cours de route : la dernière demande l'emporte. Si un fichier manque, la langue
  actuelle est conservée et un avertissement apparaît dans la console.
- Interface : un catalogue régional absent prend celui de la langue (pt-BR → `pt.json`,
  zh-Hans → `zh.json`). Le builder le résout et le lecteur ne fait plus de repli par langue.
- Banc QA : le budget « poids du lecteur » ne compte que le code. Les fichiers de langue sont du
  contenu (comme les textes déjà insérés dans `index.html`) ; ils sont affichés à part, sans
  baisser le seuil.

## Conséquences
- Mesures sur le module de démo en 11 langues :
  - `index.html` : 18 Ko (contre 42 Ko en J1 avec 3 langues) ;
  - Lighthouse mobile : 95 ; LCP : 2,29 s ;
  - fichiers de langue : 44,5 Ko gzip au total, hors premier écran ;
  - banc QA : 308 pages (7 écrans × 11 langues × 2 formats × 2 états), 0 violation axe, aucun
    débordement.
- Le rendu CJK dépend des polices de l'appareil. Si un client exige un rendu identique au pixel
  (charte imposant une police CJK précise), il faudra un sous-ensemble calculé par module : nouvel
  ADR, avec fonttools (MIT) ou glyphhanger (MIT).
- `auto-phrase` n'existe que dans Chrome et Edge. Firefox et Safari coupent caractère par
  caractère, ce qui est l'usage normal en japonais.
- Les traductions du module de démo sont des traductions Claude, non relues. Une relecture native
  est obligatoire avant toute livraison client (demande n° 7 à Sam ; contrôle manuel du banc).
- Les paquets SCORM listent automatiquement `locales/*.js` dans le manifeste (inventaire récursif).

## Sources
- MDN, `word-break: auto-phrase` : https://developer.mozilla.org/en-US/docs/Web/CSS/word-break
- Chrome 119, BudouX dans le navigateur : https://developer.chrome.com/blog/css-i18n-features
- W3C, *Requirements for Japanese Text Layout* (JLReq) : https://www.w3.org/TR/jlreq/
- W3C, *Requirements for Hangul Text Layout* (klreq) : https://www.w3.org/TR/klreq/
- W3C i18n, *Styling vertical / CJK* : https://www.w3.org/International/questions/qa-css-lang
- Fontsource Noto Sans JP/SC/KR (tailles des paquets) : https://fontsource.org/fonts/noto-sans-jp
- Google Fonts, Fraunces (sous-ensembles latin, latin-ext, vietnamese uniquement) :
  https://fonts.google.com/specimen/Fraunces
