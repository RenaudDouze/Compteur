import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { addCounter, gotoFresh, openMenu } from './helpers'

const WORKER_URL = 'http://sync.invalid'
const CODE = 'ABCDEFGH'

/** Simule le worker de synchro en mémoire pour la durée d'un test : suit un
 * unique code, avec la même résolution "dernier écrit gagne" que le vrai
 * service (voir worker/src/index.ts). */
async function mockWorker(page: Page, initial: { updatedAt: number; counters: unknown[] } | null = null) {
  let stored = initial

  await page.route(`${WORKER_URL}/api/sync`, async (route: Route) => {
    if (route.request().method() !== 'POST') return route.continue()
    stored = { updatedAt: Date.now(), counters: [] }
    await route.fulfill({ status: 201, json: { code: CODE } })
  })

  await page.route(`${WORKER_URL}/api/sync/${CODE}`, async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      if (stored === null) return route.fulfill({ status: 404, json: { error: 'Code inconnu.' } })
      return route.fulfill({ status: 200, json: stored })
    }
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as { updatedAt: number; counters: unknown[] }
      if (stored && stored.updatedAt > body.updatedAt) {
        return route.fulfill({ status: 409, json: stored })
      }
      stored = body
      return route.fulfill({ status: 200, json: stored })
    }
    return route.continue()
  })

  return {
    get current() {
      return stored
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
    await mockWorker(page, { updatedAt: Date.now(), counters: [{ id: 'x', name: 'Depuis un autre appareil', count: 3, createdAt: Date.now(), behavior: {}, appearance: { color: '#2563eb' } }] })

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
})
