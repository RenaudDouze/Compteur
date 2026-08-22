import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh } from './helpers'

test.describe('Fonctionnalités avancées', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
    await addCounter(page)
  })

  test('définit une probabilité et affiche le taux de réussite cumulé', async ({ page }) => {
    await page.getByText('+ probabilité').click()
    const input = page.locator('.counter-odds-input')
    await input.fill('4')
    await input.press('Enter')
    await expect(page.getByText(/1 chance sur 4|1\/4/)).toBeVisible()

    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    await plus.click()
    // 1 - (1 - 1/4)^1 = 0.25 => arrondi affiché à 1 décimale : 25,0 %
    await expect(page.getByText(/25,0\s?%/)).toBeVisible()
  })

  test('modifie la date de début et affiche le nombre de jours', async ({ page }) => {
    const label = page.getByTitle('Toucher pour changer la date de début')
    const before = await label.textContent()
    await label.click()
    const input = page.locator('.counter-date-input')
    await input.fill('2020-01-01')
    // Le format (complet sur grand écran, compact "JJ/MM · Nj" sur mobile)
    // varie selon la taille d'écran ; on vérifie juste que le libellé a
    // bien changé pour refléter la nouvelle date passée (pas "aujourd'hui").
    await expect(label).not.toHaveText(before ?? '')
    await expect(label).not.toContainText("aujourd'hui")
    await expect(label).not.toContainText('auj.')
  })

  test('définit une image de fond via une URL http(s) valide', async ({ page }) => {
    await page.getByText('+ image de fond').click()
    const input = page.getByPlaceholder('https://exemple.com/image.jpg')
    await input.fill('https://exemple.com/fond.jpg')
    await input.press('Enter')
    await expect(page.locator('.counter-bg')).toBeAttached()
  })

  test('ignore une URL invalide comme image de fond', async ({ page }) => {
    await page.getByText('+ image de fond').click()
    const input = page.getByPlaceholder('https://exemple.com/image.jpg')
    await input.fill('pas-une-url')
    await input.press('Enter')
    await expect(page.locator('.counter-bg')).not.toBeAttached()
    await expect(page.getByText('+ image de fond')).toBeVisible()
  })

  test('change la couleur du compteur via la palette', async ({ page }) => {
    const swatch = page.getByRole('button', { name: 'Changer la couleur du compteur' })
    const before = await swatch.evaluate((el) => getComputedStyle(el).backgroundColor)
    await swatch.click()
    // Le premier compteur créé utilise toujours la première couleur de la
    // palette : la deuxième option est donc garantie différente.
    await page.getByRole('button', { name: /Choisir la couleur/ }).nth(1).click()
    await expect(page.getByRole('button', { name: /Choisir la couleur/ })).toHaveCount(0)
    await expect(swatch).not.toHaveCSS('background-color', before)
  })

  test('définit directement une valeur via le crayon', async ({ page }) => {
    await page.getByRole('button', { name: 'Définir la valeur du compteur' }).click()
    const input = page.locator('.counter-value-input')
    await input.fill('250')
    await input.press('Enter')
    await expect(page.locator('.counter-value')).toHaveText('250')
  })

  test('accepte une valeur négative via édition directe', async ({ page }) => {
    await page.getByRole('button', { name: 'Définir la valeur du compteur' }).click()
    const input = page.locator('.counter-value-input')
    await input.fill('-42')
    await input.press('Enter')
    await expect(page.locator('.counter-value')).toHaveText('-42')
  })

  test('réordonne les compteurs par glisser-déposer', async ({ page }) => {
    await addCounter(page)
    await addCounter(page)

    const names = ['A', 'B', 'C']
    const cards = page.locator('.counter-card')
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).locator('.counter-name').click()
      await cards.nth(i).locator('.counter-name-input').fill(names[i])
      await cards.nth(i).locator('.counter-name-input').press('Enter')
    }

    await expect(page.locator('.counter-name')).toHaveText(['A', 'B', 'C'])

    const handleA = cards.nth(0).locator('.counter-drag-handle')
    const boxA = await handleA.boundingBox()
    const boxC = await cards.nth(2).boundingBox()
    if (!boxA || !boxC) throw new Error('bounding box manquante')

    await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2)
    await page.mouse.down()
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      const y = boxA.y + (boxC.y + boxC.height - boxA.y) * (i / steps)
      await page.mouse.move(boxA.x + boxA.width / 2, y)
      await page.waitForTimeout(20)
    }
    await page.mouse.up()

    await expect(page.locator('.counter-name')).toHaveText(['B', 'C', 'A'])
  })

  test("le clic sur la poignée de glisser n'incrémente pas", async ({ page }) => {
    await page.locator('.counter-drag-handle').click()
    await expect(page.locator('.counter-value')).toHaveText('0')
  })
})
