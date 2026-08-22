# Compteur

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
