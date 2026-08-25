/// <reference types="vite/client" />

// Injectée à la compilation (voir vite.config.ts / vitest.config.ts) : hash
// court du commit déployé, ou 'test' en environnement de test.
declare const __APP_VERSION__: string
