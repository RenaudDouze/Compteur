import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Certains environnements de développement fournissent déjà un Chromium
// pré-installé à cet emplacement (variable PLAYWRIGHT_BROWSERS_PATH) ; on
// le réutilise s'il existe pour éviter un téléchargement, sinon on laisse
// Playwright résoudre le navigateur installé normalement (ex: en CI via
// `npx playwright install`).
const localChromium = '/opt/pw-browsers/chromium'
const executablePath = existsSync(localChromium) ? localChromium : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    // URL bidon : jamais vraiment contactée en test, chaque appel est
    // intercepté via `page.route` (voir e2e/remote-sync.spec.ts). La définir
    // ici active simplement la section « Code de synchro » du panneau
    // Synchroniser pour toute la suite e2e, comme un vrai déploiement.
    command:
      'VITE_SYNC_WORKER_URL=http://sync.invalid npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
