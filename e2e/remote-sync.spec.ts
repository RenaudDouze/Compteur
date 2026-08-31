import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { addCounter, gotoFresh, openMenu } from './helpers'

const WORKER_URL = 'http://sync.invalid'
const CODE = 'ABCDEFGH'

/** Simule le worker de synchro en mémoire pour la durée d'un test : suit un
 * unique code, avec la même écriture optimiste par numéro de version que le
 * vrai service (voir worker/src/index.ts). */
async function mockWorker(page: Page, initial: { version: number; counters: unknown[] } | null = null) {
  let stored = initial
  // `context.setOffline` ne coupe pas les requêtes déjà interceptées par
  // `page.route` (elles sont servies localement, jamais envoyées sur le
  // réseau) : simuler une coupure du worker passe donc par ce drapeau,
  // vérifié explicitement dans les deux handlers ci-dessous plutôt que par
  // le mode hors-ligne du navigateur.
  let offline = false

  await page.route(`${WORKER_URL}/api/sync`, async (route: Route) => {
    if (offline) return route.abort('internetdisconnected')
    if (route.request().method() !== 'POST') return route.continue()
    stored = { version: 0, counters: [] }
    await route.fulfill({ status: 201, json: { code: CODE } })
  })

  await page.route(`${WORKER_URL}/api/sync/${CODE}`, async (route: Route) => {
    if (offline) return route.abort('internetdisconnected')
    const method = route.request().method()
    if (method === 'GET') {
      if (stored === null) return route.fulfill({ status: 404, json: { error: 'Code inconnu.' } })
      return route.fulfill({ status: 200, json: stored })
    }
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as { baseVersion: number; counters: unknown[] }
      const currentVersion = stored?.version ?? 0
      if (body.baseVersion !== currentVersion) {
        return route.fulfill({ status: 409, json: stored ?? { version: 0, counters: [] } })
      }
      stored = { version: currentVersion + 1, counters: body.counters }
      return route.fulfill({ status: 200, json: stored })
    }
    return route.continue()
  })

  return {
    get current() {
      return stored
    },
    setOffline(value: boolean) {
      offline = value
    },
    /** Simule une écriture faite par un autre appareil, en dehors de toute
     * requête de la page testée (contourne le routage `page.route`). */
    setStored(value: { version: number; counters: unknown[] } | null) {
      stored = value
    },
  }
}

test.describe('Synchronisation via code (worker)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test('crée un code, l’affiche formaté et pousse les compteurs actuels', async ({ page }) => {
    const worker = await mockWorker(page)
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('À synchroniser')
    await page.locator('.counter-name-input').press('Enter')

    await openMenu(page)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await page.getByRole('button', { name: 'Nouveau code' }).click()

    await expect(page.getByText('ABCD EFGH')).toBeVisible()
    await expect(page.getByText('Synchronisé ✓')).toBeVisible()
    expect(worker.current?.counters).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'À synchroniser' })])
    )
  })

  test('rejoint un code existant sans compteur local (sans confirmation) et affiche les compteurs distants', async ({
    page,
  }) => {
    await mockWorker(page, { version: 1, counters: [{ id: 'x', name: 'Depuis un autre appareil', count: 3, createdAt: Date.now(), behavior: {}, appearance: { color: '#2563eb' } }] })

    await openMenu(page)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await page.getByRole('button', { name: 'Saisir un code' }).click()
    await page.getByPlaceholder('XXXX XXXX').fill(CODE)
    await page.getByRole('button', { name: 'Rejoindre' }).click()

    await expect(page.getByText('ABCD EFGH')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByText('Depuis un autre appareil', { exact: true })).toBeVisible()
  })

  test('signale un code introuvable', async ({ page }) => {
    await mockWorker(page, null)
    await openMenu(page)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await page.getByRole('button', { name: 'Saisir un code' }).click()
    await page.getByPlaceholder('XXXX XXXX').fill(CODE)
    await page.getByRole('button', { name: 'Rejoindre' }).click()

    await expect(page.getByText('Ce code de synchronisation est introuvable.')).toBeVisible()
  })

  test('se déconnecte et retrouve les boutons de création/adhésion', async ({ page }) => {
    await mockWorker(page)
    await openMenu(page)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await page.getByRole('button', { name: 'Nouveau code' }).click()
    await expect(page.getByText('ABCD EFGH')).toBeVisible()

    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page.getByText('ABCD EFGH')).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Nouveau code' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Saisir un code' })).toBeVisible()
  })

  test('signale une erreur sans planter quand le worker devient injoignable, puis reprend au retour', async ({
    page,
  }) => {
    const worker = await mockWorker(page)
    await openMenu(page)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await page.getByRole('button', { name: 'Nouveau code' }).click()
    await expect(page.getByText('Synchronisé ✓')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    worker.setOffline(true)
    // Modifie un compteur pendant la coupure : la poussée différée doit
    // échouer proprement (statut d'erreur) plutôt que de planter l'app.
    await addCounter(page)

    await openMenu(page)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await expect(page.getByText('Erreur de synchronisation')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    worker.setOffline(false)
    // Un nouveau changement local relance une poussée sans attendre le
    // prochain sondage périodique (jusqu'à 20 s) : reprise plus rapide et
    // plus déterministe pour le test.
    await page.locator('.counter-card').click()

    await openMenu(page)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await expect(page.getByText('Synchronisé ✓')).toBeVisible({ timeout: 10_000 })
  })

  test('affiche une notification quand des compteurs arrivent d’un autre appareil', async ({ page }) => {
    const worker = await mockWorker(page, {
      version: 1,
      counters: [{ id: 'a', name: 'Compteur 1', count: 0, createdAt: Date.now(), behavior: {}, appearance: { color: '#2563eb' } }],
    })
    await openMenu(page)
    await page.getByRole('button', { name: 'Synchroniser', exact: true }).click()
    await page.getByRole('button', { name: 'Saisir un code' }).click()
    await page.getByPlaceholder('XXXX XXXX').fill(CODE)
    await page.getByRole('button', { name: 'Rejoindre' }).click()
    await expect(page.getByText('ABCD EFGH')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    // Simule un autre appareil qui pousse une modification pendant que cette
    // page est déjà synchronisée : la prochaine modification locale se fera
    // rejeter (baseVersion périmé) et adoptera cette version-ci.
    worker.setStored({
      version: 2,
      counters: [{ id: 'a', name: 'Depuis un autre appareil', count: 5, createdAt: Date.now(), behavior: {}, appearance: { color: '#2563eb' } }],
    })
    await page.locator('.counter-card').click()

    await expect(page.getByText('Compteurs mis à jour depuis un autre appareil')).toBeVisible()
    await expect(page.getByText('Depuis un autre appareil', { exact: true })).toBeVisible()
    expect(worker.current?.version).toBe(2)
  })
})
