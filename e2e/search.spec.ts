import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh } from './helpers'

test.describe('Recherche de compteurs', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test("n'affiche pas le bouton de recherche sans compteur", async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Rechercher' })).not.toBeVisible()
  })

  test('aucun champ visible avant un clic, puis filtre par nom', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('Pompes')
    await page.locator('.counter-name-input').press('Enter')

    await addCounter(page)
    await page.getByText('Compteur 2', { exact: true }).click()
    await page.locator('.counter-name-input').fill('Squats')
    await page.locator('.counter-name-input').press('Enter')

    const searchInput = page.getByPlaceholder('Rechercher un compteur…')
    await expect(searchInput).not.toBeVisible()

    await page.getByRole('button', { name: 'Rechercher' }).click()
    await expect(searchInput).toBeVisible()
    await searchInput.fill('pom')

    await expect(page.getByText('Pompes', { exact: true })).toBeVisible()
    await expect(page.getByText('Squats', { exact: true })).not.toBeVisible()

    await page.getByRole('button', { name: 'Fermer la recherche' }).click()
    await expect(searchInput).not.toBeVisible()
    await expect(page.getByText('Squats', { exact: true })).toBeVisible()
  })
})
