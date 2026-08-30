# Worker de synchronisation +1

Petit service Cloudflare Worker qui sert de relais entre tes appareils : chacun
pousse et récupère un instantané JSON de ses compteurs, identifié par un code
de synchronisation à 8 caractères (pas de compte, pas de mot de passe). Voir
`../src/hooks/useRemoteSync.ts` côté app pour la logique qui l'appelle.

## Déployer ton propre worker

Il te faut un compte Cloudflare (gratuit). Toutes les commandes ci-dessous
s'exécutent depuis ce dossier (`worker/`).

```sh
npm install
npx wrangler login
```

Crée l'espace de stockage clé-valeur :

```sh
npx wrangler kv namespace create SYNC_KV
```

La commande affiche un `id` — colle-le dans `wrangler.toml` :

```toml
[[kv_namespaces]]
binding = "SYNC_KV"
id = "colle-l-id-ici"
```

Optionnel : dans `wrangler.toml`, remplace `ALLOWED_ORIGIN = "*"` par le
domaine exact où l'app est servie (ex. `https://tonpseudo.github.io`) pour
n'accepter les requêtes que depuis ce site.

Déploie :

```sh
npm run deploy
```

Wrangler affiche l'URL du worker déployé (`https://plusun-sync.<ton-compte>.workers.dev`).
Renseigne-la dans l'app via la variable d'environnement `VITE_SYNC_WORKER_URL`
au moment du build (voir le `README.md` racine et le workflow de déploiement
GitHub Pages) — sans elle, la section « Code de synchro » du panneau
Synchroniser reste masquée.

## Développement local

```sh
npm run dev       # démarre le worker en local (wrangler dev)
npm test          # tests unitaires (routage, code, LWW)
npm run typecheck
```

## Ce que stocke le worker

Une seule valeur par code, sous la clé `sync:<CODE>` :

```json
{ "updatedAt": 1735689600000, "counters": [ /* état complet, format sync.ts */ ] }
```

- Écriture (`PUT`) : dernier écrit gagne — si une version plus récente a déjà
  été poussée par un autre appareil entre-temps, le worker répond `409` avec
  cette version plus récente plutôt que de l'écraser.
- Un code inutilisé pendant 180 jours expire et libère sa place.
- Aucune donnée personnelle n'est demandée : le code lui-même (8 caractères,
  ~500 milliards de combinaisons) fait office de secret partagé.
