import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh } from './helpers'

test.describe('Parcours de base', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test("affiche l'état vide au premier lancement", async ({ page }) => {
    await expect(page.getByText("Aucun compteur pour l'instant.")).toBeVisible()
  })

  test('crée un premier compteur', async ({ page }) => {
    await addCounter(page)
    await expect(page.getByText('Compteur 1', { exact: true })).toBeVisible()
    await expect(page.locator('.counter-value')).toHaveText('0')
  })

  test('incrémente au clic sur la carte', async ({ page }) => {
    await addCounter(page)
    await page.locator('.counter-card').click()
    await expect(page.locator('.counter-value')).toHaveText('1')
    await page.locator('.counter-card').click()
    await page.locator('.counter-card').click()
    await expect(page.locator('.counter-value')).toHaveText('3')
  })

  test('décrémente avec le bouton -', async ({ page }) => {
    await addCounter(page)
    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    await plus.click()
    await plus.click()
    await page.getByRole('button', { name: 'Décrémenter' }).click()
    await expect(page.locator('.counter-value')).toHaveText('1')
  })

  test('autorise un compteur négatif', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Décrémenter' }).click()
    await expect(page.locator('.counter-value')).toHaveText('-1')
  })

  test('renomme un compteur', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    const input = page.locator('.counter-name-input')
    await input.fill('Mon compteur')
    await input.press('Enter')
    await expect(page.getByText('Mon compteur', { exact: true })).toBeVisible()
  })

  test('supprime un compteur après double confirmation', async ({ page }) => {
    await addCounter(page)
    const deleteBtn = page.getByRole('button', { name: 'Supprimer le compteur' })
    await deleteBtn.click()
    await expect(deleteBtn).toHaveText('✓')
    await deleteBtn.click()
    await expect(page.getByText("Aucun compteur pour l'instant.")).toBeVisible()
  })

  test('gère plusieurs compteurs indépendamment', async ({ page }) => {
    await addCounter(page)
    await addCounter(page)
    await expect(page.locator('.counter-card')).toHaveCount(2)
    await page.locator('.counter-card').first().click()
    const values = page.locator('.counter-value')
    await expect(values.nth(0)).toHaveText('1')
    await expect(values.nth(1)).toHaveText('0')
  })

  test('persiste les compteurs après rechargement', async ({ page }) => {
    await addCounter(page)
    await page.locator('.counter-card').click()
    await page.reload()
    await expect(page.locator('.counter-value')).toHaveText('1')
  })

  test('passe en grille compacte à partir de 3 compteurs', async ({ page }) => {
    await addCounter(page)
    await addCounter(page)
    await addCounter(page)
    await expect(page.locator('.counter-grid--pack')).toBeVisible()
  })
})
