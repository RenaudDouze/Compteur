/// <reference types="vite/client" />

// Injectée à la compilation (voir vite.config.ts / vitest.config.ts) : hash
// court du commit déployé, ou 'test' en environnement de test.
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  // URL du worker Cloudflare de synchronisation (voir worker/README.md).
  // Absente = fonctionnalité masquée, pas d'appel réseau.
  readonly VITE_SYNC_WORKER_URL?: string
}
