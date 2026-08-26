# +1

Application web (PWA) pour gérer plusieurs compteurs indépendants, à installer sur
téléphone ou tablette et utiliser 100% en local (aucun serveur, aucune donnée envoyée
en ligne — tout est stocké dans le `localStorage` de l'appareil).

## Fonctionnalités

- Plusieurs compteurs distincts, affichés en même temps dans une grille.
- Incrément (`+`) et décrément (`−`) de 1.
- Renommage d'un compteur (toucher son nom).
- Suppression avec confirmation (toucher deux fois le bouton `✕`).
- Effet de défilement façon odomètre sur les chiffres à chaque changement.
- Persistance locale : les compteurs restent après fermeture de l'app.
- Installable comme application (PWA), utilisable hors-ligne.
- Panneau « ⚙ Personnaliser » par compteur (couleur, image de fond, probabilité,
  date de début, partage), pour garder la carte épurée.

## Développement

```bash
npm install
npm run dev
```

## Build de production

```bash
npm run build
npm run preview
```

## Installer sur téléphone / tablette

1. Déployez le contenu de `dist/` sur un petit serveur local (ou ouvrez le site
   hébergé si vous le publiez quelque part accessible depuis l'appareil).
2. Ouvrez l'URL dans le navigateur du téléphone/tablette (Chrome, Safari...).
3. Utilisez « Ajouter à l'écran d'accueil » / « Installer l'application ».
4. L'application se lance ensuite comme une app native, et fonctionne hors-ligne
   grâce au service worker.

## Qualité du code

| Commande               | Rôle                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `npm run lint`          | Linter (oxlint)                                               |
| `npm run typecheck`     | Vérification des types TypeScript                             |
| `npm run test`          | Tests unitaires (Vitest)                                      |
| `npm run test:watch`    | Tests unitaires en mode watch                                 |
| `npm run test:coverage` | Tests unitaires + couverture de code (seuil 100% sur tout)    |
| `npm run test:e2e`      | Tests fonctionnels (Playwright, build + preview automatiques) |
| `npm run test:mutation` | Mutation testing (Stryker, logique pure uniquement)           |

- **Couverture de code** : seuil 100% (lignes, branches, fonctions, statements)
  sur l'ensemble du code source.
- **Mutation testing** : seuil 100%, mais scopé volontairement aux modules de
  logique pure sans JSX/animation (`src/odds.ts`, `src/date.ts`, `src/sync.ts`,
  `src/share.ts`, `src/id.ts`, `src/url.ts`, `src/colors.ts`) — un score de 100% strict sur les composants
  React (drag & drop, animations, QR code...) n'est pas un objectif réaliste
  (mutants équivalents, contenu visuel difficile à mutation-tester utilement).
- **Tests fonctionnels** : `e2e/` couvre les parcours de base, les
  fonctionnalités avancées (probabilité, date, glisser-déposer), la
  synchronisation/partage, et le fonctionnement PWA/hors-ligne.

## Intégration continue

Le workflow `.github/workflows/ci.yml` exécute lint, typecheck, tests
unitaires + couverture, tests E2E et mutation testing sur chaque pull
request. Pour bloquer réellement la fusion tant que ces vérifications ne
sont pas au vert, active les *required status checks* du dépôt :

**Settings → Branches → Branch protection rules → `main`** → coche
« Require status checks to pass before merging » et sélectionne les jobs
`Linter`, `Vérification des types`, `Tests unitaires + couverture`, `Tests
fonctionnels (Playwright)`, `Mutation testing (logique pure)` et `Build de
production`.
