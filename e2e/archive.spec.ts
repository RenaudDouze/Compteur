import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh } from './helpers'

test.describe('Archivage de compteurs', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test("n'affiche pas le sélecteur Actifs/Archivés sans compteur", async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Actifs' })).not.toBeVisible()
  })

  test('archive un compteur, le masque des actifs, et le retrouve via Archivés', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('À ranger')
    await page.locator('.counter-name-input').press('Enter')

    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('📦 Archiver ce compteur').click()
    await expect(page.getByText('À ranger', { exact: true })).not.toBeVisible()
    await expect(page.getByRole('tab', { name: 'Archivés (1)' })).toBeVisible()

    await page.getByRole('tab', { name: 'Archivés (1)' }).click()
    await expect(page.getByText('À ranger', { exact: true })).toBeVisible()
  })

  test('désarchive un compteur et le fait réapparaître dans les actifs', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('📦 Archiver ce compteur').click()

    await page.getByRole('tab', { name: 'Archivés (1)' }).click()
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('📤 Désarchiver ce compteur').click()

    await page.getByRole('tab', { name: 'Actifs' }).click()
    await expect(page.getByText('Compteur 1', { exact: true })).toBeVisible()
  })

  test('la recherche retrouve un compteur archivé au sein de son onglet', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('Pompes')
    await page.locator('.counter-name-input').press('Enter')
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('📦 Archiver ce compteur').click()

    await page.getByRole('tab', { name: 'Archivés (1)' }).click()
    await page.getByRole('button', { name: 'Rechercher' }).click()
    await page.getByPlaceholder('Rechercher un compteur…').fill('pom')
    await expect(page.getByText('Pompes', { exact: true })).toBeVisible()
  })
})
