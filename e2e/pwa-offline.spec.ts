import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh } from './helpers'

test.describe('PWA et fonctionnement hors-ligne', () => {
  test('expose un manifest web app valide', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/manifest.webmanifest`)
    expect(response.ok()).toBeTruthy()
    const manifest = await response.json()
    expect(manifest.name).toBe('Compteur')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  test('enregistre un service worker', async ({ page }) => {
    await gotoFresh(page)
    const hasServiceWorker = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      return !!reg.active
    })
    expect(hasServiceWorker).toBe(true)
  })

  test("fonctionne hors-ligne après une première visite", async ({ page, context }) => {
    await gotoFresh(page)
    await addCounter(page)
    await page.locator('.counter-card').click()
    await expect(page.locator('.counter-value')).toHaveText('1')

    // Laisse le service worker terminer sa mise en cache des assets.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.waitForTimeout(500)

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Compteur', exact: true })).toBeVisible()
    await expect(page.locator('.counter-value')).toHaveText('1')

    await context.setOffline(false)
  })

  test('les compteurs restent disponibles hors-ligne (localStorage local)', async ({ page, context }) => {
    await gotoFresh(page)
    await addCounter(page)
    await page.getByText('Compteur 1').click()
    await page.locator('.counter-name-input').fill('Hors-ligne')
    await page.locator('.counter-name-input').press('Enter')

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.waitForTimeout(500)

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByText('Hors-ligne')).toBeVisible()

    // Toujours utilisable hors-ligne : incrémenter fonctionne normalement.
    await page.locator('.counter-card').click()
    await expect(page.locator('.counter-value')).toHaveText('1')

    await context.setOffline(false)
  })
})
